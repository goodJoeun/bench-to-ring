import { afterEach, describe, expect, it } from "vitest";
import {
  ACHIEVEMENTS,
  ACHIEVEMENT_GROUPS,
  EMPTY_LIFETIME,
  LEAGUES,
  PLAYOFF_SPOTS,
  TEAMS,
  addLifetime,
  applyAction,
  checkAchievements,
  chooseOption,
  createCareer,
  currentDecision,
  fromCareer,
  generateCandidates,
  nbaTriple,
  rankAchievements,
  resetRandom,
  retire,
  seasonStandings,
  seeded,
  setBrowserRecord,
  setRandom,
  simulateSeason,
  subLifetime,
  type Career,
  type LeagueKey,
  type PosKey,
  type SeasonRecord,
} from "@/game";

afterEach(() => {
  resetRandom();
  setBrowserRecord();
});

const fresh = (id: string, pos: PosKey = "SG") =>
  createCareer({ name: "업적", num: 7, nat: "대한민국", pos, path: "domestic" }, generateCandidates(pos)[0], id);
/** 프로 시즌 한 줄. 나이는 2027년에 16세로 시작한 선수 기준이에요. */
const season = (year: number, team: string, lg: LeagueKey, extra: Partial<SeasonRecord> = {}): SeasonRecord => ({
  year, age: year - 2011, team, lg, pro: LEAGUES[lg].pro, role: "주전", gp: 50, min: 30, pts: 15, reb: 5, ast: 4, stl: 1, blk: 0,
  fg: 45, rating: 7, w: 30, l: 20, result: "플레이오프 1라운드", ovr0: 70, ovr1: 70, awards: [], ...extra,
});
const has = (c: Career, id: string) => c.achv.includes(id);
const clutch = (c: Career, p: number) =>
  applyAction(c, { k: "clutch", attr: "sht", play: "버저비터", p } as Parameters<typeof applyAction>[1]);
const toRetire = (c: Career) => {
  c.stage = "pro";
  c.team = null;
  retire(c);
};

describe("새 업적", () => {
  it("모든 업적에 있는 묶음이고, 클러치·역대 랭킹 묶음이 생겼어요", () => {
    for (const a of ACHIEVEMENTS) expect(ACHIEVEMENT_GROUPS[a.group], a.id).toBeDefined();
    const ids = ACHIEVEMENTS.filter((a) => a.group === "clutch").map((a) => a.id);
    expect(ids).toEqual(["clutch_master", "ice_heart", "chicken_heart", "final_man"]);
    expect(ACHIEVEMENTS.filter((a) => a.group === "rank").map((a) => a.name)).toEqual([
      "나 정도면 GOAT?", "야전사령관", "백코트의 저격수", "코트 위의 팔방미인", "페인트존의 투사", "골밑의 수호신",
    ]);
  });

  it("클러치 8연속 성공은 얼음 심장, 5연속 실패는 새가슴이에요. 결과가 바뀌면 처음부터 다시 세요", () => {
    const c = fresh("streak");
    c.run = { forced: null, form: 0 } as unknown as Career["run"];
    setRandom(() => 0);
    for (let i = 0; i < 7; i++) clutch(c, 1);
    expect(c.clutchStreak).toBe(7);
    clutch(c, 0);
    expect(c.clutchStreak).toBe(-1);
    for (let i = 0; i < 3; i++) clutch(c, 0);
    expect(c.clutchStreak).toBe(-4);
    c.run = null;
    checkAchievements(c);
    expect(has(c, "ice_heart") || has(c, "chicken_heart")).toBe(false);

    c.run = { forced: null, form: 0 } as unknown as Career["run"];
    clutch(c, 0);
    checkAchievements(c);
    expect(has(c, "chicken_heart")).toBe(true);
    for (let i = 0; i < 8; i++) clutch(c, 1);
    checkAchievements(c);
    expect(has(c, "ice_heart")).toBe(true);
    // 동점을 만들고 연장에서 지면 실패로 쳐요.
    setRandom(() => 0.99);
    applyAction(c, { k: "clutch", attr: "sht", play: "레이업", p: 1, ot: 0.5 } as Parameters<typeof applyAction>[1]);
    expect(c.clutchStreak).toBe(-1);
  });

  it("결승 클러치 성공은 따로 세고, 한 커리어에서 10번이면 결승전의 사나이예요", () => {
    let finals = 0;
    for (let k = 0; k < 30; k++) {
      setRandom(seeded(300 + k));
      const pick = seeded(600 + k);
      const c = fresh(`fc-${k}`, (["PG", "SG", "SF", "PF", "C"] as const)[k % 5]);
      for (let steps = 0; c.stage !== "retired" && steps < 300; steps++) {
        const d = currentDecision(c);
        if (c.queue.length) chooseOption(c, Math.floor(pick() * d!.opts.length));
        else simulateSeason(c);
      }
      expect(c.finalClutchWins).toBeLessThanOrEqual(c.clutchWins);
      finals += c.finalClutchWins;
    }
    expect(finals).toBeGreaterThan(0);
    const c = fresh("final10");
    c.finalClutchWins = 9;
    checkAchievements(c);
    expect(has(c, "final_man")).toBe(false);
    c.finalClutchWins = 10;
    checkAchievements(c);
    expect(has(c, "final_man")).toBe(true);
  });

  it("역대 랭킹 업적은 온라인 순위로 정해요: 전체 TOP 10은 GOAT, 포지션 TOP 10은 그 포지션 업적", () => {
    expect(rankAchievements({ pos: "C", rank: 10, posRank: 3 })).toEqual(["goat", "legend_C"]);
    expect(rankAchievements({ pos: "PG", rank: 40, posRank: 10 })).toEqual(["legend_PG"]);
    expect(rankAchievements({ pos: "SF", rank: 11, posRank: 11 })).toEqual([]);
    // 엔진(커리어 기록)으로는 따지 않아요.
    const c = fresh("rank");
    checkAchievements(c);
    expect(c.achv.some((id) => id === "goat" || id.startsWith("legend_"))).toBe(false);
  });

  it("올-어라운드 플레이어: 다섯 포지션 모두 한 커리어에서 NBA 우승·NBA MVP·파이널 MVP", () => {
    const c = fresh("allround", "C");
    c.hist.push(season(2031, "보스턴 셀틱스", "nba", { result: "리그 우승" }), season(2032, "보스턴 셀틱스", "nba"));
    c.awardLog.push({ y: 2032, k: "mvp_nba", n: "NBA MVP" });
    expect(nbaTriple(c)).toBe(false);
    // 다른 리그의 파이널 MVP는 치지 않아요.
    c.hist.push(season(2033, "서울 SK 나이츠", "kbl", { result: "리그 우승" }));
    c.awardLog.push({ y: 2033, k: "fmvp", n: "파이널 MVP" });
    expect(nbaTriple(c)).toBe(false);
    c.awardLog.push({ y: 2031, k: "fmvp", n: "파이널 MVP" });
    expect(nbaTriple(c)).toBe(true);
    c.proSeasons = 3;
    expect(fromCareer(c).allround).toEqual(["C"]);

    setBrowserRecord(() => ({ unlocked: new Set(), recent: 0, others: { ...EMPTY_LIFETIME, allround: ["PG", "SG", "SF"] } }));
    checkAchievements(c);
    expect(has(c, "life_allround")).toBe(false);
    setBrowserRecord(() => ({ unlocked: new Set(), recent: 0, others: { ...EMPTY_LIFETIME, allround: ["PG", "SG", "SF", "PF"] } }));
    checkAchievements(c);
    expect(has(c, "life_allround")).toBe(true);

    // 예전에 저장한 누적 기록에는 allround가 없어도 더하고 뺄 수 있어요.
    const old = { ...EMPTY_LIFETIME } as Partial<typeof EMPTY_LIFETIME>;
    delete old.allround;
    expect(addLifetime(old as typeof EMPTY_LIFETIME, fromCareer(c)).allround).toEqual(["C"]);
    expect(subLifetime(fromCareer(c), old as typeof EMPTY_LIFETIME).allround).toEqual(["C"]);
    expect(subLifetime(fromCareer(c), fromCareer(c)).allround).toEqual([]);
  });

  it("막차 타고 정상까지와 1위의 저주는 시즌 순위표의 순위로 판정해요", () => {
    const team = TEAMS.nba[0][0];
    const cut = PLAYOFF_SPOTS.nba!;
    const champ = (y: number) => season(y, team, "nba", { gp: 82, w: 44, l: 38, result: "리그 우승" });
    let k = 0;
    let c = fresh("train-0");
    while (seasonStandings(c, champ(2031))!.rank !== cut) c = fresh(`train-${++k}`);
    c.hist.push(champ(2031));
    checkAchievements(c);
    expect(has(c, "last_train")).toBe(true);
    const other = fresh(`train-${k + 1}`);
    other.hist.push(champ(2031));
    if (seasonStandings(other, champ(2031))!.rank !== cut) {
      checkAchievements(other);
      expect(has(other, "last_train")).toBe(false);
    }

    const exit = (y: number) => season(y, team, "nba", { gp: 82, w: 60, l: 22, result: "플레이오프 1라운드", opps: [TEAMS.nba[1][0]] });
    k = 0;
    c = fresh("curse-0");
    while (seasonStandings(c, exit(2031))!.rank !== 1) c = fresh(`curse-${++k}`);
    c.hist.push(exit(2031));
    checkAchievements(c);
    expect(has(c, "first_curse")).toBe(true);
  });

  it("KBL 1위는 4강에 직행해서, 4강에서 지면 첫 시리즈 탈락이에요", () => {
    const team = TEAMS.kbl[0][0];
    const exit = { gp: 54, w: 40, l: 14, result: "4강 플레이오프", opps: [TEAMS.kbl[1][0]] };
    let k = 0;
    let c = fresh("kbl-0");
    while (seasonStandings(c, season(2031, team, "kbl", exit))!.rank !== 1) c = fresh(`kbl-${++k}`);
    c.hist.push(season(2031, team, "kbl", exit));
    checkAchievements(c);
    expect(has(c, "first_curse")).toBe(true);
    // 6강부터 치러 4강에서 졌으면 1위가 아니라서 저주가 아니에요.
    const six = fresh("kbl-six");
    six.hist.push(season(2031, team, "kbl", { ...exit, opps: [TEAMS.kbl[1][0], TEAMS.kbl[2][0]] }));
    checkAchievements(six);
    expect(has(six, "first_curse")).toBe(false);
  });

  it("만년 2인자, 고군분투, 식스맨의 반란, 득점 폭격기, 강철 체력, 서른 즈음에", () => {
    const c = fresh("misc");
    const lost = (y: number) => season(y, "보스턴 셀틱스", "nba", { result: "파이널 준우승", final: { opp: "덴버 너게츠", us: 90, them: 95, win: false } });
    c.hist.push(lost(2031), lost(2032), lost(2033));
    checkAchievements(c);
    expect(has(c, "runner_up")).toBe(false);
    c.hist.push(lost(2034));
    checkAchievements(c);
    expect(has(c, "runner_up")).toBe(true);

    // 승률 5할 미만 팀의 MVP, 식스맨상 다음 해 MVP
    c.hist.push(season(2035, "보스턴 셀틱스", "nba", { w: 30, l: 52 }), season(2036, "보스턴 셀틱스", "nba", { w: 50, l: 32 }));
    c.awardLog.push({ y: 2035, k: "sixth", n: "식스맨상" }, { y: 2035, k: "mvp_nba", n: "NBA MVP" });
    checkAchievements(c);
    expect(has(c, "lone_wolf")).toBe(true);
    expect(has(c, "sixth_rebel")).toBe(false);
    c.awardLog.push({ y: 2036, k: "mvp_nba", n: "NBA MVP" });
    checkAchievements(c);
    expect(has(c, "sixth_rebel")).toBe(true);

    expect(has(c, "bomber")).toBe(false);
    c.hist.push(season(2037, "보스턴 셀틱스", "nba", { pts: 40.2 }));
    checkAchievements(c);
    expect(has(c, "bomber")).toBe(true);

    const iron = fresh("iron");
    for (let y = 2031; y < 2038; y++) iron.hist.push(season(y, "서울 SK 나이츠", "kbl", { gp: 54 }));
    iron.hist.push(season(2038, "서울 SK 나이츠", "kbl", { gp: 53 }));
    checkAchievements(iron);
    expect(has(iron, "ironman")).toBe(false);
    iron.hist.push(season(2039, "보스턴 셀틱스", "nba", { gp: 82 }));
    checkAchievements(iron);
    expect(has(iron, "ironman")).toBe(true);
    // 2039년이면 28세라서 서른 즈음에는 아니에요.
    expect(has(iron, "thirty_rookie")).toBe(false);
    const late = fresh("late");
    late.hist.push(season(2040, "서울 SK 나이츠", "kbl"), season(2041, "보스턴 셀틱스", "nba"));
    checkAchievements(late);
    expect(has(late, "thirty_rookie")).toBe(true);
  });

  it("벤치의 터줏대감과 아낌없이 주는 나무는 은퇴할 때 정해져요", () => {
    const c = fresh("bench");
    for (let y = 2031; y < 2037; y++) c.hist.push(season(y, "서울 SK 나이츠", "kbl", { role: y % 2 ? "벤치" : "로테이션" }));
    checkAchievements(c);
    expect(has(c, "bench_keeper")).toBe(false);
    c.earnings = 50;
    c.spent = 150;
    c.donated = 100;
    toRetire(c);
    expect(has(c, "bench_keeper")).toBe(true);
    expect(has(c, "giving_tree")).toBe(true);

    const starter = fresh("starter");
    for (let y = 2031; y < 2037; y++) starter.hist.push(season(y, "서울 SK 나이츠", "kbl", { role: y === 2036 ? "식스맨" : "벤치" }));
    starter.earnings = 300;
    starter.spent = 100;
    starter.donated = 100;
    toRetire(starter);
    expect(has(starter, "bench_keeper")).toBe(false);
    expect(has(starter, "giving_tree")).toBe(false);
  });
});
