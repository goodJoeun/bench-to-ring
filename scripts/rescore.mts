/**
 * 저장된 은퇴 기록에서 계산해 둔 칸(랭킹 점수 score, NBA 진출 nba, 스틸·블록·3점슛·기부금)을 다시 계산해요.
 * 점수 계산(src/game/legacy/hall.ts의 rankScore)이나 가중치, NBA 팀 목록을 바꾼 뒤 돌려요. 계산은 src/server/leaderboard/columns.ts예요.
 * 기록에 저장된 은퇴 요약(summary)으로 계산하고, 값이 달라진 기록만 고쳐요. 기록이 많아도 메모리를 넘지 않게 BATCH개씩 읽어요.
 *
 * npm run db:rescore    .env.local의 DATABASE_URL에 연결해요 (로컬은 dev 브랜치).
 */
import nextEnv from "@next/env";
import { neon } from "@neondatabase/serverless";
import type { CareerSummary } from "@/game";
import { derivedColumns } from "@/server/leaderboard/columns";

const BATCH = 500;

// @next/env는 CommonJS라 기본 내보내기로 읽어요.
nextEnv.loadEnvConfig(process.cwd());
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL이 없어요. .env.local을 확인해 주세요.");
const sql = neon(url);

type Derived = ReturnType<typeof derivedColumns>;
type Row = Derived & { id: string; summary: CareerSummary };
const KEYS = ["score", "nba", "stl", "blk", "tpm", "donated"] as const satisfies readonly (keyof Derived)[];

let total = 0;
let fixed = 0;
// id 순서로 이어 읽어요 (keyset). offset과 달리 뒤로 갈수록 느려지지 않아요.
for (let after = "00000000-0000-0000-0000-000000000000"; ; ) {
  const rows = (await sql`select id, score, nba, stl, blk, tpm, donated, summary from careers
    where id > ${after}::uuid order by id limit ${BATCH}`) as Row[];
  if (!rows.length) break;
  after = rows[rows.length - 1].id;
  total += rows.length;

  const changed = rows.map((r) => ({ id: r.id, from: r, to: derivedColumns(r.summary) })).filter((c) => KEYS.some((k) => c.from[k] !== c.to[k]));
  if (!changed.length) continue;
  fixed += changed.length;
  const col = <K extends (typeof KEYS)[number]>(k: K) => changed.map((c) => c.to[k]);
  await sql`update careers set score = v.score, nba = v.nba, stl = v.stl, blk = v.blk, tpm = v.tpm, donated = v.donated
    from unnest(
      ${changed.map((c) => c.id)}::uuid[], ${col("score")}::float8[], ${col("nba")}::bool[],
      ${col("stl")}::int[], ${col("blk")}::int[], ${col("tpm")}::int[], ${col("donated")}::float8[]
    ) as v(id, score, nba, stl, blk, tpm, donated)
    where careers.id = v.id`;
}
console.log(`기록 ${total}개 중 ${fixed}개를 고쳤어요.`);
