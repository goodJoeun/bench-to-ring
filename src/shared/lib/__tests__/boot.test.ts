import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { BOOT_SCRIPT } from "../boot";
import { TEXT_ONLY_KEY } from "../text-only-boot";
import { THEME_KEY } from "../theme";

/** 저장된 값으로 부팅 스크립트를 돌리고 <html>의 dataset과 전역을 돌려줘요. */
function boot(stored: Record<string, string>) {
  const dataset: Record<string, string> = {};
  const context: Record<string, unknown> = {
    localStorage: { getItem: (k: string) => stored[k] ?? null },
    document: { documentElement: { dataset } },
  };
  runInNewContext(BOOT_SCRIPT, context);
  return { dataset, context };
}

describe("BOOT_SCRIPT", () => {
  it("저장된 테마와 텍스트만 보기를 함께 적용해요", () => {
    expect(boot({ [THEME_KEY]: "dark", [TEXT_ONLY_KEY]: "1" }).dataset).toEqual({ theme: "dark", textOnly: "" });
  });

  it("저장된 값이 없거나 테마 값이 이상하면 아무것도 붙이지 않아요", () => {
    expect(boot({}).dataset).toEqual({});
    expect(boot({ [THEME_KEY]: "neon", [TEXT_ONLY_KEY]: "0" }).dataset).toEqual({});
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
    expect(() => runInNewContext(BOOT_SCRIPT, context)).not.toThrow();
  });

  it("전역 변수를 남기지 않아요", () => {
    expect(boot({ [THEME_KEY]: "light" }).context.t).toBeUndefined();
  });

  it('서버가 읽는 모듈에 "use client"가 없어요 (있으면 문자열 대신 함수 참조가 들어가 스크립트 전체가 문법 오류로 멈춰요)', () => {
    for (const file of ["boot.ts", "theme.ts", "text-only-boot.ts"]) {
      expect(readFileSync(`src/shared/lib/${file}`, "utf8")).not.toMatch(/^\s*["']use client["']/);
    }
  });
});
