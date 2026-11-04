import { getStatBoard } from "@/server/leaderboard/stats";
import { parseStatQuery } from "@/server/leaderboard/validate";
import type { ApiError, StatBoard } from "@/shared/leaderboard/types";

/** 스탯 랭킹: `?stat=pts|reb|ast|stl|blk|tpm|don&scope=current|all&ruleset=&day=YYYY-MM-DD`. 프로 통산(기부금은 커리어 누적) 상위 50명이에요. */
export async function GET(req: Request) {
  const q = parseStatQuery(new URL(req.url).searchParams);
  if (!q.ok) return Response.json({ error: q.error } satisfies ApiError, { status: 400 });
  return Response.json((await getStatBoard(q.scope, q.stat, q.day)) satisfies StatBoard);
}
