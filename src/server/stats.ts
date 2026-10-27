import "server-only";
import { and, sql, type SQL } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import type { LookRecord } from "@/game";
import type { BoardScope, StatBoard, StatEntry, StatKey } from "@/lib/leaderboard/types";
import { BOARDS_TAG, inScope } from "./boards";
import { db } from "./db";
import { careers } from "./schema";

// 스탯 랭킹: 프로 통산 기록으로 줄을 세워요. 순위표와 같은 캐시 태그를 써서 기록이 제출되면 함께 비워요.

const STAT_TOP = 50;

/**
 * 스탯 값. 득점·리바운드·어시스트는 칸에, 스틸·블록·3점슛은 은퇴 요약(summary)에 있어요.
 * 스틸·블록·3점슛이 없는 예전 기록은 null이라 순위에서 빠져요.
 */
function statValue(stat: StatKey): SQL<number | null> {
  if (stat === "pts" || stat === "reb" || stat === "ast") return sql`${careers[stat]}`;
  return sql`(${careers.summary}->>${stat})::int`;
}

/** 스탯 랭킹. 같은 조건은 캐시해 두고, 기록이 제출될 때만 다시 계산해요. */
export async function getStatBoard(scope: BoardScope, stat: StatKey): Promise<StatBoard> {
  "use cache";
  cacheTag(BOARDS_TAG);
  cacheLife("hours");

  const value = statValue(stat);
  const rows = await db()
    .select({
      id: careers.id,
      name: careers.name,
      num: careers.num,
      pos: careers.pos,
      value: sql<number>`${value}`,
      gp: sql<number>`coalesce((${careers.summary}->>'gp')::int, 0)`,
      team: sql<string | null>`${careers.summary}->'teams'->> -1`,
      look: sql<LookRecord | null>`${careers.summary}->'look'`,
      rank: sql<number>`(rank() over (order by ${value} desc))::int`,
    })
    .from(careers)
    .where(and(inScope(scope), sql`${value} is not null`))
    // 공동 순위 안에서는 먼저 올린 기록이 위에 와요.
    .orderBy(sql`${value} desc`, careers.createdAt)
    .limit(STAT_TOP);

  return { scope, stat, top: rows.map((r) => ({ ...r, pos: r.pos as StatEntry["pos"] })) };
}
