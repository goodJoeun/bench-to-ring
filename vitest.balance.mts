import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/** 밸런스 측정 전용 설정: npm run balance */
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  // 커리어 600개를 돌리는 데 30초쯤 걸려요. 기본 시간 제한(5초)이면 리포트는 찍혀도 실패로 끝나요.
  test: { environment: "node", include: ["scripts/balance.ts"], silent: false, testTimeout: 300_000 },
});
