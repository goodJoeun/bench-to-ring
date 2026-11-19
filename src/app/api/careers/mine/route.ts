import { revalidateTag } from "next/cache";
import { playerFrom } from "@/server/auth";
import { BOARDS_TAG, myRanks } from "@/server/leaderboard/boards";
import { deleteCareer } from "@/server/leaderboard/careers";
import { isCareerId } from "@/server/leaderboard/validate";
import type { ApiError, DeleteResult, MyRanks } from "@/shared/leaderboard/types";

const fail = (status: number, error: string) => Response.json({ error } satisfies ApiError, { status });

/** 이 플레이어(토큰)가 올린 기록의 지금 순위. 랭킹 페이지의 '나의 기록'에서 써요. */
export async function GET(req: Request) {
  const playerId = await playerFrom(req);
  if (!playerId) return fail(401, "플레이어 토큰이 없거나 맞지 않아요.");
  return Response.json((await myRanks(playerId)) satisfies MyRanks);
}

/**
 * 이 플레이어가 올린 기록 하나를 지워요(`?career=<브라우저 커리어 id>`). '나의 기록'에서 선수 기록을 지울 때 불러요.
 * 이미 지웠거나 올라간 적이 없는 기록이어도 200에 deleted: false예요. 다른 플레이어의 기록은 지우지 않아요.
 */
export async function DELETE(req: Request) {
  const playerId = await playerFrom(req);
  if (!playerId) return fail(401, "플레이어 토큰이 없거나 맞지 않아요.");
  const careerId = new URL(req.url).searchParams.get("career");
  if (!isCareerId(careerId)) return fail(400, "커리어 id가 맞지 않아요.");
  const deleted = await deleteCareer(playerId, careerId);
  // 순위표에서 바로 빠지게 서버 캐시를 비워요. 지운 브라우저는 CDN 캐시도 건너뛰어 불러요(shared/leaderboard/cdn.ts).
  if (deleted) revalidateTag(BOARDS_TAG, { expire: 0 });
  return Response.json({ deleted } satisfies DeleteResult);
}
