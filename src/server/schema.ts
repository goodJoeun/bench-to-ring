import { sql } from "drizzle-orm";
import { boolean, check, index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import type { CareerSummary } from "@/game";

// 테이블 설계는 docs/online-leaderboard.md 3장을 따라요. 바꾸면 `npm run db:generate`로 마이그레이션을 만들어요.

/** 플레이어(기기). 지금은 익명 토큰, 나중에 Google 로그인을 연결해요. */
export const players = pgTable("players", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** 브라우저에 저장한 익명 토큰의 해시. 토큰 원문은 두지 않아요. */
  tokenHash: text("token_hash").notNull().unique(),
  nickname: text("nickname").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** 제출한 은퇴 기록. CareerSummary에서 순위·화면에 필요한 값만 따로 칸으로 둬요. */
export const careers = pgTable(
  "careers",
  {
    /** Career.id (같은 커리어는 한 번만) */
    id: text("id").primaryKey(),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id),
    ruleset: integer("ruleset").notNull(),
    /** 서버 재생 검증 통과 (2단계) */
    verified: boolean("verified").notNull().default(false),
    /** 저장 코드로 불러온 커리어 */
    imported: boolean("imported").notNull().default(false),
    name: text("name").notNull(),
    num: integer("num").notNull(),
    pos: text("pos").notNull(),
    /** NBA MVP */
    mvp: integer("mvp").notNull(),
    /** 최고 오버롤 */
    peak: integer("peak").notNull(),
    /** 개인상 수 */
    personal: integer("personal").notNull(),
    /** 프로 통산 득점 */
    pts: integer("pts").notNull(),
    reb: integer("reb").notNull(),
    ast: integer("ast").notNull(),
    rings: integer("rings").notNull(),
    /** 프로 시즌 */
    seasons: integer("seasons").notNull(),
    retAge: integer("ret_age").notNull(),
    /** 레거시 등급 문구 */
    legacy: text("legacy").notNull(),
    /** CareerSummary 전체 (화면 상세용) */
    summary: jsonb("summary").$type<CareerSummary>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("careers_pos_check", sql`${t.pos} in ('PG','SG','SF','PF','C')`),
    // 순위 정렬: compareCareers와 같은 순서 (NBA MVP → 최고 오버롤 → 개인상 → 통산 득점)
    index("careers_rank").on(t.ruleset, t.verified, t.mvp.desc(), t.peak.desc(), t.personal.desc(), t.pts.desc()),
    index("careers_pos_rank").on(
      t.ruleset,
      t.verified,
      t.pos,
      t.mvp.desc(),
      t.peak.desc(),
      t.personal.desc(),
      t.pts.desc(),
    ),
    // 내 기록 목록과 제출 횟수 제한 (플레이어마다 최근 제출 시각)
    index("careers_player").on(t.playerId, t.createdAt.desc()),
  ],
);
