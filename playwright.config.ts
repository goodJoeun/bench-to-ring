import { defineConfig } from "@playwright/test";

/**
 * 화면 비교 테스트: 주요 화면을 찍어 기준 이미지와 픽셀 단위로 견줘요. CSS를 고친 뒤 화면이 달라졌는지 잡아요.
 * Next.js는 개발 서버와 빌드의 CSS 순서가 다를 수 있어서, 매번 프로덕션 빌드로 띄워 찍어요.
 * 기준 이미지는 OS와 폰트에 따라 달라져서 저장소에 올리지 않고 내 컴퓨터에만 둬요(e2e/__screenshots__).
 *
 * npm run test:visual:update  지금 화면을 기준 이미지로 저장해요.
 * npm run test:visual         지금 화면을 기준 이미지와 비교해요. 다르면 playwright-report에 차이를 남겨요.
 */
const PORT = 3100;
const DESKTOP = { viewport: { width: 1280, height: 900 } };
const MOBILE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };

export default defineConfig({
  testDir: "./e2e",
  snapshotPathTemplate: "e2e/__screenshots__/{projectName}/{arg}{ext}",
  outputDir: "test-results",
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  workers: 4,
  timeout: 60_000,
  reporter: [["line"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  // 그라데이션과 반투명은 찍을 때마다 색이 1~2 단계 흔들려서 그만큼만 봐주고, 그보다 달라진 픽셀은 하나만 있어도 실패로 봐요.
  expect: { timeout: 15_000, toHaveScreenshot: { animations: "disabled", caret: "hide", scale: "css", threshold: 0.01, maxDiffPixels: 0 } },
  use: {
    baseURL: `http://localhost:${PORT}`,
    browserName: "chromium",
    deviceScaleFactor: 1,
    locale: "ko-KR",
    timezoneId: "Asia/Seoul",
    // 움직이는 그림과 등장 효과를 마지막 장면에 멈춰요.
    contextOptions: { reducedMotion: "reduce" },
    trace: "retain-on-failure",
  },
  // 다크는 두 경로를 나눠 봐요. 데스크톱은 설정에서 고른 다크, 모바일은 기기 설정을 따르는 다크예요.
  projects: [
    { name: "desktop-light", use: { ...DESKTOP, colorScheme: "light" } },
    { name: "desktop-dark", use: { ...DESKTOP, colorScheme: "light" }, metadata: { theme: "dark" } },
    { name: "mobile-light", use: { ...MOBILE, colorScheme: "light" } },
    { name: "mobile-dark", use: { ...MOBILE, colorScheme: "dark" } },
  ],
  webServer: {
    command: `npm run build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 240_000,
    // 화면 테스트가 실제 DB에 닿지 않게 없는 주소로 덮어요. API는 e2e/api.ts가 브라우저에서 가짜 응답으로 막아요.
    env: { DATABASE_URL: "postgres://visual-test.invalid/none", DATABASE_URL_UNPOOLED: "postgres://visual-test.invalid/none" },
  },
});
