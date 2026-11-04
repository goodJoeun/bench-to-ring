import { connection } from "next/server";
import { getBoardDays } from "@/server/boards";
import type { BoardDays } from "@/lib/leaderboard/types";

/** 날짜별 랭킹 등록 수: 최근 7일(한국 시간) 날짜마다, 그리고 올타임으로 올라온 기록 수와 그 기록을 올린 플레이어 수예요. 역대 전체 범위예요. */
export async function GET() {
  // 빌드 때 미리 만들지 않고 요청 때 캐시에서 꺼내요.
  await connection();
  return Response.json((await getBoardDays()) satisfies BoardDays);
}
