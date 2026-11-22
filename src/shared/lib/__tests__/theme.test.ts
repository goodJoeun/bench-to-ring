import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { THEME_BOOT, THEME_KEY } from "../theme";

/** 저장된 값으로 부팅 스크립트를 돌리고 <html>의 dataset과 전역을 돌려줘요. */
function boot(stored: Record<string, string>) {
  const dataset: Record<string, string> = {};
  const context: Record<string, unknown> = {
    localStorage: { getItem: (k: string) => stored[k] ?? null },
    document: { documentElement: { dataset } },
  };
  runInNewContext(THEME_BOOT, context);
  return { dataset, context };
}

describe("THEME_BOOT", () => {
  it("저장된 테마를 적용해요", () => {
    expect(boot({ [THEME_KEY]: "dark" }).dataset).toEqual({ theme: "dark" });
  });

  it("저장된 값이 없거나 이상하면 아무것도 붙이지 않아요", () => {
    expect(boot({}).dataset).toEqual({});
    expect(boot({ [THEME_KEY]: "neon" }).dataset).toEqual({});
  });

  it("저장소가 막힌 브라우저에서도 오류 없이 넘어가요", () => {
    const context = {
      localStorage: {
        getItem: () => {
          throw new Error("blocked");
        },
      },
      document: { documentElement: { dataset: {} } },
    };
    expect(() => runInNewContext(THEME_BOOT, context)).not.toThrow();
  });

  it("전역 변수를 남기지 않아요", () => {
    expect(boot({ [THEME_KEY]: "light" }).context.t).toBeUndefined();
  });

  it('서버가 읽는 모듈에 "use client"가 없어요 (있으면 문자열 대신 함수 참조가 들어가 스크립트가 문법 오류로 멈춰요)', () => {
    expect(readFileSync("src/shared/lib/theme.ts", "utf8")).not.toMatch(/^\s*["']use client["']/);
  });
});
