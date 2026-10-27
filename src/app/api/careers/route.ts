import { revalidateTag } from "next/cache";
import { playerFrom } from "@/server/auth";
import { BOARDS_TAG } from "@/server/boards";
import { SUBMIT_INTERVAL_MS, insertCareer, lastSubmittedAt, ranksOf } from "@/server/careers";
import { checkSummary } from "@/server/validate";
import type { ApiError, SubmitResult } from "@/lib/leaderboard/types";

/** 은퇴 요약 한 건이 수 KB를 넘지 않아요. */
const MAX_BODY = 16_000;

const fail = (status: number, error: string) => Response.json({ error } satisfies ApiError, { status });

/** 은퇴 기록 제출. 응답에 역대 전체 순위와 포지션 순위를 담아요. */
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
  const checked = checkSummary(body);
  if (!checked.ok) return fail(400, checked.error);

  const last = await lastSubmittedAt(playerId);
  if (last && Date.now() - last.getTime() < SUBMIT_INTERVAL_MS) return fail(429, "잠시 뒤에 다시 제출해 주세요.");

  if (!(await insertCareer(playerId, checked.summary))) return fail(409, "이미 제출한 커리어예요.");
  // 은퇴하고 바로 순위표를 열면 내 기록이 보이게, 묵은 순위표를 내주지 않고 바로 다시 계산해요.
  revalidateTag(BOARDS_TAG, { expire: 0 });
  const ranks = await ranksOf(checked.summary);
  return Response.json(ranks satisfies SubmitResult, { status: 201 });
}
