import "server-only";
import { and, count, desc, eq, sql } from "drizzle-orm";
import { rankScore } from "@/game";
import type { SubmitResult } from "@/lib/leaderboard/types";
import { db } from "./db";
import { careers } from "./schema";
import type { SubmittedSummary } from "./validate";

/** 같은 플레이어는 이 간격 안에 다시 제출할 수 없어요. */
export const SUBMIT_INTERVAL_MS = 60_000;

/** 플레이어가 마지막으로 제출한 시각 */
export async function lastSubmittedAt(playerId: string): Promise<Date | null> {
  const [row] = await db()
    .select({ at: careers.createdAt })
    .from(careers)
    .where(eq(careers.playerId, playerId))
    .orderBy(desc(careers.createdAt))
    .limit(1);
  return row?.at ?? null;
}

/** 저장해요. 이미 제출한 커리어면 false예요. */
export async function insertCareer(playerId: string, s: SubmittedSummary): Promise<boolean> {
  const rows = await db()
    .insert(careers)
    .values({
      playerId,
      careerId: s.id,
      ruleset: s.ruleset,
      score: rankScore(s),
      name: s.name,
      num: s.num,
      pos: s.pos,
      mvp: s.mvp,
      peak: s.peak,
      personal: s.personal,
      pts: s.pts,
      reb: s.reb,
      ast: s.ast,
      rings: s.rings,
      seasons: s.seasons,
      retAge: s.retAge,
      legacy: s.legacy,
      summary: s,
    })
    .onConflictDoNothing({ target: [careers.playerId, careers.careerId] })
    .returning({ id: careers.id });
  return rows.length > 0;
}

/**
 * 역대 전체(룰셋을 가리지 않는) 순위와 포지션 순위. 순위표 화면과 같은 범위예요. compareCareers와 같은 순서
 * (랭킹 점수 → NBA MVP → 최고 오버롤 → 통산 득점)로, 네 값이 모두 같으면 공동 순위예요.
 */
export async function ranksOf(s: SubmittedSummary): Promise<SubmitResult> {
  const better = sql`(${careers.score}, ${careers.mvp}, ${careers.peak}, ${careers.pts}) > (${rankScore(s)}::float8, ${s.mvp}, ${s.peak}, ${s.pts})`;
  const samePos = eq(careers.pos, s.pos);
  const [row] = await db()
    .select({
      total: count(),
      above: count(sql`case when ${better} then 1 end`),
      posTotal: count(sql`case when ${samePos} then 1 end`),
      posAbove: count(sql`case when ${and(samePos, better)} then 1 end`),
    })
    .from(careers);
  return { pos: s.pos, rank: row.above + 1, total: row.total, posRank: row.posAbove + 1, posTotal: row.posTotal };
}
