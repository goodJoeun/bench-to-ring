import { playerFrom } from "@/server/auth";
import { myAround } from "@/server/leaderboard/boards";
import { isCareerId } from "@/server/leaderboard/validate";
import type { ApiError, MyAround } from "@/shared/leaderboard/types";

const fail = (status: number, error: string) => Response.json({ error } satisfies ApiError, { status });

/** 내 기록 하나(`?career=<브라우저 커리어 id>`)와 바로 위아래 기록. '나의 기록'에서 주변 순위를 열 때 불러요. */
export async function GET(req: Request) {
  const playerId = await playerFrom(req);
  if (!playerId) return fail(401, "플레이어 토큰이 없거나 맞지 않아요.");
  const careerId = new URL(req.url).searchParams.get("career");
  if (!isCareerId(careerId)) return fail(400, "커리어 id가 맞지 않아요.");
  const around = await myAround(playerId, careerId);
  if (!around) return fail(404, "이 플레이어의 기록이 아니에요.");
  return Response.json(around satisfies MyAround);
}
