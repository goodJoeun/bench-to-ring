import { z } from "zod";
import { AWARDS, PERSONAL_AWARDS, POS_KEYS, RULESET_VERSION, START_YEAR, legacyOf, type AwardKey, type CareerSummary, type PosKey } from "@/game";
import { RETIRE_AGE } from "@/game/offseason";

// 제출한 은퇴 기록이 엔진이 낼 수 있는 모양과 범위인지 봐요 (docs/online-leaderboard.md 4장 1단계).
// DB를 쓰지 않아서 테스트에서 바로 불러요.

const AWARD_KEYS = AWARDS.map(([k]) => k) as [AwardKey, ...AwardKey[]];
const count = z.int().min(0);

const summarySchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().trim().min(1).max(12),
  num: z.int().min(0).max(99),
  pos: z.enum(POS_KEYS as [PosKey, ...PosKey[]]),
  nat: z.string().max(30),
  mvp: count,
  rings: count,
  personal: count,
  peak: z.int().min(20).max(99),
  pts: count,
  reb: count,
  ast: count,
  gp: count,
  seasons: z.int().min(1).max(30),
  retAge: z.int().min(30).max(RETIRE_AGE + 1),
  retYear: z.int(),
  teams: z.array(z.string().max(40)).max(40),
  earn: z.number().min(0).max(1_000_000),
  caps: count.max(300),
  awards: z.partialRecord(z.enum(AWARD_KEYS), count.max(100)),
  draft: z
    .object({ lg: z.string().max(20), pick: z.int(), round: z.int(), inRound: z.int(), team: z.string().max(40), year: z.int() })
    .nullable(),
  legacy: z.string().max(40),
  donated: z.number().min(0).max(1_000_000).optional(),
  academy: z.boolean().optional(),
  legacyItems: z.array(z.string().max(40)).max(20).optional(),
  ruleset: z.int().min(1).max(RULESET_VERSION),
});

export type SubmittedSummary = z.infer<typeof summarySchema> & CareerSummary;

/** 욕설이 들어간 선수 이름은 이 이름으로 바꿔서 올려요. 기록은 살려요. */
export const HIDDEN_NAME = "익명의 선수";

// 띄어쓰기·숫자·기호를 뺀 소문자에서 찾아요.
const BAD_WORDS = [
  "시발", "씨발", "씨빨", "시빨", "ㅅㅂ", "ㅆㅂ", "병신", "븅신", "ㅂㅅ", "좆", "존나", "졸라", "개새", "새끼", "ㅅㄲ",
  "지랄", "ㅈㄹ", "염병", "엿먹", "니미", "느금", "애미", "애비", "창녀", "걸레", "보지", "자지", "섹스", "fuck", "shit",
  "bitch", "cunt", "nigg", "pussy",
];

export function cleanName(name: string): string {
  const flat = name.toLowerCase().replace(/[\s\d\p{P}\p{S}]/gu, "");
  return BAD_WORDS.some((w) => flat.includes(w)) ? HIDDEN_NAME : name;
}

export type CheckResult = { ok: true; summary: SubmittedSummary } | { ok: false; error: string };

/** 모양과 범위, 값끼리 맞는지 봐요. 통과하면 이름을 걸러 낸 요약을 돌려줘요. */
export function checkSummary(input: unknown): CheckResult {
  const parsed = summarySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "형식이 맞지 않아요." };
  const s = parsed.data as SubmittedSummary;
  const a = s.awards;

  if (s.mvp !== (a.mvp_nba ?? 0) || s.rings !== (a.ring ?? 0)) return { ok: false, error: "수상 기록이 맞지 않아요." };
  if (s.personal !== PERSONAL_AWARDS.reduce((t, k) => t + (a[k] ?? 0), 0)) return { ok: false, error: "개인상 수가 맞지 않아요." };
  if (s.mvp > s.seasons || s.rings > s.seasons) return { ok: false, error: "시즌 수보다 많은 수상이 있어요." };
  // 정규 시즌과 플레이오프를 합쳐도 시즌마다 110경기를 넘지 않아요.
  if (s.gp > s.seasons * 110) return { ok: false, error: "경기 수가 너무 많아요." };
  if (s.pts > s.gp * 60 || s.reb > s.gp * 30 || s.ast > s.gp * 25) return { ok: false, error: "통산 기록이 너무 많아요." };
  // 16세에 START_YEAR로 시작해 나이와 연도가 같이 늘어요.
  if (Math.abs(s.retYear - (START_YEAR - 17 + s.retAge)) > 1) return { ok: false, error: "은퇴 연도가 맞지 않아요." };
  const { legacy, ...rest } = s;
  if (legacy !== legacyOf(rest)) return { ok: false, error: "레거시 등급이 맞지 않아요." };

  return { ok: true, summary: { ...s, name: cleanName(s.name) } };
}
