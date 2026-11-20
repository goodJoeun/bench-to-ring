import { getChallengeBoard } from "@/server/leaderboard/challenge";
import { parseChallengeDay } from "@/server/leaderboard/validate";
import { BOARD_CACHE_CONTROL } from "@/shared/leaderboard/cdn";
import type { ApiError, ChallengeBoard } from "@/shared/leaderboard/types";

/** 챌린지 순위표: `?day=YYYY-MM-DD`(한국 시간, 최근 7일). 그날 포지션마다 상위 50명과 도전한 플레이어 수예요. */
export async function GET(req: Request) {
  const day = parseChallengeDay(new URL(req.url).searchParams, Date.now());
  if (!day) return Response.json({ error: "챌린지 날짜가 맞지 않아요." } satisfies ApiError, { status: 400 });
  // 일반 순위표처럼 CDN이 잠깐 들고 있다가 내줘요(shared/leaderboard/cdn.ts).
  return Response.json((await getChallengeBoard(day)) satisfies ChallengeBoard, { headers: { "cache-control": BOARD_CACHE_CONTROL } });
}
