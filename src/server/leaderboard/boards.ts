import "server-only";
import { and, count, countDistinct, eq, gte, lt, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { cacheLife, cacheTag } from "next/cache";
import { POS_KEYS, type LookRecord, type PosKey } from "@/game";
import { DAY_COUNT } from "@/shared/leaderboard/days";
import type { Board, BoardDay, BoardDays, BoardEntry, BoardScope, MyRanks } from "@/shared/leaderboard/types";
import { db } from "../db/db";
import { careerCounts, careerTotals, careers } from "../db/schema";

// 순위표 (docs/online-leaderboard.md 3장 순위 계산, 6장 API). 1단계는 검증 전 기록도 함께 세요.
// 기록이 많아져도 전체를 훑지 않게, 상위 N개는 순위 인덱스(careers_rank, careers_pos_rank)로 읽고
// 순위는 '나보다 높은 기록 수 + 1'을 같은 인덱스로 세요. 올타임 전체 수와 통계는 career_counts·career_totals에서 읽어요.

/** 순위표 캐시 태그. 기록이 제출되면 이 태그를 비워요. */
export const BOARDS_TAG = "boards";

const TOP = 100;
const POS_TOP = 50;
const DAY_MS = 86_400_000;

/** 순위를 셀 때 견주는 다른 기록 */
export const other = alias(careers, "other");

/** 그날(한국 시간) 0시부터 다음 날 0시 전까지. 칸에 계산을 씌우지 않고 범위로 견줘야 careers_created 인덱스를 써요. */
function dayRange(day: string): [Date, Date] {
  const start = new Date(`${day}T00:00:00+09:00`);
  return [start, new Date(start.getTime() + DAY_MS)];
}

/** 범위와 날짜 조건. 날짜는 기록이 올라온 한국 시간 날짜로 봐요. */
export function inScope(scope: BoardScope, day: BoardDay = null, t: typeof careers | typeof other = careers): SQL | undefined {
  const range = day ? dayRange(day) : null;
  return and(
    scope === "all" ? undefined : eq(t.ruleset, scope.ruleset),
    range ? and(gte(t.createdAt, range[0]), lt(t.createdAt, range[1])) : undefined,
  );
}

// compareCareers와 같은 순서 (랭킹 점수 → NBA MVP → 최고 오버롤 → 통산 득점), 공동 순위 안에서는 먼저 올린 기록이 위예요.
// 인덱스가 DESC NULLS LAST라서 똑같이 적어야 인덱스 순서로 읽어요.
const order = sql`${careers.score} desc nulls last, ${careers.mvp} desc nulls last, ${careers.peak} desc nulls last, ${careers.pts} desc nulls last, ${careers.createdAt}`;

/** 조건에 맞는 다른 기록 수 + 1. 같은 값끼리는 같은 순위라 rank()와 같아요. */
export function countAbove(where: SQL | undefined): SQL<number> {
  return sql<number>`(${db().select({ n: count() }).from(other).where(where)})::int + 1`;
}

/**
 * 이 기록의 순위: 같은 범위·날짜(포지션 순위면 같은 포지션)에서 네 값이 더 높은 기록 수 + 1이에요.
 * 행 비교 `(a, b, c, d) > (...)`를 순위 인덱스로 세서, 비용이 순위만큼만 들어요.
 */
export function rankOf(scope: BoardScope, day: BoardDay, samePos: boolean): SQL<number> {
  const better = sql`(${other.score}, ${other.mvp}, ${other.peak}, ${other.pts}) > (${careers.score}, ${careers.mvp}, ${careers.peak}, ${careers.pts})`;
  return countAbove(and(inScope(scope, day, other), samePos ? eq(other.pos, careers.pos) : undefined, better));
}

/** 올타임 커리어 수와 통계, 포지션마다 센 커리어 수 */
export async function allTimeCounts(scope: BoardScope) {
  const rows = await db()
    .select({
      pos: careerCounts.pos,
      careers: sql<number>`sum(${careerCounts.careers})::int`,
      nba: sql<number>`sum(${careerCounts.nba})::int`,
      nbaMvp: sql<number>`sum(${careerCounts.nbaMvp})::int`,
    })
    .from(careerCounts)
    .where(scope === "all" ? undefined : eq(careerCounts.ruleset, scope.ruleset))
    .groupBy(careerCounts.pos);
  const sum = (k: "careers" | "nba" | "nbaMvp") => rows.reduce((t, r) => t + r[k], 0);
  return {
    stats: { careers: sum("careers"), nba: sum("nba"), nbaMvp: sum("nbaMvp") },
    byPos: (pos: string) => rows.find((r) => r.pos === pos)?.careers ?? 0,
  };
}

/** 순위표의 전체 통계. 날짜를 고르면 그날 기록만 세요 (careers_created 인덱스로 그날 줄만 읽어요). */
async function boardStats(scope: BoardScope, day: BoardDay): Promise<Board["stats"]> {
  if (!day) return (await allTimeCounts(scope)).stats;
  const [row] = await db()
    .select({
      careers: count(),
      nba: count(sql`case when ${careers.nba} then 1 end`),
      nbaMvp: count(sql`case when ${careers.mvp} > 0 then 1 end`),
    })
    .from(careers)
    .where(inScope(scope, day));
  return row;
}

/** 순위표 줄. 은퇴 요약에서 꺼내는 값은 고른 줄에서만 읽어요. */
function entries(scope: BoardScope, day: BoardDay, pos: PosKey | null, limit: number): Promise<BoardEntry[]> {
  return db()
    .select({
      id: careers.id,
      rank: rankOf(scope, day, false),
      posRank: rankOf(scope, day, true),
      name: careers.name,
      num: careers.num,
      pos: sql<PosKey>`${careers.pos}`,
      score: careers.score,
      mvp: careers.mvp,
      fmvp: sql<number>`coalesce((${careers.summary}->'awards'->>'fmvp')::int, 0)`,
      leagueMvp: sql<number>`coalesce((${careers.summary}->'awards'->>'mvp')::int, 0)`,
      peak: careers.peak,
      personal: careers.personal,
      pts: careers.pts,
      reb: careers.reb,
      ast: careers.ast,
      rings: careers.rings,
      seasons: careers.seasons,
      legacy: careers.legacy,
      team: sql<string | null>`${careers.summary}->'teams'->> -1`,
      look: sql<LookRecord | null>`${careers.summary}->'look'`,
      ruleset: careers.ruleset,
      verified: careers.verified,
    })
    .from(careers)
    .where(and(inScope(scope, day), pos ? eq(careers.pos, pos) : undefined))
    .orderBy(order)
    .limit(limit);
}

/** 순위표. 날짜를 고르면 그날 올라온 기록끼리 순위를 매겨요. 같은 조건은 캐시해 두고, 기록이 제출될 때만 다시 계산해요. */
export async function getBoard(scope: BoardScope, pos: PosKey | null, day: BoardDay): Promise<Board> {
  "use cache";
  cacheTag(BOARDS_TAG);
  // 제출 때 태그를 비우니 시간은 DB를 직접 고쳤을 때를 위한 안전장치예요.
  cacheLife("hours");

  const [top, firsts, stats] = await Promise.all([
    entries(scope, day, pos, pos ? POS_TOP : TOP),
    // 포지션마다 1위 한 줄씩: 포지션 순위 인덱스의 맨 앞이에요.
    Promise.all(POS_KEYS.map((p) => entries(scope, day, p, 1))),
    boardStats(scope, day),
  ]);

  return {
    scope,
    day,
    pos,
    top,
    best5: POS_KEYS.map((p, i) => ({ pos: p, career: firsts[i][0] ?? null })),
    stats,
  };
}

/** 최근 DAY_COUNT일(한국 시간)의 날짜별 등록 수와 올타임 등록 수·포지션별 기록 수 (역대 전체). 순위표처럼 캐시하고 제출 때 비워요. */
export async function getBoardDays(): Promise<BoardDays> {
  "use cache";
  cacheTag(BOARDS_TAG);
  cacheLife("hours");

  const day = sql<string>`to_char(${careers.createdAt} at time zone 'Asia/Seoul', 'YYYY-MM-DD')`;
  // 한국 시간으로 (DAY_COUNT - 1)일 전 0시부터예요. 캐시가 자정을 넘겨도 화면은 자기 날짜만 골라 써요.
  const since = sql`(date_trunc('day', now() at time zone 'Asia/Seoul') - ${DAY_COUNT - 1}::int * interval '1 day') at time zone 'Asia/Seoul'`;
  const [days, { stats, byPos }, [totals]] = await Promise.all([
    db()
      .select({ day: day.as("day"), careers: count(), players: countDistinct(careers.playerId) })
      .from(careers)
      .where(sql`${careers.createdAt} >= ${since}`)
      .groupBy(day)
      .orderBy(sql`day desc`),
    allTimeCounts("all"),
    db().select({ players: careerTotals.players }).from(careerTotals),
  ]);
  return {
    days,
    all: { careers: stats.careers, players: totals?.players ?? 0 },
    byPos: Object.fromEntries(POS_KEYS.map((p) => [p, byPos(p)])) as Record<PosKey, number>,
  };
}

/** 한 플레이어가 올린 기록의 지금 순위 (역대 전체). 플레이어마다 달라서 캐시하지 않아요. */
export async function myRanks(playerId: string): Promise<MyRanks> {
  const scope = "all";
  const [mine, { stats }] = await Promise.all([
    db()
      .select({
        careerId: careers.careerId,
        id: careers.id,
        rank: rankOf(scope, null, false),
        posRank: rankOf(scope, null, true),
        score: careers.score,
      })
      .from(careers)
      .where(eq(careers.playerId, playerId))
      .orderBy(order),
    allTimeCounts(scope),
  ]);
  return { total: stats.careers, careers: mine };
}
