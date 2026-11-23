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
import { RETIRE_AGE } from "@/game/season/offseason";

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

  it("약체 팀으로 이적해 우승하면 시기와 팀의 순위에 맞는 업적을 따요", () => {
    const [from, weak, other] = TEAMS.nba.map(([n]) => n);
    const ring = { result: "리그 우승" };
    const missed = { exit: -1, last: false };
    const got = (id: string, rows: SeasonRecord[]) => {
      const c = fresh(id);
      c.hist.push(...rows);
      checkAchievements(c);
      return ["rebuild", "savior", "worst_to_first"].filter((a) => has(c, a));
    };
    const before = season(2030, from, "nba");

    expect(got("first", [before, season(2031, weak, "nba", { ...ring, joined: missed })])).toEqual(["rebuild", "savior"]);
    expect(got("worst", [before, season(2031, weak, "nba", { ...ring, joined: { exit: -1, last: true } })])).toEqual(["rebuild", "savior", "worst_to_first"]);
    expect(got("later", [before, season(2031, weak, "nba", { joined: missed }), season(2032, weak, "nba", ring)])).toEqual(["rebuild"]);
    // 약체가 아니었던 팀, NBA 밖의 우승, 신인 계약, 떠난 뒤 다른 팀에서 한 우승은 치지 않아요.
    expect(got("strong", [before, season(2031, weak, "nba", { ...ring, joined: { exit: 2, last: false } })])).toEqual([]);
    expect(got("kbl", [before, season(2031, TEAMS.kbl[0][0], "kbl", { ...ring, joined: { exit: -1, last: true } })])).toEqual([]);
    expect(got("rookie", [season(2031, weak, "nba", { ...ring, joined: missed })])).toEqual([]);
    expect(got("left", [before, season(2031, weak, "nba", { joined: missed }), season(2032, other, "nba", ring)])).toEqual([]);
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

describe("딸 수 없던 업적", () => {
  it("불혹의 현역은 40세 은퇴 직전 시즌(39세)을 뛰면 따요. 40세 시즌은 오지 않아요", () => {
    const c = fresh("forty");
    c.hist.push(season(2049, "서울 SK 나이츠", "kbl"));
    checkAchievements(c);
    expect(c.hist[0].age).toBe(RETIRE_AGE - 2);
    expect(has(c, "forty")).toBe(false);
    c.hist.push(season(2050, "서울 SK 나이츠", "kbl"));
    checkAchievements(c);
    expect(has(c, "forty")).toBe(true);

    // 39세 시즌을 경기에 나서지 못하고 보내면 따지 못해요.
    const idle = fresh("forty-idle");
    idle.hist.push(season(2050, "서울 SK 나이츠", "kbl", { gp: 0 }));
    checkAchievements(idle);
    expect(has(idle, "forty")).toBe(false);
  });

  it("은퇴하지 않고 끝까지 뛰면 마지막 시즌이 39세이고, 프로로 뛰었으면 불혹의 현역을 따요", () => {
    const rand = seeded(40);
    setRandom(rand);
    let veterans = 0;
    for (let i = 0; i < 6; i++) {
      const c = fresh(`forty-${i}`, (["PG", "SG", "SF", "PF", "C"] as const)[i % 5]);
      let steps = 0;
      while (c.stage !== "retired" && steps++ < 400) {
        const d = currentDecision(c);
        if (!d) {
          simulateSeason(c);
          continue;
        }
        // 은퇴·무소속을 피하고, 나머지는 무작위로 골라요(강제 은퇴는 선택지가 은퇴 하나뿐이에요).
        const keep = d.opts.map((o, j) => [o, j] as const).filter(([o]) => o.act.k !== "retire" && o.act.k !== "skip");
        const pool = keep.length ? keep : d.opts.map((o, j) => [o, j] as const);
        chooseOption(c, pool[Math.floor(rand() * pool.length)][1]);
      }
      expect(c.stage).toBe("retired");
      const ages = c.hist.map((h) => h.age);
      expect(Math.max(...ages)).toBeLessThan(RETIRE_AGE);
      const last39 = c.hist.some((h) => h.pro && h.age === RETIRE_AGE - 1 && h.gp > 0);
      expect(has(c, "forty")).toBe(last39);
      if (last39) veterans++;
    }
    expect(veterans).toBeGreaterThan(0);
  });

  it("해외 경로 고교 졸업생 일부는 워크온 제안을 받고, 워크온으로 NBA에 가면 워크온의 기적을 따요", () => {
    const rand = seeded(42);
    setRandom(rand);
    let walk = 0;
    let scholar = 0;
    for (let i = 0; i < 200; i++) {
      const pos = (["PG", "SG", "SF", "PF", "C"] as const)[i % 5];
      const c = createCareer({ name: "워크온", num: 7, nat: "미국", pos, path: "abroad" }, generateCandidates(pos)[i % 3], `walk-${i}`);
      while (c.stage === "hs") {
        const d = currentDecision(c);
        if (!d) simulateSeason(c);
        else if (d.title === "고교 졸업, 진로 선택") break;
        else chooseOption(c, Math.floor(rand() * d.opts.length));
      }
      const ncaa = currentDecision(c)!.opts.find((o) => o.act.k === "school" && o.act.lg === "ncaa");
      // 해외 경로 졸업생은 모두 NCAA 제안을 받아요. 일부는 장학생 대신 워크온이에요.
      expect(ncaa).toBeDefined();
      if (ncaa!.act.k === "school" && ncaa!.act.walk) walk++;
      else scholar++;
    }
    expect(walk).toBeGreaterThan(0);
    expect(walk).toBeLessThan(scholar / 3);

    const c = fresh("walk-nba");
    c.milestones.push("walkon");
    c.hist.push(season(2033, "보스턴 셀틱스", "nba"));
    checkAchievements(c);
    expect(has(c, "walk_on")).toBe(true);
  });

  it("NBA 드래프트 1순위로 지명되면 1순위의 무게를 따요", () => {
    setRandom(seeded(41));
    const c = createCareer({ name: "1순위", num: 1, nat: "미국", pos: "SF", path: "abroad" }, generateCandidates("SF")[0], "first");
    for (const k of ["sht", "hdl", "pas", "def", "iq", "ath"] as const) c.p.attrs[k] = 99;
    c.p.pot = 99;
    c.p.wsd = 8;
    c.age = 21;
    c.year = 2032;
    c.stage = "college";
    applyAction(c, { k: "draft", d: "nba" });
    expect(c.draft).toMatchObject({ lg: "NBA", pick: 1, round: 1, inRound: 1 });
    checkAchievements(c);
    expect(has(c, "first_pick")).toBe(true);
  });
});

describe("플레이오프 업적", () => {
  /** 플레이오프 기록 한 시즌: 기본은 6경기 평균 20점, 팀 2승 4패 */
  const po = (extra: Partial<NonNullable<SeasonRecord["po"]>> = {}): NonNullable<SeasonRecord["po"]> => ({
    gp: 6, min: 34, pts: 20, reb: 6, ast: 4, stl: 1, blk: 0.5, w: 2, l: 4, ...extra,
  });

  it("플레이오프 묶음이 생겼고, 업적 창에 팀·우승 다음으로 나와요", () => {
    expect(Object.keys(ACHIEVEMENT_GROUPS).slice(0, 3)).toEqual(["school", "team", "playoff"]);
    expect(ACHIEVEMENTS.filter((a) => a.group === "playoff").map((a) => a.name)).toEqual([
      "봄 농구 단골", "플레이오프 철인", "미스터 플레이오프", "빅게임 헌터", "플레이오프 모드", "통곡의 벽", "무결점 우승",
    ]);
  });

  it("봄 농구 단골은 플레이오프에 오른 프로 시즌을 세요. 플레이오프 기록이 생기기 전 시즌도 성적으로 알아봐요", () => {
    const c = fresh("po-reg");
    for (let y = 2030; y < 2042; y++) c.hist.push(season(y, "서울 SK 나이츠", "kbl"));
    c.hist.push(season(2042, "서울 SK 나이츠", "kbl", { result: "플레이오프 진출 실패" }));
    checkAchievements(c);
    expect(has(c, "po_regular")).toBe(false);
    c.hist.push(season(2043, "서울 SK 나이츠", "kbl", { po: po() }));
    checkAchievements(c);
    expect(has(c, "po_regular")).toBe(true);
  });

  it("플레이오프 철인과 미스터 플레이오프는 프로 플레이오프 통산 경기와 득점이에요", () => {
    const c = fresh("po-total");
    // 고교 전국대회 본선 기록은 프로 통산에 들지 않아요.
    c.hist.push(season(2028, "휘문고", "hs", { result: "전국대회 우승", po: po({ gp: 40, pts: 40 }) }));
    for (let y = 2031; y < 2036; y++) c.hist.push(season(y, "보스턴 셀틱스", "nba", { po: po({ gp: 20, pts: 25 }) }));
    checkAchievements(c);
    expect(has(c, "po_ironman")).toBe(false);
    expect(has(c, "po_mister")).toBe(false);
    c.hist.push(season(2036, "보스턴 셀틱스", "nba", { po: po({ gp: 20, pts: 25 }) }));
    checkAchievements(c);
    // 120경기 · 3,000점
    expect(has(c, "po_ironman")).toBe(true);
    expect(has(c, "po_mister")).toBe(true);
  });

  it("빅게임 헌터는 NBA 플레이오프에서 8경기 이상 평균 30점이에요", () => {
    const kbl = fresh("po-big-kbl");
    kbl.hist.push(season(2031, "서울 SK 나이츠", "kbl", { po: po({ gp: 12, pts: 36 }) }));
    const short = fresh("po-big-short");
    short.hist.push(season(2031, "보스턴 셀틱스", "nba", { po: po({ gp: 7, pts: 34 }) }));
    const nba = fresh("po-big");
    nba.hist.push(season(2031, "보스턴 셀틱스", "nba", { po: po({ gp: 8, pts: 30 }) }));
    for (const c of [kbl, short, nba]) checkAchievements(c);
    expect([kbl, short, nba].map((c) => has(c, "po_big_game"))).toEqual([false, false, true]);
  });

  it("플레이오프 모드는 그 시즌 정규시즌보다 플레이오프 평균 득점이 7점 이상 높아야 해요", () => {
    const c = fresh("po-mode");
    c.hist.push(season(2031, "서울 SK 나이츠", "kbl", { pts: 18, po: po({ gp: 8, pts: 24.9 }) }));
    checkAchievements(c);
    expect(has(c, "po_mode")).toBe(false);
    c.hist.push(season(2032, "서울 SK 나이츠", "kbl", { pts: 18, po: po({ gp: 8, pts: 25 }) }));
    checkAchievements(c);
    expect(has(c, "po_mode")).toBe(true);
  });

  it("통곡의 벽은 한 시즌 플레이오프 평균 스틸 3개·블록 3개예요", () => {
    const c = fresh("po-wall");
    c.hist.push(season(2031, "서울 SK 나이츠", "kbl", { po: po({ gp: 8, stl: 3, blk: 2.9 }) }));
    checkAchievements(c);
    expect(has(c, "po_wall")).toBe(false);
    c.hist.push(season(2032, "서울 SK 나이츠", "kbl", { po: po({ gp: 8, stl: 3, blk: 3 }) }));
    checkAchievements(c);
    expect(has(c, "po_wall")).toBe(true);
  });

  it("무결점 우승은 NBA·KBL에서 한 경기도 지지 않고, 직접 뛰며 우승해야 해요", () => {
    const champ = (id: string, lg: LeagueKey, team: string, extra: Partial<NonNullable<SeasonRecord["po"]>>) => {
      const c = fresh(id);
      c.hist.push(season(2031, team, lg, { result: "리그 우승", po: po({ gp: 16, w: 16, l: 0, ...extra }) }));
      checkAchievements(c);
      return has(c, "po_sweep");
    };
    expect(champ("sw-nba", "nba", "보스턴 셀틱스", {})).toBe(true);
    expect(champ("sw-kbl", "kbl", "서울 SK 나이츠", { gp: 8, w: 8 })).toBe(true);
    expect(champ("sw-lost", "nba", "보스턴 셀틱스", { gp: 17, l: 1 })).toBe(false);
    // 유로리그는 단판이라 우승하면 늘 전승이에요.
    expect(champ("sw-euro", "euro", "레알 마드리드", { gp: 3, w: 3 })).toBe(false);
    expect(champ("sw-out", "nba", "보스턴 셀틱스", { gp: 0 })).toBe(false);
  });
});
