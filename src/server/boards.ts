import "server-only";
import { count, eq, sql, type SQL } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { POS_KEYS, TEAMS, type PosKey } from "@/game";
import type { Board, BoardEntry, BoardScope } from "@/lib/leaderboard/types";
import { db } from "./db";
import { careers } from "./schema";

// 순위표 (docs/online-leaderboard.md 3장 순위 계산, 6장 API). 1단계는 검증 전 기록도 함께 세요.

/** 순위표 캐시 태그. 기록이 제출되면 이 태그를 비워요. */
export const BOARDS_TAG = "boards";

const TOP = 50;
const POS_TOP = 20;
const NBA_TEAMS = TEAMS.nba.map(([name]) => name);

// compareCareers와 같은 순서 (NBA MVP → 최고 오버롤 → 개인상 → 통산 득점). 네 값이 모두 같으면 공동 순위예요.
const order = sql`${careers.mvp} desc, ${careers.peak} desc, ${careers.personal} desc, ${careers.pts} desc`;

function inScope(scope: BoardScope): SQL | undefined {
  return scope === "all" ? undefined : eq(careers.ruleset, scope.ruleset);
}

function ranked(scope: BoardScope) {
  return db()
    .$with("ranked")
    .as(
      db()
        .select({
          id: careers.id,
          name: careers.name,
          num: careers.num,
          pos: careers.pos,
          mvp: careers.mvp,
          peak: careers.peak,
          personal: careers.personal,
          pts: careers.pts,
          reb: careers.reb,
          ast: careers.ast,
          rings: careers.rings,
          seasons: careers.seasons,
          legacy: careers.legacy,
          ruleset: careers.ruleset,
          verified: careers.verified,
          createdAt: careers.createdAt,
          rank: sql<number>`(rank() over (order by ${order}))::int`.as("rank"),
          posRank: sql<number>`(rank() over (partition by ${careers.pos} order by ${order}))::int`.as("pos_rank"),
        })
        .from(careers)
        .where(inScope(scope)),
    );
}

type RankedRow = Omit<BoardEntry, "pos"> & { pos: string; createdAt: Date };

/** 정렬에만 쓰는 제출 시각은 빼요. */
function toEntry(r: RankedRow): BoardEntry {
  return {
    id: r.id,
    rank: r.rank,
    posRank: r.posRank,
    name: r.name,
    num: r.num,
    pos: r.pos as PosKey,
    mvp: r.mvp,
    peak: r.peak,
    personal: r.personal,
    pts: r.pts,
    reb: r.reb,
    ast: r.ast,
    rings: r.rings,
    seasons: r.seasons,
    legacy: r.legacy,
    ruleset: r.ruleset,
    verified: r.verified,
  };
}

/** 순위표. 같은 조건은 캐시해 두고, 기록이 제출될 때만 다시 계산해요. */
export async function getBoard(scope: BoardScope, pos: PosKey | null): Promise<Board> {
  "use cache";
  cacheTag(BOARDS_TAG);
  // 제출 때 태그를 비우니 시간은 DB를 직접 고쳤을 때를 위한 안전장치예요.
  cacheLife("hours");

  const r = ranked(scope);
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
      .where(inScope(scope)),
  ]);

  const firsts = new Map(best.map((row) => [row.pos, toEntry(row)]));
  return {
    scope,
    pos,
    top: top.map(toEntry),
    best5: POS_KEYS.map((p) => ({ pos: p, career: firsts.get(p) ?? null })),
    stats,
  };
}
