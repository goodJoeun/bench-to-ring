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
    // 테스트 파일이 함께 돌 때(개발 서버까지 켜 두면 더) 15~27초가 걸려서 30초로는 가끔 시간 제한에 걸렸어요.
    testTimeout: 60000,
  },
});
