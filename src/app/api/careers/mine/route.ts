import { playerFrom } from "@/server/auth";
import { myRanks } from "@/server/boards";
import type { ApiError, MyRanks } from "@/lib/leaderboard/types";

/** 이 플레이어(토큰)가 올린 기록의 지금 순위. 랭킹 페이지의 '나의 기록'에서 써요. */
export async function GET(req: Request) {
  const playerId = await playerFrom(req);
  if (!playerId) return Response.json({ error: "플레이어 토큰이 없거나 맞지 않아요." } satisfies ApiError, { status: 401 });
  return Response.json((await myRanks(playerId)) satisfies MyRanks);
}
