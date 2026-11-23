import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FLAG_ATLAS, LOGO_ATLAS, type AtlasSheet } from "../atlas.generated";
import { FLAGS } from "../flags.generated";
import { LOGOS } from "../logos.generated";

function expectSheet(sheet: AtlasSheet, names: Record<string, string>, label: string) {
  const [path, query] = sheet.src.split("?");
  expect(query, `${label} 주소의 해시`).toMatch(/^v=[0-9a-f]{8}$/);
  expect(existsSync(`public${path}`), `${label} 파일`).toBe(true);
  expect(Object.keys(sheet.at).sort()).toEqual(Object.keys(names).sort());

  const cellOf = new Map<number, string>();
  for (const [name, index] of Object.entries(sheet.at)) {
    const x = (index % sheet.cols) * sheet.step;
    const y = Math.floor(index / sheet.cols) * sheet.step;
    expect(x + sheet.cell, `${name} 가로`).toBeLessThanOrEqual(sheet.width);
    expect(y + sheet.cell, `${name} 세로`).toBeLessThanOrEqual(sheet.height);
    // 같은 칸은 같은 파일을 쓰는 이름끼리만 나눠요.
    const file = names[name].split("?")[0];
    expect(cellOf.get(index) ?? file, `${name} 칸`).toBe(file);
    cellOf.set(index, file);
  }
}

describe("묶음 이미지", () => {
  it("모든 나라의 국기가 칸 안에 있어요", () => expectSheet(FLAG_ATLAS, FLAGS, "국기"));
  it("모든 팀의 로고가 칸 안에 있어요", () => expectSheet(LOGO_ATLAS, LOGOS, "로고"));
});
