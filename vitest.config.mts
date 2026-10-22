import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // 커리어 300개를 경기 단위로 끝까지 돌리는 테스트가 있어 넉넉하게 잡았어요.
    testTimeout: 30000,
  },
});
