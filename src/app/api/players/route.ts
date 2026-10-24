import { createPlayer } from "@/server/auth";
import type { PlayerCreated } from "@/lib/leaderboard/types";

/** 익명 플레이어 만들기. 돌려준 토큰은 브라우저에 저장해 두고 기록을 제출할 때 보내요. */
export async function POST() {
  const token = await createPlayer();
  return Response.json({ token } satisfies PlayerCreated, { status: 201 });
}
