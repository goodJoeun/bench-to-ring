import "server-only";
import { and, count, eq, sql, type SQL } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { POS_KEYS, TEAMS, type LookRecord, type PosKey } from "@/game";
import type { Board, BoardDay, BoardEntry, BoardScope, MyRanks } from "@/lib/leaderboard/types";
import { db } from "./db";
import { careers } from "./schema";

// 순위표 (docs/online-leaderboard.md 3장 순위 계산, 6장 API). 1단계는 검증 전 기록도 함께 세요.

/** 순위표 캐시 태그. 기록이 제출되면 이 태그를 비워요. */
export const BOARDS_TAG = "boards";

const TOP = 100;
const POS_TOP = 50;
const NBA_TEAMS = TEAMS.nba.map(([name]) => name);

// compareCareers와 같은 순서 (랭킹 점수 → NBA MVP → 최고 오버롤 → 통산 득점). 네 값이 모두 같으면 공동 순위예요.
const order = sql`${careers.score} desc, ${careers.mvp} desc, ${careers.peak} desc, ${careers.pts} desc`;

/** 범위와 날짜 조건. 날짜는 기록이 올라온 한국 시간 날짜로 봐요. */
export function inScope(scope: BoardScope, day: BoardDay = null): SQL | undefined {
  return and(
    scope === "all" ? undefined : eq(careers.ruleset, scope.ruleset),
    day ? sql`(${careers.createdAt} at time zone 'Asia/Seoul')::date = ${day}::date` : undefined,
  );
}

const award = (k: string) => sql<number>`coalesce((${careers.summary}->'awards'->>${k})::int, 0)`;

function ranked(scope: BoardScope, day: BoardDay = null) {
  return db()
    .$with("ranked")
    .as(
      db()
        .select({
          id: careers.id,
          playerId: careers.playerId,
          careerId: careers.careerId,
          name: careers.name,
          num: careers.num,
          pos: careers.pos,
          score: careers.score,
          mvp: careers.mvp,
          fmvp: award("fmvp").as("fmvp"),
          leagueMvp: award("mvp").as("league_mvp"),
          peak: careers.peak,
          personal: careers.personal,
          pts: careers.pts,
          reb: careers.reb,
          ast: careers.ast,
          rings: careers.rings,
          seasons: careers.seasons,
          legacy: careers.legacy,
          team: sql<string | null>`${careers.summary}->'teams'->> -1`.as("team"),
          look: sql<LookRecord | null>`${careers.summary}->'look'`.as("look"),
          ruleset: careers.ruleset,
          verified: careers.verified,
          createdAt: careers.createdAt,
          rank: sql<number>`(rank() over (order by ${order}))::int`.as("rank"),
          posRank: sql<number>`(rank() over (partition by ${careers.pos} order by ${order}))::int`.as("pos_rank"),
        })
        .from(careers)
        .where(inScope(scope, day)),
    );
}

type RankedRow = Omit<BoardEntry, "pos"> & { pos: string; playerId: string; careerId: string; createdAt: Date };

/** 플레이어와 정렬에만 쓰는 값은 내보내지 않아요. */
function toEntry(r: RankedRow): BoardEntry {
  return {
    id: r.id,
    rank: r.rank,
    posRank: r.posRank,
    name: r.name,
    num: r.num,
    pos: r.pos as PosKey,
    score: r.score,
    mvp: r.mvp,
    fmvp: r.fmvp,
    leagueMvp: r.leagueMvp,
    peak: r.peak,
    personal: r.personal,
    pts: r.pts,
    reb: r.reb,
    ast: r.ast,
    rings: r.rings,
    seasons: r.seasons,
    legacy: r.legacy,
    team: r.team,
    look: r.look,
    ruleset: r.ruleset,
    verified: r.verified,
  };
}

/** 순위표. 날짜를 고르면 그날 올라온 기록끼리 순위를 매겨요. 같은 조건은 캐시해 두고, 기록이 제출될 때만 다시 계산해요. */
export async function getBoard(scope: BoardScope, pos: PosKey | null, day: BoardDay): Promise<Board> {
  "use cache";
  cacheTag(BOARDS_TAG);
  // 제출 때 태그를 비우니 시간은 DB를 직접 고쳤을 때를 위한 안전장치예요.
  cacheLife("hours");

  const r = ranked(scope, day);
  const [top, best, [stats]] = await Promise.all([
    db()
      .with(r)
      .select()
      .from(r)
      .where(pos ? eq(r.pos, pos) : undefined)
      // 공동 순위 안에서는 먼저 올린 기록이 위에 와요.
      .orderBy(pos ? r.posRank : r.rank, r.createdAt)
      .limit(pos ? POS_TOP : TOP),
    db().with(r).selectDistinctOn([r.pos]).from(r).orderBy(r.pos, r.rank, r.createdAt),
    db()
      .select({
        careers: count(),
        nba: count(sql`case when ${careers.summary}->'teams' ?| array[${sql.join(
          NBA_TEAMS.map((t) => sql`${t}`),
          sql`, `,
        )}]::text[] then 1 end`),
        nbaMvp: count(sql`case when ${careers.mvp} > 0 then 1 end`),
      })
      .from(careers)
      .where(inScope(scope, day)),
  ]);

  const firsts = new Map(best.map((row) => [row.pos, toEntry(row)]));
  return {
    scope,
    day,
    pos,
    top: top.map(toEntry),
    best5: POS_KEYS.map((p) => ({ pos: p, career: firsts.get(p) ?? null })),
    stats,
  };
}

/** 한 플레이어가 올린 기록의 지금 순위 (역대 전체). 플레이어마다 달라서 캐시하지 않아요. */
export async function myRanks(playerId: string): Promise<MyRanks> {
  const scope = "all";
  const r = ranked(scope);
  const [mine, [{ total }]] = await Promise.all([
    db()
      .with(r)
      .select({ careerId: r.careerId, id: r.id, rank: r.rank, posRank: r.posRank, score: r.score })
      .from(r)
      .where(eq(r.playerId, playerId))
      .orderBy(r.rank),
    db().select({ total: count() }).from(careers).where(inScope(scope)),
  ]);
  return { total, careers: mine };
}
