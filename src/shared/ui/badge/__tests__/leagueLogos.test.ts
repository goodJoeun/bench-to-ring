import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LEAGUES } from "@/game";
import { LEAGUE_LOGOS } from "../logos.generated";

describe("리그 로고", () => {
  it("모든 리그에 우승 팝업에 보여줄 로고 파일이 있어요", () => {
    for (const lg of Object.keys(LEAGUES)) {
      const src = LEAGUE_LOGOS[lg];
      expect(src, `${lg} 로고`).toMatch(new RegExp(`^/leagues/${lg}\\.png\\?v=[0-9a-f]{8}$`));
      expect(existsSync(`public/leagues/${lg}.png`), `${lg} 파일`).toBe(true);
    }
  });
});
