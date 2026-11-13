import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  ARCHETYPES,
  POS_KEYS,
  chooseOption,
  createCareer,
  currentDecision,
  generateCandidate,
  resetRandom,
  seeded,
  setRandom,
  simulateSeason,
  type Career,
  type CareerSummary,
} from "@/game";
import { kstDay } from "@/shared/leaderboard/days";
import { STAT_KEYS } from "@/shared/leaderboard/types";
import * as schema from "../../db/schema";
import { checkSummary, type SubmittedSummary } from "../validate";

// 순위표·스탯 랭킹·내 순위 쿼리를 실제 Postgres(PGlite, WASM)에 drizzle/의 마이그레이션을 차례로 넣고 돌려 봐요.
// 기준값은 rank() over로 전체를 줄 세운 결과예요. 인덱스로 읽는 쿼리가 그와 같은 순위를 내는지, 집계 트리거가 맞는지 봐요.

const pg = new PGlite();
const queries: { sql: string; params: unknown[] }[] = [];
const testDb = drizzle(pg, { schema, logger: { logQuery: (q, params) => void queries.push({ sql: q, params }) } });

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ cacheTag: () => {}, cacheLife: () => {}, revalidateTag: () => {} }));
vi.mock("../../db/db", () => ({ db: () => testDb }));

const { getBoard, getBoardDays, myRanks } = await import("../boards");
const { insertCareer, ranksOf } = await import("../careers");
const { getStatBoard } = await import("../stats");

const PLAYERS = ["00000000-0000-0000-0000-00000000000a", "00000000-0000-0000-0000-00000000000b", "00000000-0000-0000-0000-00000000000c"];
const DAY_MS = 86_400_000;

function retiredSummaries(n: number): CareerSummary[] {
  const rand = seeded(505);
  setRandom(rand);
  const out: CareerSummary[] = [];
  for (let i = 0; i < n; i++) {
    const pos = POS_KEYS[i % POS_KEYS.length];
    const c: Career = createCareer(
      { name: `선수${i}`, num: i % 100, nat: "대한민국", pos, path: i % 2 ? "domestic" : "abroad" },
      generateCandidate(pos, i % ARCHETYPES[pos].length),
      `q${i}`,
    );
    for (let s = 0; c.stage !== "retired" && s < 300; s++) {
      if (c.queue.length) chooseOption(c, Math.floor(rand() * currentDecision(c)!.opts.length));
      else simulateSeason(c);
    }
    out.push(c.summary!);
  }
  resetRandom();
  return out;
}

const submitted = (s: CareerSummary): SubmittedSummary => {
  const r = checkSummary(s);
  if (!r.ok) throw new Error(r.error);
  return r.summary;
};

/** 마이그레이션 파일 하나를 넣어요. */
async function migrate(file: string) {
  for (const stmt of readFileSync(`drizzle/${file}`, "utf8").split("--> statement-breakpoint")) if (stmt.trim()) await pg.exec(stmt);
}

/** 기준값: 바꾸기 전 쿼리처럼 rank() over로 전체를 줄 세워요. */
async function truth(where = "true") {
  const order = "score desc, mvp desc, peak desc, pts desc";
  const { rows } = await pg.query<{ id: string; rank: number; pos_rank: number }>(
    `select id, (rank() over (order by ${order}))::int rank, (rank() over (partition by pos order by ${order}))::int pos_rank from careers where ${where}`,
  );
  return new Map(rows.map((r) => [r.id, r]));
}

const one = async <T,>(q: string) => (await pg.query<T>(q)).rows[0];

let summaries: CareerSummary[];

beforeAll(async () => {
  summaries = retiredSummaries(36);
  const files = readdirSync("drizzle").filter((f) => f.endsWith(".sql")).sort();
  for (const f of files.filter((f) => f < "0004")) await migrate(f);
  // 0004 전에 올라온 예전 기록: 새 칸은 마이그레이션이 은퇴 요약에서 채워야 해요.
  await pg.query(`insert into players (id, token_hash) values ($1, 'a'), ($2, 'b'), ($3, 'c')`, PLAYERS);
  for (const [i, s] of summaries.slice(0, 6).entries())
    await pg.query(
      `insert into careers (player_id, career_id, ruleset, name, num, pos, mvp, peak, personal, pts, reb, ast, rings, seasons, ret_age, legacy, summary, score)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)`,
      [PLAYERS[0], s.id, s.ruleset, s.name, s.num, s.pos, s.mvp, s.peak, s.personal, s.pts, s.reb, s.ast, s.rings, s.seasons, s.retAge, s.legacy,
        i === 0 ? { ...s, donated: 3.5, stl: 777 } : s, 0],
    );
  for (const f of files.filter((f) => f >= "0004")) await migrate(f);
  // 예전 기록의 점수는 db:rescore가 채우는 몫이라 여기서 맞춰 둬요.
  const { rankScore } = await import("@/game");
  for (const s of summaries.slice(0, 6)) await pg.query(`update careers set score = $1 where career_id = $2`, [rankScore(s), s.id]);

  // 새로 제출한 기록. 같은 요약을 다른 커리어 id로 올려 공동 순위를 만들고, 날짜와 룰셋을 나눠요.
  for (const [i, s] of summaries.slice(6).entries()) {
    expect(await insertCareer(PLAYERS[1 + (i % 2)], submitted(s))).toBeTruthy();
    if (i % 5 === 0) expect(await insertCareer(PLAYERS[2], submitted({ ...s, id: `${s.id}-tie` }))).toBeTruthy();
  }
  expect(await insertCareer(PLAYERS[1], submitted(summaries[10]))).toBeNull();
  const now = Date.now();
  await pg.query(`update careers set created_at = $1 where num % 3 = 1`, [new Date(now - DAY_MS)]);
  await pg.query(`update careers set created_at = $1 where num % 3 = 2`, [new Date(now - 10 * DAY_MS)]);
  await pg.query(`update careers set ruleset = ruleset + 1 where num % 4 = 0`);
}, 120_000);

afterAll(() => pg.close());

describe("마이그레이션 0004", () => {
  it("예전 기록의 스탯·기부금·NBA 진출 칸을 은퇴 요약에서 채워요", async () => {
    const old = summaries[0];
    const row = await one<{ stl: number; donated: number; nba: boolean }>(`select stl, donated, nba from careers where career_id = '${old.id}'`);
    const { playedNba } = await import("@/game");
    expect(row).toEqual({ stl: 777, donated: 3.5, nba: playedNba(old) });
  });
});

describe("순위표", () => {
  it("역대 전체 Top 100, 포지션 Top 50, 베스트 5가 rank() over와 같아요", async () => {
    const t = await truth();
    const board = await getBoard("all", null, null);
    expect(board.top.length).toBe(Math.min(100, t.size));
    for (const e of board.top) expect([e.rank, e.posRank]).toEqual([t.get(e.id)!.rank, t.get(e.id)!.pos_rank]);
    expect(board.top.map((e) => e.rank)).toEqual([...board.top].map((e) => e.rank).sort((a, b) => a - b));
    // 공동 순위가 실제로 있어요.
    expect(new Set(board.top.map((e) => e.rank)).size).toBeLessThan(board.top.length);
    for (const b of board.best5) if (b.career) expect(b.career.posRank).toBe(1);

    for (const pos of POS_KEYS) {
      const p = await getBoard("all", pos, null);
      for (const e of p.top) expect([e.pos, e.rank, e.posRank]).toEqual([pos, t.get(e.id)!.rank, t.get(e.id)!.pos_rank]);
      expect(p.top.length).toBe(Math.min(50, (await one<{ n: number }>(`select count(*)::int n from careers where pos = '${pos}'`)).n));
    }
  });

  it("전체 통계가 기록을 직접 센 값과 같아요", async () => {
    const board = await getBoard("all", null, null);
    expect(board.stats).toEqual(
      await one(`select count(*)::int careers, (count(*) filter (where nba))::int nba, (count(*) filter (where mvp > 0))::int "nbaMvp" from careers`),
    );
  });

  it("룰셋과 날짜를 고르면 그 안에서만 순위를 매겨요", async () => {
    const rs = (await one<{ r: number }>(`select min(ruleset) r from careers`)).r;
    const today = kstDay(Date.now());
    const yesterday = kstDay(Date.now() - DAY_MS);
    for (const [scope, day, where] of [
      [{ ruleset: rs }, null, `ruleset = ${rs}`],
      ["all", today, `(created_at at time zone 'Asia/Seoul')::date = '${today}'`],
      ["all", yesterday, `(created_at at time zone 'Asia/Seoul')::date = '${yesterday}'`],
      [{ ruleset: rs }, today, `ruleset = ${rs} and (created_at at time zone 'Asia/Seoul')::date = '${today}'`],
    ] as const) {
      const t = await truth(where);
      const board = await getBoard(scope, null, day);
      expect(board.top.length).toBe(t.size);
      for (const e of board.top) expect([e.rank, e.posRank]).toEqual([t.get(e.id)!.rank, t.get(e.id)!.pos_rank]);
      expect(board.stats.careers).toBe(t.size);
    }
  });

  it("날짜별 등록 수와 올타임 등록 수가 직접 센 값과 같아요", async () => {
    const days = await getBoardDays();
    const { rows } = await pg.query(
      `select to_char(created_at at time zone 'Asia/Seoul', 'YYYY-MM-DD') as day, count(*)::int careers, count(distinct player_id)::int players
       from careers where created_at >= (date_trunc('day', now() at time zone 'Asia/Seoul') - interval '6 days') at time zone 'Asia/Seoul'
       group by 1 order by 1 desc`,
    );
    expect(days.days).toEqual(rows);
    expect(days.all).toEqual(await one(`select count(*)::int careers, count(distinct player_id)::int players from careers`));
    const { rows: byPos } = await pg.query<{ pos: string; n: number }>(`select pos, count(*)::int n from careers group by pos`);
    expect(days.byPos).toEqual(Object.fromEntries(POS_KEYS.map((p) => [p, byPos.find((r) => r.pos === p)?.n ?? 0])));
  });
});

describe("내 순위와 제출 응답", () => {
  it("플레이어마다 올린 기록의 순위가 rank() over와 같아요", async () => {
    const t = await truth();
    for (const p of PLAYERS) {
      const mine = await myRanks(p);
      expect(mine.total).toBe(t.size);
      expect(mine.careers.length).toBe((await one<{ n: number }>(`select count(*)::int n from careers where player_id = '${p}'`)).n);
      for (const c of mine.careers) expect([c.rank, c.posRank]).toEqual([t.get(c.id)!.rank, t.get(c.id)!.pos_rank]);
    }
  });

  it("제출 응답의 순위와 전체 수가 맞아요", async () => {
    const t = await truth();
    const { id, pos } = await one<{ id: string; pos: string }>(`select id, pos from careers order by score limit 1 offset 3`);
    expect(await ranksOf(id)).toEqual({
      pos,
      rank: t.get(id)!.rank,
      total: t.size,
      posRank: t.get(id)!.pos_rank,
      posTotal: (await one<{ n: number }>(`select count(*)::int n from careers where pos = '${pos}'`)).n,
    });
  });
});

describe("스탯 랭킹", () => {
  it("스탯마다 상위 50명과 순위가 rank() over와 같고, 값이 없는 기록은 빠져요", async () => {
    const column = { pts: "pts", reb: "reb", ast: "ast", stl: "stl", blk: "blk", tpm: "tpm", don: "donated" } as const;
    for (const stat of STAT_KEYS) {
      const c = column[stat];
      const { rows } = await pg.query<{ id: string; r: number; v: number }>(
        `select id, ${c} v, (rank() over (order by ${c} desc))::int r from careers where ${c} is not null order by ${c} desc, created_at limit 50`,
      );
      const board = await getStatBoard("all", stat, null);
      // 값과 올린 시각이 모두 같은 기록끼리는 순서가 정해져 있지 않아요. 순위는 같아요.
      const sorted = (xs: (string | number)[][]) => [...xs].sort((a, b) => Number(a[2]) - Number(b[2]) || String(a[0]).localeCompare(String(b[0])));
      expect(sorted(board.top.map((e) => [e.id, e.value, e.rank]))).toEqual(sorted(rows.map((r) => [r.id, r.v, r.r])));
    }
    // 기부금 랭킹에는 기부한 커리어만 있어요.
    expect((await getStatBoard("all", "don", null)).top.every((e) => e.value > 0)).toBe(true);
  });
});

describe("집계 트리거", () => {
  it("기록을 고치거나 지워도 커리어 수·NBA 진출·NBA MVP·플레이어 수가 맞아요", async () => {
    await pg.exec(`update careers set pos = 'C', nba = not nba, mvp = mvp + 1 where num % 5 = 0`);
    await pg.exec(`delete from careers where num % 7 = 0`);
    // 한 플레이어의 기록을 한 문장으로 모두 지워도 플레이어 수는 한 번만 줄어요.
    await pg.query(`delete from careers where player_id = $1`, [PLAYERS[0]]);
    expect((await pg.query(`select ruleset, pos, careers, nba, nba_mvp from career_counts where careers > 0 order by 1, 2`)).rows).toEqual(
      (
        await pg.query(
          `select ruleset, pos, count(*)::int careers, (count(*) filter (where nba))::int nba, (count(*) filter (where mvp > 0))::int nba_mvp
           from careers group by 1, 2 order by 1, 2`,
        )
      ).rows,
    );
    expect(await one(`select players from career_totals`)).toEqual(await one(`select count(distinct player_id)::int players from careers`));
    expect((await pg.query(`select id, careers from players where careers > 0 order by id`)).rows).toEqual(
      (await pg.query(`select player_id id, count(*)::int careers from careers group by 1 order by 1`)).rows,
    );
    // 한 문장으로 여러 기록을 넣어도 맞아요.
    await pg.exec(`insert into careers (player_id, career_id, ruleset, name, num, pos, mvp, peak, personal, pts, reb, ast, rings, seasons, ret_age, legacy, summary)
      select '${PLAYERS[0]}', 'multi' || g, 2, '여럿', g, 'PG', 0, 50, 0, 0, 0, 0, 0, 1, 35, '-', '{"teams":[]}' from generate_series(1, 3) g`);
    expect(await one(`select players from career_totals`)).toEqual(await one(`select count(distinct player_id)::int players from careers`));
  });
});

describe("기록이 많을 때 실행 계획", () => {
  it("순위표·날짜 순위표·스탯 랭킹·내 순위가 careers를 통째로 훑지 않아요", async () => {
    // 기록 2만 개를 넣고 통계를 갱신해, 플래너가 실제 규모에서 고르는 계획을 봐요.
    await pg.exec(`
      insert into players (id, token_hash) select gen_random_uuid(), 'bulk' || g from generate_series(1, 2000) g;
      insert into careers (player_id, career_id, ruleset, name, num, pos, mvp, peak, personal, pts, reb, ast, stl, rings, seasons, ret_age, legacy, summary, score, created_at)
      select p.id, 'bulk' || g, 2, '대량', g % 100, (array['PG','SG','SF','PF','C'])[1 + g % 5], g % 3, 40 + g % 60, 0, (g * 7919) % 30000, g % 9000, g % 7000,
        case when g % 4 = 0 then null else g % 2000 end, 0, 10, 35, '-', '{"teams":[]}'::jsonb, ((g * 104729) % 100000) / 100.0,
        now() - (g % 400) * interval '1 day'
      from generate_series(1, 20000) g
      join lateral (select id from players where token_hash = 'bulk' || (1 + g % 2000)) p on true;
`);
    await pg.exec(`vacuum analyze careers`);
    const player = (await one<{ id: string }>(`select id from players where token_hash = 'bulk7'`)).id;

    const plans: Record<string, string> = {};
    const capture = async (name: string, run: () => Promise<unknown>, pick: (q: string) => boolean) => {
      queries.length = 0;
      await run();
      const q = queries.find((x) => pick(x.sql));
      expect(q, name).toBeTruthy();
      plans[name] = (await pg.query<{ "QUERY PLAN": string }>(`explain ${q!.sql}`, q!.params)).rows.map((r) => r["QUERY PLAN"]).join("\n");
    };
    const limited = (q: string) => q.includes(`order by "careers"."`) && q.includes("limit");
    await capture("순위표", () => getBoard("all", null, null), (q) => limited(q) && !q.includes(`"careers"."pos" = $`));
    await capture("포지션 순위표", () => getBoard("all", "SF", null), (q) => limited(q) && q.includes(`"careers"."pos" = $`));
    await capture("날짜 순위표", () => getBoard("all", null, kstDay(Date.now() - 3 * DAY_MS)), (q) => limited(q) && !q.includes(`"careers"."pos" = $`));
    await capture("스틸 랭킹", () => getStatBoard("all", "stl", null), limited);
    await capture("내 순위", () => myRanks(player), (q) => q.includes(`"careers"."player_id" = $`));
    await capture("날짜별 등록 수", () => getBoardDays(), (q) => q.includes("group by"));

    for (const [name, plan] of Object.entries(plans)) expect(plan, `${name}\n${plan}`).not.toMatch(/Seq Scan on careers\b/);
    expect(plans["순위표"]).toMatch(/Index Scan using careers_rank on careers/);
    expect(plans["포지션 순위표"]).toMatch(/Index Scan using careers_pos_rank on careers/);
    expect(plans["스틸 랭킹"]).toMatch(/Index Scan using careers_stl on careers/);
  });
});
