import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/** postgres.js가 받지만 타입에는 없는 max_pipeline을 더한 연결 옵션 */
type Options = postgres.Options<Record<string, never>> & { max_pipeline: number };

function connect() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL이 없어요. .env.local을 확인해 주세요.");
  // Supabase 공유 풀러(트랜잭션 모드, 포트 6543)로 연결해요. 이 모드는 prepared statement를 못 써서 꺼요.
  // 파이프라이닝(답을 기다리지 않고 쿼리를 이어 보내기)도 못 써서, 켜 두면 Promise.all로 여러 쿼리를 보낼 때 멈춰요. 하나씩 보내요.
  // max_pipeline: 0이면 postgres.js의 트랜잭션(db().transaction)이 돌지 않아요. 지금 서버 코드는 트랜잭션을 쓰지 않아요.
  // 서버리스 인스턴스 하나가 연결 하나만 쥐고, 한동안 쓰지 않으면 닫아서 풀러 연결이 쌓이지 않아요.
  const options: Options = {
    prepare: false,
    max_pipeline: 0,
    max: 1,
    idle_timeout: 20,
    ssl: /@(localhost|127\.0\.0\.1)[:/]/.test(url) ? false : "require",
  };
  return drizzle(postgres(url, options), { schema });
}

let instance: ReturnType<typeof connect> | undefined;

/** 처음 부를 때 연결해요. 빌드처럼 DB가 필요 없는 때에 환경 변수가 없어도 괜찮게요. */
export function db() {
  return (instance ??= connect());
}
