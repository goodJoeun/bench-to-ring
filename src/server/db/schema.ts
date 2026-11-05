import { sql } from "drizzle-orm";
import { boolean, check, doublePrecision, index, integer, jsonb, pgTable, primaryKey, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import type { CareerSummary } from "@/game";

// 테이블 설계는 docs/online-leaderboard.md 3장을 따라요. 바꾸면 `npm run db:generate`로 마이그레이션을 만들어요.

/** 플레이어(기기). 지금은 익명 토큰, 나중에 Google 로그인을 연결해요. 순위표에는 선수 이름만 보여서 닉네임은 없어요. */
export const players = pgTable("players", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** 브라우저에 저장한 익명 토큰의 해시. 토큰 원문은 두지 않아요. */
  tokenHash: text("token_hash").notNull().unique(),
  /** 올린 기록 수. careers 트리거가 맞춰 두고, 0에서 1이 될 때와 1에서 0이 될 때 career_totals.players를 바꿔요. */
  careers: integer("careers").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** 제출한 은퇴 기록. CareerSummary에서 순위·화면에 필요한 값만 따로 칸으로 둬요. */
export const careers = pgTable(
  "careers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id),
    /** 브라우저의 Career.id. 시작 시각이라 플레이어끼리는 겹칠 수 있어서, 플레이어마다 한 번만 받아요. */
    careerId: text("career_id").notNull(),
    ruleset: integer("ruleset").notNull(),
    /** 서버 재생 검증 통과 (2단계) */
    verified: boolean("verified").notNull().default(false),
    /** 선수 이름. 순위표에 그대로 공개해요. */
    name: text("name").notNull(),
    num: integer("num").notNull(),
    pos: text("pos").notNull(),
    /** 랭킹 점수 (rankScore). 순위는 이 점수 → NBA MVP → 최고 오버롤 → 통산 득점 순이에요. */
    score: doublePrecision("score").notNull().default(0),
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
    /** 프로 통산 스틸·블록·3점슛. 예전 기록에는 없어요(null). */
    stl: integer("stl"),
    blk: integer("blk"),
    tpm: integer("tpm"),
    /** 기부한 돈 합계 (억). 기부하지 않았으면 null이에요. */
    donated: doublePrecision("donated"),
    /** NBA 팀에서 뛰어 봤는지 (playedNba) */
    nba: boolean("nba").notNull().default(false),
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
    unique("careers_player_career").on(t.playerId, t.careerId),
    // 순위 정렬과 '나보다 높은 기록 수' 세기: compareCareers와 같은 순서 (랭킹 점수 → NBA MVP → 최고 오버롤 → 통산 득점),
    // 공동 순위 안에서는 먼저 올린 기록이 위예요. 화면은 역대 전체라 ruleset으로 시작하지 않아요.
    // drizzle은 desc()를 DESC NULLS LAST로 만들어서, 쿼리도 같은 순서로 적어야 인덱스 순서로 읽어요(boards.ts의 order).
    index("careers_rank").on(t.score.desc(), t.mvp.desc(), t.peak.desc(), t.pts.desc(), t.createdAt),
    index("careers_pos_rank").on(t.pos, t.score.desc(), t.mvp.desc(), t.peak.desc(), t.pts.desc(), t.createdAt),
    // 날짜별 순위표와 날짜별 등록 수
    index("careers_created").on(t.createdAt),
    // 스탯 랭킹. 값이 없는 기록은 순위에서 빠져서 인덱스에도 넣지 않아요.
    index("careers_pts").on(t.pts.desc(), t.createdAt),
    index("careers_reb").on(t.reb.desc(), t.createdAt),
    index("careers_ast").on(t.ast.desc(), t.createdAt),
    index("careers_stl").on(t.stl.desc(), t.createdAt).where(sql`${t.stl} is not null`),
    index("careers_blk").on(t.blk.desc(), t.createdAt).where(sql`${t.blk} is not null`),
    index("careers_tpm").on(t.tpm.desc(), t.createdAt).where(sql`${t.tpm} is not null`),
    index("careers_donated").on(t.donated.desc(), t.createdAt).where(sql`${t.donated} is not null`),
    // 내 기록 목록과 제출 횟수 제한 (플레이어마다 최근 제출 시각)
    index("careers_player").on(t.playerId, t.createdAt.desc()),
  ],
);

/**
 * 룰셋·포지션마다 올라온 커리어 수. careers 트리거(drizzle/0004_scale.sql)가 기록을 넣고 뺄 때 맞춰 둬서,
 * 전체 수와 통계를 셀 때 careers를 훑지 않아요.
 */
export const careerCounts = pgTable(
  "career_counts",
  {
    ruleset: integer("ruleset").notNull(),
    pos: text("pos").notNull(),
    careers: integer("careers").notNull().default(0),
    /** NBA 팀에서 뛰어 본 커리어 */
    nba: integer("nba").notNull().default(0),
    /** NBA MVP를 한 번이라도 받은 커리어 */
    nbaMvp: integer("nba_mvp").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.ruleset, t.pos] })],
);

/** 기록을 한 번이라도 올린 플레이어 수 (한 줄). careers 트리거가 맞춰 둬요. */
export const careerTotals = pgTable(
  "career_totals",
  {
    id: integer("id").primaryKey().default(1),
    players: integer("players").notNull().default(0),
  },
  (t) => [check("career_totals_one_row", sql`${t.id} = 1`)],
);
