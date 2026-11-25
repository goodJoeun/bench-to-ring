import { describe, expect, it } from "vitest";
import { LEGACY_TIERS, legacyOf } from "@/game";
import { legacyGrandeur } from "@/features/retired/grandeur";

describe("엔딩 배경의 화려함", () => {
  it("맨 위 등급(GOAT)이 가장 화려하고, 프로 무대를 못 밟은 선수는 학교 체육관이에요", () => {
    expect(legacyGrandeur({ legacy: LEGACY_TIERS[0].name, seasons: 18 })).toBe(7);
    const noPro = legacyOf({ mvp: 0, rings: 0, awards: {}, personal: 0, peak: 60, pts: 0, seasons: 0 });
    expect(legacyGrandeur({ legacy: noPro, seasons: 0 })).toBe(0);
  });

  it("등급이 오를수록 배경은 같거나 더 화려해져요", () => {
    const levels = [...LEGACY_TIERS].reverse().map((t) => legacyGrandeur({ legacy: t.name, seasons: 5 }));
    expect(levels[0]).toBe(1);
    for (let i = 1; i < levels.length; i++) expect(levels[i]).toBeGreaterThanOrEqual(levels[i - 1]);
  });

  it("모르는 등급 이름이면 프로 시즌이 있는지로만 가려요", () => {
    expect(legacyGrandeur({ legacy: "예전 등급", seasons: 3 })).toBe(1);
    expect(legacyGrandeur({ legacy: "예전 등급", seasons: 0 })).toBe(0);
  });
});
