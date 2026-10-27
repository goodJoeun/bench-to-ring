import { markSent, parseFeedback, sendFeedback, tooSoon } from "@/server/feedback";
import type { ApiError } from "@/lib/leaderboard/types";

/** 의견 한 건은 1KB 남짓이에요. */
const MAX_BODY = 4_000;

const fail = (status: number, error: string) => Response.json({ error } satisfies ApiError, { status });

/** 의견 보내기. 운영자 메일로 보내요. */
export async function POST(req: Request) {
  const text = await req.text();
  if (text.length > MAX_BODY) return fail(413, "의견이 너무 길어요.");
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return fail(400, "JSON이 아니에요.");
  }
  const checked = parseFeedback(body);
  if (!checked.ok) return fail(400, checked.error);
  // 봇이 채운 숨은 칸이면 받은 척만 해요.
  if (checked.feedback.website) return new Response(null, { status: 204 });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  if (tooSoon(ip)) return fail(429, "잠시 뒤에 다시 보내 주세요.");

  if (!(await sendFeedback(checked.feedback, req.headers.get("user-agent") ?? ""))) return fail(503, "지금은 의견을 보낼 수 없어요.");
  markSent(ip);
  return new Response(null, { status: 204 });
}
