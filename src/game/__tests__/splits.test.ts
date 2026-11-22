import { describe, expect, it } from "vitest";
import { LEAGUES, careerSplits, createCareer, generateCandidates, type LeagueKey, type PlayoffRecord, type SeasonRecord } from "../index";

const fresh = () => createCareer({ name: "기록", num: 7, nat: "대한민국", pos: "SG", path: "domestic" }, generateCandidates("SG")[0], "splits");
const season = (year: number, team: string, lg: LeagueKey | null, extra: Partial<SeasonRecord> = {}): SeasonRecord => ({
  year, age: year - 2011, team, lg, pro: lg ? LEAGUES[lg].pro : false, role: "주전", gp: 10, min: 30, pts: 20, reb: 5, ast: 4, stl: 1, blk: 1,
  fg: 45, rating: 7, w: 6, l: 4, result: "플레이오프 1라운드", ovr0: 70, ovr1: 70, awards: [], ...extra,
});
const po = (gp: number, pts: number): PlayoffRecord => ({ gp, min: 30, pts, reb: 5, ast: 4, stl: 1, blk: 1, w: 4, l: 2 });

describe("리그별·팀별 기록", () => {
  it("리그와 팀을 처음 뛴 순서로 나누고, 돌아온 팀은 한 팀으로 합쳐요", () => {
    const c = fresh();
    c.hist = [
      season(2030, "서울 SK 나이츠", "kbl"),
      season(2031, "부산 KCC 이지스", "kbl"),
      season(2032, "보스턴 셀틱스", "nba", { gp: 82, pts: 10 }),
      season(2033, "서울 SK 나이츠", "kbl", { gp: 20, pts: 30 }),
    ];
    const out = careerSplits(c);
    expect(out.map((l) => l.key)).toEqual(["kbl", "nba"]);
    const kbl = out[0];
    expect(kbl.teams.map((t) => t.team)).toEqual(["서울 SK 나이츠", "부산 KCC 이지스"]);
    expect(kbl.regular).toMatchObject({ seasons: 3, gp: 40, pts: 20 * 10 + 20 * 10 + 30 * 20, w: 18, l: 12 });
    expect(kbl.teams[0].regular).toMatchObject({ seasons: 2, gp: 30, pts: 800 });
    expect(kbl.teams[0]).toMatchObject({ from: 2030, to: 2033 });
  });

  it("같은 이름의 팀도 리그가 다르면 따로 세요", () => {
    const c = fresh();
    c.hist = [season(2030, "레알 마드리드", "acb"), season(2031, "레알 마드리드", "euro")];
    const out = careerSplits(c);
    expect(out.map((l) => [l.key, l.teams.length, l.regular.seasons])).toEqual([["acb", 1, 1], ["euro", 1, 1]]);
  });

  it("플레이오프와 우승은 그 리그·팀의 시즌만 세고 국가대표 메달은 빼요", () => {
    const c = fresh();
    c.hist = [
      season(2030, "서울 SK 나이츠", "kbl", { po: po(6, 20) }),
      season(2031, "부산 KCC 이지스", "kbl", { po: po(4, 10) }),
      season(2032, "보스턴 셀틱스", "nba"),
    ];
    c.awardLog.push(
      { y: 2030, k: "ring", n: "KBL 우승" },
      { y: 2031, k: "nat_gold", n: "2031 아시안게임 금메달" },
      { y: 2032, k: "ring", n: "NBA 우승" },
    );
    const [kbl, nba] = careerSplits(c);
    expect(kbl.playoffs).toMatchObject({ seasons: 2, gp: 10, pts: 160 });
    expect(kbl.titles).toBe(1);
    expect(kbl.teams.map((t) => [t.playoffs.gp, t.titles])).toEqual([[6, 1], [4, 0]]);
    expect(nba.playoffs.seasons).toBe(0);
    expect(nba.titles).toBe(1);
  });

  it("상무 경기는 군 복무로 묶고, 경기를 뛰지 않은 현역·무소속 시즌은 넣지 않아요", () => {
    const c = fresh();
    c.hist = [
      season(2030, "서울 SK 나이츠", "kbl"),
      season(2031, "국군체육부대 상무", null, { mil: "sangmu", gp: 20 }),
      season(2032, "육군", null, { mil: "army", gp: 0, min: 0, pts: 0, reb: 0, ast: 0, w: 0, l: 0 }),
      season(2033, "무소속", null, { gp: 0, min: 0, pts: 0, reb: 0, ast: 0, w: 0, l: 0 }),
    ];
    const out = careerSplits(c);
    expect(out.map((l) => l.key)).toEqual(["kbl", "mil"]);
    expect(out[1].teams.map((t) => t.team)).toEqual(["국군체육부대 상무"]);
  });

  it("경기를 못 뛴 시즌도 그 팀의 시즌으로 남아요", () => {
    const c = fresh();
    c.hist = [season(2030, "서울 SK 나이츠", "kbl", { gp: 0, min: 0, pts: 0, reb: 0, ast: 0 })];
    expect(careerSplits(c)[0].regular).toMatchObject({ seasons: 1, gp: 0, pts: 0 });
  });
});
