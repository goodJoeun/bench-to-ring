import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { achievementById } from "@/game";
import type { AchievementRates } from "@/shared/leaderboard/types";
import { db } from "../db/db";
import { achievementCounts, playerAchievements } from "../db/schema";

// 업적 달성률 (docs/achievement-tiers.md 2장). 은퇴 기록을 올릴 때 그 브라우저에서 딴 업적 id를 함께 받아 플레이어마다 한 번씩 넣고,
// 트리거가 업적별 플레이어 수(achievement_counts)를 맞춰요. 달성률은 그 집계 표만 읽어서, 기록이 늘어도 비용이 그대로예요.

/** 업적 목록을 보낸 플레이어 표시. 이 업적 id의 플레이어 수가 달성률의 분모예요. */
export const REPORTED_ACHV = "*";

/** 달성률 캐시 태그. 기록이 제출되면 낡은 것으로 쳐요. */
export const ACHIEVEMENTS_TAG = "achievements";

/** 플레이어가 딴 업적을 넣어요. 이미 넣은 업적은 건너뛰어요. ids는 parseAchievementIds로 거른 값이에요. */
export async function recordAchievements(playerId: string, ids: readonly string[]): Promise<void> {
  await db()
    .insert(playerAchievements)
    .values([REPORTED_ACHV, ...ids].map((achvId) => ({ playerId, achvId })))
    .onConflictDoNothing();
}

/** 업적마다 딴 플레이어 수와, 업적 목록을 보낸 플레이어 수. 없어진 업적과 아무도 따지 않은 업적은 빠져요. */
export async function getAchievementRates(): Promise<AchievementRates> {
  "use cache";
  cacheTag(ACHIEVEMENTS_TAG);
  // 제출 때 태그를 비우니 시간은 DB를 직접 고쳤을 때를 위한 안전장치예요(순위표와 같아요).
  cacheLife("days");

  const rows = await db().select().from(achievementCounts);
  const counts: Record<string, number> = {};
  let players = 0;
  for (const r of rows) {
    if (r.achvId === REPORTED_ACHV) players = r.players;
    else if (r.players > 0 && achievementById(r.achvId)) counts[r.achvId] = r.players;
  }
  return { players, counts };
}
