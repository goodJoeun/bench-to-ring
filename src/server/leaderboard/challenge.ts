import "server-only";
import { sql, type SQL } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { POS_KEYS, type PosKey } from "@/game";
import type { ChallengeBoard, ChallengeEntry, ChallengePosBoard, ChallengeStanding } from "@/shared/leaderboard/types";
import { BOARDS_TAG } from "./boards";
import { db } from "../db/db";

// 챌린지 순위표: 같은 날 같은 포지션은 모두 같은 선수로 시작해요(game/player/challenge.ts).
// 그날 그 포지션의 기록끼리만 줄을 세우고, 한 플레이어가 여러 번 도전했으면 가장 좋은 기록 하나만 순위에 넣어요.
// 순서는 일반 랭킹과 같아요 (랭킹 점수 → NBA MVP → 최고 오버롤 → 통산 득점, 모두 같으면 공동 순위).
// 하루치 챌린지 기록만 읽어서(careers_challenge 인덱스) 기록 전체가 늘어도 비용은 그날 도전 수만큼이에요.

const TOP = 50;

/**
 * 그날 챌린지 기록을 플레이어·포지션마다 가장 좋은 하나(k = 1)로 줄이고, 포지션 안에서 순위를 매긴 표 `ranked`.
 * tries는 그 플레이어의 도전 횟수, players와 runs는 그 포지션의 플레이어 수와 기록 수예요.
 */
const ranked = (day: string): SQL => sql`
  with runs as (
    select c.*,
      row_number() over (partition by c.player_id, c.challenge_pos order by c.score desc, c.mvp desc, c.peak desc, c.pts desc, c.created_at) as k,
      count(*) over (partition by c.player_id, c.challenge_pos) as tries
    from careers c
    where c.challenge_day = ${day}
  ), ranked as (
    select r.*,
      rank() over (partition by r.challenge_pos order by r.score desc, r.mvp desc, r.peak desc, r.pts desc) as rank,
      row_number() over (partition by r.challenge_pos order by r.score desc, r.mvp desc, r.peak desc, r.pts desc, r.created_at) as rn,
      count(*) over (partition by r.challenge_pos) as players,
      sum(r.tries) over (partition by r.challenge_pos) as runs
    from runs r
    where r.k = 1
  )`;

/** 드라이버마다 다른 결과 모양(postgres.js는 줄 배열, 테스트의 PGlite는 { rows })을 줄 배열로 맞춰요. */
async function rowsOf<T>(q: SQL): Promise<T[]> {
  const res: unknown = await db().execute(q);
  return Array.isArray(res) ? (res as T[]) : (res as { rows: T[] }).rows;
}

type TopRow = Omit<ChallengeEntry, "posRank"> & { cpos: PosKey; players: number; runs: number };

/** 그날 챌린지의 포지션별 순위표. 일반 순위표처럼 캐시해 두고, 기록이 올라오거나 지워질 때만 다시 계산해요. */
export async function getChallengeBoard(day: string): Promise<ChallengeBoard> {
  "use cache";
  cacheTag(BOARDS_TAG);
  cacheLife("days");

  const rows = await rowsOf<TopRow>(sql`${ranked(day)}
    select id, challenge_pos as cpos, rank::int as rank, players::int as players, runs::int as runs, tries::int as tries,
      name, num, pos, score, mvp,
      coalesce((summary->'awards'->>'fmvp')::int, 0) as fmvp,
      coalesce((summary->'awards'->>'mvp')::int, 0) as "leagueMvp",
      peak, personal, pts, reb, ast, rings, seasons, legacy,
      summary->'teams'->> -1 as team, summary->'look' as look, ruleset, verified
    from ranked
    where rn <= ${TOP}
    order by challenge_pos, rn`);

  const boards = Object.fromEntries(POS_KEYS.map((p) => [p, { top: [], players: 0, runs: 0 }])) as unknown as Record<PosKey, ChallengePosBoard>;
  for (const { cpos, players, runs, ...e } of rows) {
    const b = boards[cpos];
    if (!b) continue;
    b.players = players;
    b.runs = runs;
    b.top.push({ ...e, posRank: e.rank });
  }
  return { day, boards };
}

/** 한 플레이어의 그날 챌린지 성적: 도전한 포지션마다 가장 좋은 기록과 그 순위. 플레이어마다 달라서 캐시하지 않아요. */
export function myChallenge(playerId: string, day: string): Promise<ChallengeStanding[]> {
  return rowsOf<ChallengeStanding>(sql`${ranked(day)}
    select challenge_pos as pos, id, career_id as "careerId", rank::int as rank, players::int as players, tries::int as tries, score
    from ranked
    where player_id = ${playerId}::uuid
    order by challenge_pos`);
}
