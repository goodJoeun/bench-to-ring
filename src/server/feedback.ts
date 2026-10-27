import { z } from "zod";

/*
 * 의견 보내기: 화면의 의견을 받아 운영자 메일로 보내요. 메일은 Resend(https://resend.com) HTTP API로 보내요.
 * 받는 주소(FEEDBACK_TO)와 API 키(RESEND_API_KEY)는 환경 변수로 둬요. 주소를 코드에 남기지 않으려고요.
 */

export const FEEDBACK_KINDS = { bug: "버그 제보", idea: "개선 제안", etc: "기타" } as const;
export const FEEDBACK_MAX = 500;

const feedbackSchema = z.object({
  kind: z.enum(["bug", "idea", "etc"]),
  message: z.string().trim().min(1).max(FEEDBACK_MAX),
  /** 답장 받을 주소 (선택) */
  email: z.union([z.literal(""), z.email().max(120)]).optional(),
  /** 화면이 함께 보내는 상황 정보: 보던 주소, 진행 중인 커리어 */
  page: z.string().max(200).optional(),
  career: z.string().max(200).optional(),
  /** 사람 눈에는 안 보이는 칸. 채워져 있으면 봇이에요. */
  website: z.string().max(200).optional(),
});

export type Feedback = z.infer<typeof feedbackSchema>;

export function parseFeedback(body: unknown): { ok: true; feedback: Feedback } | { ok: false; error: string } {
  const r = feedbackSchema.safeParse(body);
  if (!r.success) return { ok: false, error: "의견 내용을 확인해 주세요." };
  return { ok: true, feedback: r.data };
}

/** 같은 곳(IP)에서 이 간격 안에 다시 보내면 막아요. 서버 인스턴스마다 따로 세는 가벼운 막이에요. */
export const FEEDBACK_INTERVAL_MS = 30_000;
const lastSent = new Map<string, number>();

export function tooSoon(key: string, now = Date.now()): boolean {
  const last = lastSent.get(key);
  return last !== undefined && now - last < FEEDBACK_INTERVAL_MS;
}

/** 보낸 때를 적어요. 보내지 못했으면 적지 않아 바로 다시 보낼 수 있어요. */
export function markSent(key: string, now = Date.now()): void {
  lastSent.set(key, now);
  // 오래된 기록은 비워요.
  if (lastSent.size > 1000) for (const [k, t] of lastSent) if (now - t > FEEDBACK_INTERVAL_MS) lastSent.delete(k);
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** 메일 제목과 본문 */
export function feedbackMail(f: Feedback, userAgent: string): { subject: string; text: string; html: string } {
  const kind = FEEDBACK_KINDS[f.kind];
  const first = f.message.split("\n")[0].slice(0, 40);
  const meta: [string, string][] = [
    ["종류", kind],
    ["답장 주소", f.email || "(없음)"],
    ["화면", f.page || "-"],
    ["커리어", f.career || "-"],
    ["브라우저", userAgent.slice(0, 300) || "-"],
  ];
  return {
    subject: `[농구 선수 키우기 · ${kind}] ${first}`,
    text: `${f.message}\n\n---\n${meta.map(([k, v]) => `${k}: ${v}`).join("\n")}`,
    html:
      `<p style="white-space:pre-wrap">${esc(f.message)}</p><hr>` +
      `<table>${meta.map(([k, v]) => `<tr><th align="left">${k}</th><td>${esc(v)}</td></tr>`).join("")}</table>`,
  };
}

/** 메일을 보내요. 설정이 없거나 보내지 못하면 false예요. */
export async function sendFeedback(f: Feedback, userAgent: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  const to = process.env.FEEDBACK_TO;
  if (!key || !to) {
    console.error("의견 메일 설정(RESEND_API_KEY, FEEDBACK_TO)이 없어요.");
    return false;
  }
  const mail = feedbackMail(f, userAgent);
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.FEEDBACK_FROM || "농구 선수 키우기 <onboarding@resend.dev>",
      to: [to],
      reply_to: f.email || undefined,
      ...mail,
    }),
  }).catch(() => null);
  if (!res?.ok) console.error("의견 메일을 보내지 못했어요.", res?.status, await res?.text().catch(() => ""));
  return !!res?.ok;
}
