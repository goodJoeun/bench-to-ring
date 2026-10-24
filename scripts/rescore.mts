/**
 * 저장된 은퇴 기록의 랭킹 점수(careers.score)를 다시 계산해요.
 * 점수 계산(src/game/hall.ts의 rankScore)이나 가중치를 바꾼 뒤, 또는 score 칸이 생기기 전 기록을 채울 때 돌려요.
 * 기록에 저장된 은퇴 요약(summary)으로 계산하고, 값이 달라진 기록만 고쳐요.
 *
 * npm run db:rescore    .env.local의 DATABASE_URL에 연결해요 (로컬은 dev 브랜치).
 */
import nextEnv from "@next/env";
import { neon } from "@neondatabase/serverless";
import { rankScore, type CareerSummary } from "@/game";

// @next/env는 CommonJS라 기본 내보내기로 읽어요.
nextEnv.loadEnvConfig(process.cwd());
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL이 없어요. .env.local을 확인해 주세요.");
const sql = neon(url);

const rows = (await sql`select id, score, summary from careers`) as { id: string; score: number; summary: CareerSummary }[];
const changed = rows.map((r) => ({ id: r.id, from: r.score, to: rankScore(r.summary) })).filter((r) => r.from !== r.to);
if (changed.length)
  await sql`update careers set score = v.score
    from (select unnest(${changed.map((r) => r.id)}::uuid[]) as id, unnest(${changed.map((r) => r.to)}::float8[]) as score) v
    where careers.id = v.id`;
console.log(`기록 ${rows.length}개 중 ${changed.length}개의 점수를 고쳤어요.`);
