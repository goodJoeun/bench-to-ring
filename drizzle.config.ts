import { loadEnvConfig } from "@next/env";
import { defineConfig } from "drizzle-kit";

// Next.js와 같은 규칙으로 .env.local을 읽어요.
loadEnvConfig(process.cwd());

const url = process.env.DATABASE_URL_UNPOOLED;
if (!url) throw new Error("DATABASE_URL_UNPOOLED가 없어요. .env.local을 확인해 주세요.");

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/schema.ts",
  out: "./drizzle",
  // 마이그레이션은 풀링을 거치지 않는 직접 연결로 해요.
  dbCredentials: { url },
});
