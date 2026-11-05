import "server-only";
import { and, isNotNull, sql } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import type { LookRecord } from "@/game";
import type { BoardDay, BoardScope, StatBoard, StatEntry, StatKey } from "@/shared/leaderboard/types";
import { BOARDS_TAG, countAbove, inScope, other } from "./boards";
import { db } from "../db/db";
import { careers } from "../db/schema";

// 스탯 랭킹: 프로 통산 기록으로 줄을 세워요. 순위표와 같은 캐시 태그를 써서 기록이 제출되면 함께 비워요.
// 스탯마다 칸과 인덱스(careers_pts 등)가 있어서 상위 50명만 읽고, 순위도 그 인덱스로 '값이 더 큰 기록 수 + 1'을 세요.

const STAT_TOP = 50;

/**
 * 스탯마다 읽는 칸. 스틸·블록·3점슛이 없는 예전 기록과 기부하지 않은 커리어는 null이라 순위에서 빠져요.
 * 기부금(억)은 소수예요.
 */
const STAT_COLUMN = { pts: "pts", reb: "reb", ast: "ast", stl: "stl", blk: "blk", tpm: "tpm", don: "donated" } as const satisfies Record<StatKey, keyof typeof careers.$inferSelect>;

/** 스탯 랭킹. 날짜를 고르면 그날 올라온 기록끼리 줄을 세워요. 같은 조건은 캐시해 두고, 기록이 제출될 때만 다시 계산해요. */
export async function getStatBoard(scope: BoardScope, stat: StatKey, day: BoardDay): Promise<StatBoard> {
  "use cache";
  cacheTag(BOARDS_TAG);
  cacheLife("hours");

  const col = STAT_COLUMN[stat];
  const value = careers[col];
  const rows = await db()
    .select({
      id: careers.id,
      name: careers.name,
      num: careers.num,
      pos: sql<StatEntry["pos"]>`${careers.pos}`,
      value: sql<number>`${value}`,
      gp: sql<number>`coalesce((${careers.summary}->>'gp')::int, 0)`,
      team: sql<string | null>`${careers.summary}->'teams'->> -1`,
      look: sql<LookRecord | null>`${careers.summary}->'look'`,
      rank: countAbove(and(inScope(scope, day, other), sql`${other[col]} > ${value}`)),
    })
    .from(careers)
    .where(and(inScope(scope, day), isNotNull(value)))
    // 인덱스가 DESC NULLS LAST라 똑같이 적어요. 공동 순위 안에서는 먼저 올린 기록이 위에 와요.
    .orderBy(sql`${value} desc nulls last`, careers.createdAt)
    .limit(STAT_TOP);

  return { scope, day, stat, top: rows };
}
