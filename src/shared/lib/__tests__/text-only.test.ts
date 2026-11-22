import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type TextOnly = typeof import("../text-only");

const KEY = "b2r-text-only";
let dataset: Record<string, string>;
let stored: Record<string, string>;

/** 모듈이 기억하는 값까지 처음 상태로 불러와요. */
async function load(saved: Record<string, string> = {}): Promise<TextOnly> {
  stored = { ...saved };
  vi.resetModules();
  return import("../text-only");
}

beforeEach(() => {
  dataset = {};
  stored = {};
  vi.stubGlobal("document", { documentElement: { dataset } });
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => stored[k] ?? null,
    setItem: (k: string, v: string) => {
      stored[k] = v;
    },
    removeItem: (k: string) => {
      delete stored[k];
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("텍스트만 보기 적용 범위", () => {
  it("켜 둬도 게임 밖에서는 그림을 보여줘요", async () => {
    const t = await load({ [KEY]: "1" });
    t.setTextOnlyPlay(false);
    expect(t.textOnly()).toBe(false);
    expect(dataset.textOnly).toBeUndefined();
  });

  it("켜 둔 채 게임에 들어가면 적용되고 나오면 풀려요", async () => {
    const t = await load({ [KEY]: "1" });
    t.setTextOnlyPlay(true);
    expect(t.textOnly()).toBe(true);
    t.setTextOnlyPlay(false);
    expect(t.textOnly()).toBe(false);
    expect(stored[KEY]).toBe("1");
  });

  it("꺼 두면 게임 중에도 그림을 보여줘요", async () => {
    const t = await load();
    t.setTextOnlyPlay(true);
    expect(t.textOnly()).toBe(false);
  });

  it("게임 밖에서 켜면 저장만 하고, 게임에 들어갈 때 적용돼요", async () => {
    const t = await load();
    t.applyTextOnly(true);
    expect(stored[KEY]).toBe("1");
    expect(t.textOnly()).toBe(false);
    t.setTextOnlyPlay(true);
    expect(t.textOnly()).toBe(true);
  });

  it("게임 중에 끄면 바로 풀리고 저장도 지워요", async () => {
    const t = await load({ [KEY]: "1" });
    t.setTextOnlyPlay(true);
    t.applyTextOnly(false);
    expect(t.textOnly()).toBe(false);
    expect(stored[KEY]).toBeUndefined();
  });

  it("저장이 막힌 브라우저에서도 이번 방문 동안은 고른 값대로 해요", async () => {
    const t = await load();
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    });
    t.applyTextOnly(true);
    t.setTextOnlyPlay(true);
    expect(t.textOnly()).toBe(true);
  });
});
