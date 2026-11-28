import { revalidateTag } from "next/cache";
import { playerFrom } from "@/server/auth";
import { ACHIEVEMENTS_TAG, recordAchievements } from "@/server/leaderboard/achievements";
import { BOARDS_TAG } from "@/server/leaderboard/boards";
import { SUBMIT_INTERVAL_MS, insertCareer, lastSubmittedAt, ranksOf } from "@/server/leaderboard/careers";
import { myChallenge } from "@/server/leaderboard/challenge";
import { acceptedChallenge, checkSummary, parseAchievementIds } from "@/server/leaderboard/validate";
import type { ApiError, SubmitResult } from "@/shared/leaderboard/types";

/** 은퇴 요약 한 건이 수 KB를 넘지 않아요. */
const MAX_BODY = 16_000;

const fail = (status: number, error: string) => Response.json({ error } satisfies ApiError, { status });

/** 은퇴 요약 바깥에 함께 오는 값(지금은 업적 목록)을 떼어 내요. 요약에는 남기지 않아요. */
function splitBody(body: unknown): { summary: unknown; achv: unknown } {
  if (body === null || typeof body !== "object" || Array.isArray(body)) return { summary: body, achv: undefined };
  const { achv, ...summary } = body as Record<string, unknown>;
  return { summary, achv };
}

/** 업적 달성률은 덤이라, 저장하지 못해도(달성률 표를 만들기 전 등) 기록 제출은 그대로 성공해요. */
async function saveAchievements(playerId: string, ids: string[]): Promise<void> {
  try {
    await recordAchievements(playerId, ids);
    // 달성률은 조금 늦어도 괜찮아서, 묵은 값을 내주면서 뒤에서 새로 계산해요.
    revalidateTag(ACHIEVEMENTS_TAG, "max");
  } catch (e) {
    console.error("업적 달성 기록을 저장하지 못했어요.", e);
  }
}

/**
 * 은퇴 기록 제출. 본문은 은퇴 요약이고, 그 브라우저에서 딴 업적 id 목록(achv)이 함께 올 수 있어요.
 * 응답에 역대 전체 순위와 포지션 순위를 담아요. 챌린지 기록이면 그날 챌린지 순위도 담아요.
 */
export async function POST(req: Request) {
  const playerId = await playerFrom(req);
  if (!playerId) return fail(401, "플레이어 토큰이 없거나 맞지 않아요.");

  const text = await req.text();
  if (text.length > MAX_BODY) return fail(413, "기록이 너무 커요.");
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return fail(400, "JSON이 아니에요.");
  }
  const { summary, achv } = splitBody(body);
  const checked = checkSummary(summary);
  if (!checked.ok) return fail(400, checked.error);

  const last = await lastSubmittedAt(playerId);
  if (last && Date.now() - last.getTime() < SUBMIT_INTERVAL_MS) return fail(429, "잠시 뒤에 다시 제출해 주세요.");

  const now = Date.now();
  const id = await insertCareer(playerId, checked.summary, now);
  if (!id) return fail(409, "이미 제출한 커리어예요.");
  // 은퇴하고 바로 순위표를 열면 내 기록이 보이게, 묵은 순위표를 내주지 않고 바로 다시 계산해요.
  // 올린 브라우저는 CDN 캐시를 건너뛰어 불러요(shared/leaderboard/cdn.ts).
  revalidateTag(BOARDS_TAG, { expire: 0 });
  await saveAchievements(playerId, parseAchievementIds(achv));
  const ranks: SubmitResult = await ranksOf(id);
  const tag = acceptedChallenge(checked.summary, now);
  if (tag) {
    const mine = (await myChallenge(playerId, tag.day)).find((m) => m.pos === tag.pos);
    if (mine) ranks.challenge = { day: tag.day, ...mine };
  }
  return Response.json(ranks, { status: 201 });
}
