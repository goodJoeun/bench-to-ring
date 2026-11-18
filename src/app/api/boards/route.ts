import { getBoard } from "@/server/leaderboard/boards";
import { parseBoardQuery } from "@/server/leaderboard/validate";
import { BOARD_CACHE_CONTROL } from "@/shared/leaderboard/cdn";
import type { ApiError, Board } from "@/shared/leaderboard/types";

/** 순위표: `?scope=current|all&ruleset=&pos=&day=YYYY-MM-DD`. 전체 Top 100(포지션을 고르면 Top 50), 역대 Best 5, 전체 통계예요. */
export async function GET(req: Request) {
  const q = parseBoardQuery(new URL(req.url).searchParams);
  if (!q.ok) return Response.json({ error: q.error } satisfies ApiError, { status: 400 });
  // CDN이 잠깐 들고 있다가 내줘요. 그동안은 함수도 DB도 깨지 않아요(shared/leaderboard/cdn.ts).
  return Response.json((await getBoard(q.scope, q.pos, q.day)) satisfies Board, { headers: { "cache-control": BOARD_CACHE_CONTROL } });
}
