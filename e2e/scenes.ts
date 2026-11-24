import { test, type Page } from "@playwright/test";
import { mockApi } from "./api";
import { NOW, optionIndex, storageFor, type Moment } from "./careers";

export interface Scene {
  name: string;
  /** 어떤 저장 상태로 열지. 없으면 처음 온 방문자, "records"면 은퇴 기록만 있는 방문자예요. */
  at?: Moment | "records";
  path?: string;
  unreadNotices?: boolean;
  textOnly?: boolean;
  /** 알림은 2.6초 뒤 사라져요(shared/ui/Toast.tsx). 찍는 동안 남아 있게 그 타이머만 멈춰요. */
  holdToast?: boolean;
  act?: (page: Page) => Promise<void>;
}

const tap = async (page: Page, name: string | RegExp) => {
  await page.getByRole("button", { name }).first().click();
};

/** 처음부터 n번째 선수 만들기 단계까지 가요. */
const toStep = (n: number) => async (page: Page) => {
  await tap(page, "커리어 시작하기");
  for (let i = 0; i < n; i++) await tap(page, "다음 →");
};

const openTab = (id: string) => async (page: Page) => {
  await page.locator(`#tab-${id}`).click();
};

/** 결정 시트에서 i번째 선택지를 고르고, 다시 묻는 시트가 뜨면 넘어가요. */
const chooseOption = async (page: Page, i: number) => {
  await page.locator(".choices button").nth(i).click();
  const confirm = page.locator("#confirm-title");
  if (await confirm.isVisible()) await page.locator(".sheet-go").click();
};

/** 기능별 장면. 화면 비교 이미지 이름은 `기능-장면`이에요. */
export const SCENES: Record<string, Scene[]> = {
  create: [
    { name: "cover-first-visit" },
    { name: "cover-with-records", at: "records" },
    { name: "step-look", act: toStep(0) },
    { name: "step-position", act: toStep(1) },
    { name: "step-style", act: toStep(2) },
    { name: "step-info", act: toStep(3) },
    {
      name: "name-required-sheet",
      act: async (page) => {
        await toStep(3)(page);
        await tap(page, "이 선수로 커리어 시작");
      },
    },
    {
      name: "confirm-start-sheet",
      act: async (page) => {
        await toStep(3)(page);
        await page.locator("#f-name").fill("테스트");
        await tap(page, "이 선수로 커리어 시작");
      },
    },
    {
      name: "challenge-today",
      act: async (page) => {
        await page.locator(".ch-pos").first().click();
        await tap(page, "다음 →");
      },
    },
  ],
  career: [
    { name: "home-rookie", at: "rookie" },
    { name: "home-veteran", at: "offseason" },
    { name: "season-plan-sheet", at: "offseason", act: (page) => page.locator(".advance").click() },
    { name: "season-running", at: "running" },
    { name: "decision-sheet", at: "decision" },
    { name: "clutch-sheet", at: "clutch", act: (page) => page.locator("#decision-title").waitFor() },
    { name: "offer-sheet", at: "offer" },
    { name: "offer-confirm-sheet", at: "offer", act: (page) => page.locator(".choices button").first().click() },
    { name: "toast", at: "offer", holdToast: true, act: (page) => chooseOption(page, 0) },
    { name: "tab-record", at: "offseason", act: openTab("record") },
    { name: "tab-trophy", at: "offseason", act: openTab("trophy") },
    { name: "tab-hall", at: "offseason", act: openTab("hall") },
    {
      name: "tab-settings",
      at: "offseason",
      act: async (page) => {
        await page.locator("#open-settings").click();
        await tap(page, "새로운 커리어 시작");
      },
    },
    { name: "text-only-home", at: "offseason", textOnly: true },
  ],
  "season-end": [{ name: "report", at: "offseason", act: (page) => tap(page, /시즌 결산 보기/) }],
  progress: [
    {
      name: "draft-result",
      at: "draft",
      act: async (page) => {
        await chooseOption(page, optionIndex("draft", (a) => a.k === "draft"));
        await tap(page, "결과 바로 보기");
      },
    },
    {
      name: "tournament-result",
      at: "national",
      act: async (page) => {
        await chooseOption(page, optionIndex("national", (a) => a.k === "national" && a.join));
        await tap(page, "결과 바로 보기");
      },
    },
    // 움직임을 줄인 기기는 결승 중계를 건너뛰고 결과부터 보여줘요.
    { name: "final-result", at: "beforeFinal", act: (page) => tap(page, "결정이 나올 때까지 건너뛰기") },
    { name: "cheer", at: "cheer" },
    { name: "farewell-first", at: "retired", act: (page) => tap(page, "커리어 회고") },
    {
      name: "farewell-last",
      at: "retired",
      act: async (page) => {
        await tap(page, "커리어 회고");
        await tap(page, "마지막으로 건너뛰기");
      },
    },
  ],
  retired: [
    { name: "ending", at: "retired" },
    { name: "share-sheet", at: "retired", act: (page) => tap(page, "기록 카드 공유") },
  ],
  dialogs: [
    { name: "settings", at: "records", act: (page) => page.locator("#open-settings").click() },
    {
      name: "guide",
      at: "records",
      act: async (page) => {
        await page.locator("#open-settings").click();
        await tap(page, "플레이 가이드");
      },
    },
    { name: "challenge-guide", act: (page) => page.locator(".ch-help").click() },
    { name: "achievements", at: "records", act: (page) => tap(page, "업적") },
    { name: "notices", at: "records", act: (page) => tap(page, /^공지/) },
    { name: "notice-alert", at: "records", unreadNotices: true },
    { name: "feedback", at: "records", act: (page) => tap(page, "의견 보내기") },
    { name: "support", at: "records", act: (page) => tap(page, "서버비 후원하기") },
  ],
  rankings: [
    ...["best5", "ranking", "position", "stats", "challenge", "mine"].map((tab) => ({ name: tab, at: "records" as const, path: `/rankings#${tab}` })),
    { name: "career-card", at: "records", path: "/rankings#ranking", act: (page) => page.locator(".rk-list .rk-open").first().click() },
    { name: "delete-record", at: "records", path: "/rankings#mine", act: (page) => tap(page, /기록 지우기$/) },
  ],
};

/** 고정된 시각·난수·저장소로 장면을 열어요. */
export async function open(page: Page, scene: Scene) {
  await mockApi(page);
  await page.clock.setFixedTime(NOW);
  const theme = test.info().project.metadata.theme as string | undefined;
  const items: Record<string, string> = {
    ...storageFor(scene.at, scene.unreadNotices),
    ...(theme && { "b2r-theme": theme }),
    ...(scene.textOnly && { "b2r-text-only": "1" }),
  };
  await page.addInitScript(
    ({ saved, holdToast }) => {
      for (const [k, v] of Object.entries(saved)) localStorage.setItem(k, v);
      // 선수 후보처럼 Math.random으로 고르는 값도 늘 같게 해요 (mulberry32).
      let a = 20270101;
      Math.random = () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
      if (holdToast) {
        const later = window.setTimeout;
        window.setTimeout = ((fn: TimerHandler, ms?: number, ...args: unknown[]) => (ms === 2600 ? 0 : later(fn, ms, ...args))) as typeof window.setTimeout;
      }
    },
    { saved: items, holdToast: !!scene.holdToast },
  );
  await page.goto(scene.path ?? "/");
  await page.locator("header.top, main").first().waitFor();
  await page.locator(".boot").waitFor({ state: "detached" });
}

/** 지금 화면이 부른 폰트를 다 받을 때까지 기다려요. 레이아웃이 끝나야 필요한 폰트가 정해져서 두 프레임 뒤에 봐요. */
const fontsLoaded = (page: Page) =>
  page.evaluate(async () => {
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
    await document.fonts.ready;
  });

/**
 * 늦게 불러오는 영역까지 다 그린 뒤, 고정된 막대와 시트가 내용을 가리지 않게 화면 높이를 내용에 맞춰요.
 * 시트(진행 팝업이 아닌 모달)는 화면의 88%까지 차지해요. 진행 팝업은 화면 크기에 맞춰 그려지니 높이를 그대로 둬요.
 */
export async function settle(page: Page) {
  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
  await page.waitForLoadState("networkidle");
  // networkidle은 처음 한 번만 기다려요. 버튼을 누른 뒤 새로 받는 폰트 조각은 따로 기다려야 줄 위치가 흔들리지 않아요.
  await fontsLoaded(page);
  const height = await page.evaluate(() => {
    if (document.querySelector(".sim")) return window.innerHeight;
    const sheet = [...document.querySelectorAll('[aria-modal="true"]')].at(-1);
    return sheet ? Math.ceil(sheet.scrollHeight / 0.88) + 1 : document.documentElement.scrollHeight;
  });
  const { width } = page.viewportSize()!;
  await page.setViewportSize({ width, height: Math.max(height, page.viewportSize()!.height) });
  await fontsLoaded(page);
  await page.evaluate(async () => {
    window.scrollTo({ top: 0, behavior: "instant" });
    // 팝업 뒤에서 화면 밖에 있는 지연 로딩 이미지는 받지 않아서, 다 받은 이미지만 기다려요.
    await Promise.all([...document.images].filter((img) => img.complete).map((img) => img.decode().catch(() => undefined)));
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  });
}
