import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/** 밸런스 측정 전용 설정: npm run balance */
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: { environment: "node", include: ["scripts/balance.ts"], silent: false },
});
