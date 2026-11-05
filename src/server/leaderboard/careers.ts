import "server-only";
import { desc, eq } from "drizzle-orm";
import type { PosKey } from "@/game";
import type { SubmitResult } from "@/shared/leaderboard/types";
import { allTimeCounts, rankOf } from "./boards";
import { derivedColumns } from "./columns";
import { db } from "../db/db";
import { careers } from "../db/schema";
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

/** 저장하고 기록 id를 돌려줘요. 이미 제출한 커리어면 null이에요. */
export async function insertCareer(playerId: string, s: SubmittedSummary): Promise<string | null> {
  const rows = await db()
    .insert(careers)
    .values({
      playerId,
      careerId: s.id,
      ruleset: s.ruleset,
      ...derivedColumns(s),
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
  return rows[0]?.id ?? null;
}

/**
 * 저장한 기록의 역대 전체(룰셋을 가리지 않는) 순위와 포지션 순위. 순위표 화면과 같은 범위예요. compareCareers와 같은 순서
 * (랭킹 점수 → NBA MVP → 최고 오버롤 → 통산 득점)로, 네 값이 모두 같으면 공동 순위예요.
 */
export async function ranksOf(id: string): Promise<SubmitResult> {
  const scope = "all";
  const [[row], counts] = await Promise.all([
    db()
      .select({ pos: careers.pos, rank: rankOf(scope, null, false), posRank: rankOf(scope, null, true) })
      .from(careers)
      .where(eq(careers.id, id)),
    allTimeCounts(scope),
  ]);
  return { pos: row.pos as PosKey, rank: row.rank, total: counts.stats.careers, posRank: row.posRank, posTotal: counts.byPos(row.pos) };
}
