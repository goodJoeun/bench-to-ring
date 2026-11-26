import { describe, expect, it } from "vitest";
import { CELEBRATION_NAMES } from "@/game";
import { celebrationKey } from "../celebrationDraw";

describe("시그니처 세리머니 장면", () => {
  it("생길 수 있는 세리머니마다 자기 장면이 있어요", () => {
    const keys = CELEBRATION_NAMES.map(celebrationKey);
    expect(keys).not.toContain("cheer");
    expect(new Set(keys).size).toBe(CELEBRATION_NAMES.length);
  });

  it("모르는 이름은 환호 장면으로 그려요", () => {
    expect(celebrationKey("예전 세리머니")).toBe("cheer");
  });
});
