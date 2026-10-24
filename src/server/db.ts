import "server-only";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

function connect() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL이 없어요. .env.local을 확인해 주세요.");
  // Neon 서버리스 드라이버는 쿼리마다 HTTP로 보내서, 서버리스에서 연결이 쌓이지 않아요.
  return drizzle(neon(url), { schema });
}

let instance: ReturnType<typeof connect> | undefined;

/** 처음 부를 때 연결해요. 빌드처럼 DB가 필요 없는 때에 환경 변수가 없어도 괜찮게요. */
export function db() {
  return (instance ??= connect());
}
