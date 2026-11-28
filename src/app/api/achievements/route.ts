import { connection } from "next/server";
import { getAchievementRates } from "@/server/leaderboard/achievements";
import { BOARD_CACHE_CONTROL } from "@/shared/leaderboard/cdn";
import type { AchievementRates, ApiError } from "@/shared/leaderboard/types";

/** 업적 달성률: 업적마다 딴 플레이어 수와 업적 목록을 보낸 플레이어 수예요. 업적 창을 열 때만 불러요. */
export async function GET() {
  // 빌드 때 미리 만들지 않고 요청 때 캐시에서 꺼내요.
  await connection();
  try {
    // 순위표처럼 CDN이 잠깐 들고 있다가 내줘요(shared/leaderboard/cdn.ts).
    return Response.json((await getAchievementRates()) satisfies AchievementRates, { headers: { "cache-control": BOARD_CACHE_CONTROL } });
  } catch (e) {
    console.error("업적 달성률을 불러오지 못했어요.", e);
    // 달성률 표가 아직 없는(마이그레이션 전) 배포에서도 업적 창은 달성률 없이 열려요.
    return Response.json({ error: "업적 달성률을 불러오지 못했어요." } satisfies ApiError, { status: 503 });
  }
}
