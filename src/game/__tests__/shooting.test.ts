import { afterEach, describe, expect, it } from "vitest";
import type { SeasonTotals } from "../core/types";
import { fitLine, fitScore } from "../season/live";
import {
  applySeasonShooting,
  careerSplits,
  chooseOption,
  createCareer,
  currentDecision,
  freeThrowPct,
  generateCandidates,
  playoffLines,
  playoffShooting,
  resetRandom,
  seeded,
  setRandom,
  simulateSeason,
  startSeason,
  stepSeason,
  sumShooting,
  threePct,
  turnoversPerGame,
  type Career,
  type PlayoffRecord,
  type SeasonRecord,
  type ShotCounts,
} from "../index";

const fresh = (id = "shot") => createCareer({ name: "슈터", num: 7, nat: "대한민국", pos: "SG", path: "domestic" }, generateCandidates("SG")[0], id);
const season = (extra: Partial<SeasonRecord> = {}): SeasonRecord => ({
  year: 2030, age: 20, team: "서울 SK 나이츠", lg: "kbl", pro: true, role: "주전", gp: 50, min: 30, pts: 20, reb: 5, ast: 4, stl: 1, blk: 0,
  tpm: 2, tpp: 40, ftp: 80, tov: 2, fg: 46, rating: 7, w: 30, l: 20, result: "플레이오프 1라운드", ovr0: 70, ovr1: 70, awards: [], ...extra,
});
const po = (extra: Partial<PlayoffRecord> = {}): PlayoffRecord => ({ gp: 8, min: 32, pts: 22, reb: 5, ast: 5, stl: 1, blk: 0, w: 4, l: 4, ...extra });
const pointsOf = (s: ShotCounts) => (s.fgm - s.tpm) * 2 + s.tpm * 3 + s.ftm;

afterEach(() => resetRandom());

describe("자유투율과 턴오버", () => {
  it("슛 능력이 높을수록 자유투가 좋고, 볼 핸들링이 좋을수록 턴오버가 적어요", () => {
    const c = fresh();
    c.p.h = 190;
    c.p.attrs.sht = 50;
    const low = freeThrowPct(c, 2030, 68);
    c.p.attrs.sht = 95;
    expect(freeThrowPct(c, 2030, 68)).toBeGreaterThan(low + 15);
    const line = { pts: 25, ast: 7, min: 35 };
    c.p.attrs.hdl = c.p.attrs.iq = 35;
    const sloppy = turnoversPerGame(c, 2030, line);
    c.p.attrs.hdl = c.p.attrs.iq = 90;
    expect(turnoversPerGame(c, 2030, line)).toBeLessThan(sloppy);
  });

  it("NBA 평균 수준의 슈터는 실제 NBA와 비슷한 성공률이에요", () => {
    const c = fresh();
    c.p.h = 195;
    c.p.attrs.sht = 87;
    expect(threePct(c, 2030, 87)).toBeGreaterThanOrEqual(33);
    expect(threePct(c, 2030, 87)).toBeLessThanOrEqual(39);
    expect(freeThrowPct(c, 2030, 87)).toBeGreaterThanOrEqual(77);
    expect(freeThrowPct(c, 2030, 87)).toBeLessThanOrEqual(84);
  });

  it("턴오버는 공을 아주 많이 만져도 5.7개를 넘지 않아요", () => {
    const c = fresh();
    c.p.attrs.hdl = c.p.attrs.iq = 30;
    expect(turnoversPerGame(c, 2030, { pts: 45, ast: 25, min: 40 })).toBeLessThanOrEqual(5.7);
  });

  it("같은 커리어와 연도면 값이 같아요", () => {
    const c = fresh();
    const rec = season();
    expect(freeThrowPct(c, 2031, 68)).toBe(freeThrowPct(c, 2031, 68));
    expect(playoffShooting(c, 2031, rec, po(), 176, 68)).toEqual(playoffShooting(c, 2031, rec, po(), 176, 68));
  });
});

describe("슛 성공·시도", () => {
  it("득점이 2점슛·3점슛·자유투로 정확히 나뉘고, 성공률은 성공/시도예요", () => {
    const c = fresh();
    for (const pts of [1, 2, 3, 5, 19, 22, 87, 640]) {
      const rec = season({ gp: 10, pts: pts / 10, tpm: 0.5, tpp: undefined, ftp: undefined, tov: undefined, fg: 46 });
      applySeasonShooting(c, rec, pts, 68);
      const s = rec.shots!;
      expect(pointsOf(s)).toBe(pts);
      for (const v of Object.values(s)) expect(Number.isInteger(v)).toBe(true);
      expect(s.fga).toBeGreaterThanOrEqual(s.fgm);
      expect(s.fga).toBeGreaterThanOrEqual(s.tpa + (s.fgm - s.tpm));
      expect(s.fta).toBeGreaterThanOrEqual(s.ftm);
      if (s.fga) expect(rec.fg).toBeCloseTo((s.fgm / s.fga) * 100, 0);
    }
  });

  it("플레이오프 3점슛 성공은 경기 수를 곱하면 정수예요", () => {
    const c = fresh();
    c.p.attrs.sht = 80;
    const out = playoffShooting(c, 2031, season(), po({ gp: 1, pts: 19 }), 19, 68);
    expect(Number.isInteger(out.tpm!)).toBe(true);
    expect(pointsOf(out.shots!)).toBe(19);
  });

  it("득점이 없는 플레이오프에는 야투율과 자유투율이 없어요", () => {
    const out = playoffShooting(fresh(), 2031, season(), po({ gp: 2, pts: 0 }), 0, 68);
    expect(out.fg).toBeUndefined();
    expect(out.ftp).toBeUndefined();
    expect(out.tpp).toBeUndefined();
  });
});

describe("내 기록과 팀 득점", () => {
  it("점수를 올릴 때 승패와 점수 차는 그대로예요", () => {
    expect(fitScore(78, 70, { pts: 38, ast: 26 })).toEqual([96, 88]);
    expect(fitScore(100, 90, { pts: 20, ast: 5 })).toEqual([100, 90]);
  });

  it("점수가 정해진 경기는 내 기록을 팀 득점 안으로 줄여요", () => {
    const line = fitLine(78, { pts: 38, reb: 9, ast: 26 });
    expect(line).toEqual({ pts: 38, reb: 9, ast: 17 });
    expect(line.pts + line.ast * 2).toBeLessThanOrEqual(78);
    expect(fitLine(40, { pts: 60, ast: 3 })).toEqual({ pts: 34, ast: 0 });
  });
});

describe("컨퍼런스 파이널 MVP", () => {
  const finishNbaSeason = (cfGames: number) => {
    setRandom(() => 0.01);
    const c = fresh(`cf-${cfGames}`);
    for (const k of Object.keys(c.p.attrs) as (keyof typeof c.p.attrs)[]) c.p.attrs[k] = 99;
    c.stage = "pro";
    c.team = { lg: "nba", name: "보스턴 셀틱스", color: "#007A33", q: 0.7 };
    c.contract = { years: 3, salary: 10 } as Career["contract"];
    startSeason(c);
    const run = c.run!;
    const me = (gp: number): SeasonTotals => ({ gp, min: gp * 36, pts: gp * 30, reb: gp * 6, ast: gp * 6, stl: gp, blk: gp, rating: gp * 8 });
    const round = (name: string, opp: string, gp: number) => ({ name, opp, color: "#000000", win: true, score: "4-2", me: me(gp) });
    Object.assign(run, {
      phase: "end", g: 82, games: 82, w: 60, l: 22, min: 36, result: "리그 우승", champ: true,
      tot: { gp: 82, min: 2952, pts: 2460, reb: 492, ast: 492, stl: 82, blk: 82, rating: 656 },
      post: [round("플레이오프 1라운드", "마이애미 히트", 6), round("컨퍼런스 세미파이널", "뉴욕 닉스", 6), round("컨퍼런스 파이널", "밀워키 벅스", cfGames), round("NBA 파이널", "덴버 너기츠", 6)],
      final: { opp: "덴버 너기츠", us: 110, them: 100, win: true, series: "4-2" },
      shown: 4,
    });
    stepSeason(c);
    return c;
  };

  it("컨퍼런스 파이널을 뛰면 받고, 결장하면 받지 못해요", () => {
    expect(finishNbaSeason(6).awards.cfmvp).toBe(1);
    expect(finishNbaSeason(0).awards.cfmvp).toBeUndefined();
  });
});

describe("슈팅 합계", () => {
  it("성공과 시도를 합쳐 성공률을 내요", () => {
    const shots = (fgm: number, fga: number, tpm: number, tpa: number, ftm: number, fta: number, tov: number): ShotCounts => ({ fgm, fga, tpm, tpa, ftm, fta, tov });
    const out = sumShooting([
      season({ gp: 10, shots: shots(40, 100, 10, 20, 8, 10, 10) }),
      season({ gp: 30, shots: shots(150, 300, 90, 360, 72, 80, 90) }),
    ]);
    expect(out.fg).toBe(47.5);
    expect(out.tpp).toBeCloseTo((100 / 380) * 100, 1);
    expect(out.ftp).toBe(88.9);
    expect(out.tov).toBe(2.5);
  });

  it("이 기록이 없는 예전 시즌은 빼고, 하나도 없으면 null이에요", () => {
    const old = season({ tpm: undefined, tpp: undefined, ftp: undefined, tov: undefined });
    expect(sumShooting([old])).toEqual({ fg: 46, tpp: null, ftp: null, tov: null });
    expect(sumShooting([old, season({ gp: 10, ftp: 75, tov: 4 })])).toMatchObject({ ftp: 75, tov: 4 });
    expect(sumShooting(playoffLines([season({ po: po() })]))).toEqual({ fg: null, tpp: null, ftp: null, tov: null });
    expect(sumShooting([])).toEqual({ fg: null, tpp: null, ftp: null, tov: null });
  });
});

describe("실제 커리어 기록", () => {
  const playOut = (c: Career) => {
    for (let steps = 0; c.stage !== "retired" && steps < 200; steps++) {
      if (c.queue.length) {
        currentDecision(c);
        chooseOption(c, 0);
      } else simulateSeason(c);
    }
  };

  it("경기를 뛴 시즌과 플레이오프의 슈팅이 합계 득점과 맞아요", () => {
    let poSeasons = 0;
    for (let i = 0; i < 12; i++) {
      setRandom(seeded(9100 + i));
      const c = fresh(`shot-${i}`);
      playOut(c);
      expect(c.stage).toBe("retired");
      for (const h of c.hist) {
        if (h.gp > 0) {
          expect(h.shots).toBeDefined();
          expect(Math.abs(pointsOf(h.shots!) / h.gp - h.pts)).toBeLessThanOrEqual(0.0501);
          expect(h.tov).toBeLessThanOrEqual(5.7);
          if (h.ftp !== undefined) expect(h.ftp).toBeLessThanOrEqual(100);
        }
        if (!h.po?.gp) continue;
        poSeasons++;
        const s = h.po.shots!;
        expect(Math.abs(pointsOf(s) / h.po.gp - h.po.pts)).toBeLessThanOrEqual(0.0501);
        expect(Math.abs(s.tpm / h.po.gp - h.po.tpm!)).toBeLessThanOrEqual(0.0501);
        expect(h.po.tov).toBeLessThanOrEqual(5.7);
      }
      for (const lg of careerSplits(c)) expect(lg.regularShot.tov === null).toBe(lg.rows.every((h) => h.gp === 0));
    }
    expect(poSeasons).toBeGreaterThan(0);
  });
});
