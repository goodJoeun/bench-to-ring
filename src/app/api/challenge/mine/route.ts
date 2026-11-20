import { playerFrom } from "@/server/auth";
import { myChallenge } from "@/server/leaderboard/challenge";
import { parseChallengeDay } from "@/server/leaderboard/validate";
import type { ApiError, MyChallenge } from "@/shared/leaderboard/types";

const fail = (status: number, error: string) => Response.json({ error } satisfies ApiError, { status });

/** 이 플레이어(토큰)의 그날 챌린지 성적: `?day=YYYY-MM-DD`. 도전한 포지션마다 가장 좋은 기록의 순위예요. */
export async function GET(req: Request) {
  const playerId = await playerFrom(req);
  if (!playerId) return fail(401, "플레이어 토큰이 없거나 맞지 않아요.");
  const day = parseChallengeDay(new URL(req.url).searchParams, Date.now());
  if (!day) return fail(400, "챌린지 날짜가 맞지 않아요.");
  return Response.json({ day, mine: await myChallenge(playerId, day) } satisfies MyChallenge);
}
