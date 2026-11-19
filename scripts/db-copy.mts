/**
 * 한 DB의 플레이어와 은퇴 기록을 다른 DB로 옮겨요. Neon에서 Supabase로 옮길 때 썼어요.
 * 받는 쪽에 없는 줄만 넣어서 여러 번 돌려도 돼요. 서비스를 멈추지 않고 옮기려고, 먼저 한 번 옮기고
 * 배포 DB를 바꾼 뒤 그사이 보내는 쪽에 올라온 기록을 한 번 더 옮겨요.
 * 집계(players.careers, career_counts, career_totals)는 넣은 뒤 careers로 다시 세요.
 *
 * npm run db:copy -- <보내는 쪽 환경 변수> <받는 쪽 환경 변수>
 *   예) npm run db:copy -- NEON_DATABASE_URL_UNPOOLED DATABASE_URL_UNPOOLED
 * 받는 쪽은 세션 모드 주소여야 해요(Supabase Session pooler, 포트 5432).
 * 받는 쪽에는 drizzle/의 마이그레이션이 먼저 들어가 있어야 해요(npm run db:migrate).
 */
import nextEnv from "@next/env";
import postgres from "postgres";

// @next/env는 CommonJS라 기본 내보내기로 읽어요.
nextEnv.loadEnvConfig(process.cwd());

const [fromEnv, toEnv] = process.argv.slice(2);
if (!fromEnv || !toEnv) throw new Error("보내는 쪽과 받는 쪽 환경 변수 이름을 주세요. 예) npm run db:copy -- NEON_DATABASE_URL DATABASE_URL_UNPOOLED");
const fromUrl = process.env[fromEnv];
const toUrl = process.env[toEnv];
if (!fromUrl) throw new Error(`${fromEnv}가 없어요. .env.local을 확인해 주세요.`);
if (!toUrl) throw new Error(`${toEnv}가 없어요. .env.local을 확인해 주세요.`);
if (fromUrl === toUrl) throw new Error("보내는 쪽과 받는 쪽이 같아요.");

const host = (u: string) => new URL(u).hostname;
// 트랜잭션 모드 풀러는 prepared statement와 파이프라이닝을 못 써서 둘 다 꺼요.
// 트랜잭션으로 넣어서, 받는 쪽은 세션 모드 주소(Supabase Session pooler 5432)여야 해요. 트랜잭션 모드 풀러(6543)는 파이프라이닝을 못 써서 멈춰요.
const opts = { prepare: false, max: 1, ssl: "require" } as const;
const from = postgres(fromUrl, opts);
const to = postgres(toUrl, opts);

const PAGE = 1000;
const BATCH = 500;

/** 표 전체를 id 순서로 이어 읽어요. 값은 Postgres가 JSON으로 바꾼 그대로예요(시간대 붙은 시각, jsonb). */
async function readAll(table: "players" | "careers"): Promise<{ id: string; json: string }[]> {
  const out: { id: string; json: string }[] = [];
  for (let after = "00000000-0000-0000-0000-000000000000"; ; ) {
    const rows = await from<{ id: string; json: string }[]>`
      select id::text as id, row_to_json(t)::text as json from ${from(table)} t where id > ${after}::uuid order by id limit ${PAGE}`;
    out.push(...rows);
    if (rows.length < PAGE) return out;
    after = rows[rows.length - 1].id;
  }
}

async function idsIn(table: "players" | "careers"): Promise<Set<string>> {
  const rows = await to<{ id: string }[]>`select id::text as id from ${to(table)}`;
  return new Set(rows.map((r) => r.id));
}

console.log(`보내는 쪽 ${host(fromUrl)} → 받는 쪽 ${host(toUrl)}`);
const [players, careers] = [await readAll("players"), await readAll("careers")];
const [havePlayers, haveCareers] = await Promise.all([idsIn("players"), idsIn("careers")]);
const newPlayers = players.filter((r) => !havePlayers.has(r.id));
const newCareers = careers.filter((r) => !haveCareers.has(r.id));
console.log(`보내는 쪽: 플레이어 ${players.length}, 기록 ${careers.length}`);
console.log(`옮길 것: 플레이어 ${newPlayers.length}, 기록 ${newCareers.length}`);

await to.begin(async (tx) => {
  // 넣는 동안 집계 트리거를 끄고, 다 넣은 뒤 careers로 다시 세요. 트리거를 끄는 동안 다른 연결의 기록 제출은 이 트랜잭션이 끝날 때까지 기다려요.
  await tx`alter table careers disable trigger careers_counts`;
  for (let i = 0; i < newPlayers.length; i += BATCH) {
    const rows = newPlayers.slice(i, i + BATCH).map((r) => JSON.parse(r.json) as postgres.JSONValue);
    await tx`insert into players select * from json_populate_recordset(null::players, ${tx.json(rows)}::json) on conflict do nothing`;
  }
  for (let i = 0; i < newCareers.length; i += BATCH) {
    const rows = newCareers.slice(i, i + BATCH).map((r) => JSON.parse(r.json) as postgres.JSONValue);
    await tx`insert into careers select * from json_populate_recordset(null::careers, ${tx.json(rows)}::json) on conflict do nothing`;
  }
  await tx`update players p set careers = c.n
    from (select p2.id, count(c2.id)::int as n from players p2 left join careers c2 on c2.player_id = p2.id group by p2.id) c
    where p.id = c.id and p.careers <> c.n`;
  await tx`delete from career_counts`;
  await tx`insert into career_counts (ruleset, pos, careers, nba, nba_mvp)
    select ruleset, pos, count(*), count(*) filter (where nba), count(*) filter (where mvp > 0) from careers group by ruleset, pos`;
  await tx`insert into career_totals (id, players) select 1, count(*) from players where careers > 0
    on conflict (id) do update set players = excluded.players`;
  await tx`alter table careers enable trigger careers_counts`;
});

// 맞는지 봐요: 보내는 쪽 기록은 모두 받는 쪽에 있어야 하고, 집계는 받는 쪽 careers와 같아야 해요.
const [after] = await to<{ players: number; careers: number; counted: number; totals: number; withCareers: number }[]>`
  select (select count(*)::int from players) as players, (select count(*)::int from careers) as careers,
    (select coalesce(sum(careers), 0)::int from career_counts) as counted,
    (select players from career_totals where id = 1) as totals,
    (select count(*)::int from players where careers > 0) as "withCareers"`;
const haveAfter = await idsIn("careers");
const missing = careers.filter((r) => !haveAfter.has(r.id)).length;
const ok = after.careers >= careers.length && after.players >= players.length && after.counted === after.careers && after.totals === after.withCareers && missing === 0;
console.log(`받는 쪽: 플레이어 ${after.players}, 기록 ${after.careers}, career_counts 합 ${after.counted}, 기록 올린 플레이어 ${after.totals}`);
console.log(ok ? "맞아요." : "맞지 않아요. 위 숫자를 확인해 주세요.");

await Promise.all([from.end(), to.end()]);
if (!ok) process.exit(1);
