import { getBoard } from "@/server/boards";
import { parseBoardQuery } from "@/server/validate";
import type { ApiError, Board } from "@/lib/leaderboard/types";

/** 순위표: `?scope=current|all&ruleset=&pos=`. 전체 Top 100(포지션을 고르면 Top 50), 역대 Best 5, 전체 통계예요. */
export async function GET(req: Request) {
  const q = parseBoardQuery(new URL(req.url).searchParams);
  if (!q.ok) return Response.json({ error: q.error } satisfies ApiError, { status: 400 });
  return Response.json((await getBoard(q.scope, q.pos)) satisfies Board);
}
