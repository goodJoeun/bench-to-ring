import { afterEach, describe, expect, it } from "vitest";
import {
  ARCHETYPES,
  ATTR_KEYS,
  LEAGUES,
  NATIONS,
  POS_KEYS,
  TEAMS,
  chooseOption,
  createCareer,
  currentDecision,
  generateCandidate,
  generateCandidates,
  pathOf,
  resetRandom,
  seeded,
  setRandom,
  simulateSeason,
  type Career,
  type LeagueKey,
} from "@/game";
import { setTeam } from "@/game/career/log";
import { ncaaTies } from "@/game/world/leagues";
import { YOUTH_AGE } from "@/game/world/paths";
import { collegeSeasonEnd, generateOffers, highSchoolGraduation, homeDraftSize, homePick, nbaOffer, proDraftEntry } from "@/game/season/decisions";
import { runOffseason } from "@/game/season/offseason";
import { runDraft } from "@/game/world/draft";

afterEach(resetRandom);

/** 국적과 오버롤(모든 능력치 같은 값)을 정한 선수 */
function player(nat: string, attr: number, id = "p"): Career {
  const c = createCareer({ name: "진로", num: 7, nat, pos: "SF", path: "domestic" }, generateCandidates("SF")[0], id);
  for (const k of ATTR_KEYS) c.p.attrs[k] = attr;
  c.p.pot = Math.max(c.p.pot, attr + 5);
  return c;
}

/** 팀을 옮겨 프로 선수로 만들어요. */
function asPro(c: Career, lg: LeagueKey, age: number, years = 2): Career {
  setTeam(c, lg, { name: TEAMS[lg][0][0], color: TEAMS[lg][0][1], q: 0.5 });
  c.stage = "pro";
  c.age = age;
  c.contract = { years, salary: 1 };
  return c;
}

function play(c: Career, rand: () => number): void {
  let steps = 0;
  while (c.stage !== "retired" && steps++ < 200) {
    if (c.queue.length) {
      const d = currentDecision(c);
      expect(d, "대기열 맨 앞은 항상 준비된 결정이어야 해요").not.toBeNull();
      expect(d!.opts.length, `${c.p.nat} ${c.age}세 ${d!.title}: 선택지가 있어야 해요`).toBeGreaterThan(0);
      expect(chooseOption(c, Math.floor(rand() * d!.opts.length))).toBe(true);
    } else simulateSeason(c);
  }
}

const tags = (c: Career) => highSchoolGraduation(c).opts.map((o) => o.tag);

describe("국적별 진로 표", () => {
  it("아시아 국적은 자국 대학과 프로 리그로 이어져요", () => {
    expect(pathOf("대한민국")).toMatchObject({ college: "kuniv", pro: "kbl", draft: "kbl" });
    expect(pathOf("일본")).toMatchObject({ college: "juniv", pro: "bleague", draft: "bleague" });
    expect(pathOf("필리핀")).toMatchObject({ college: "uaap", pro: "pba", draft: "pba" });
    expect(pathOf("중국")).toMatchObject({ college: "cubal", pro: "cba", draft: "cba" });
    expect(pathOf("호주")).toMatchObject({ college: null, pro: "nbl", draft: null, ncaa: true });
  });

  it("유럽 국적은 대학과 드래프트 없이 자국 리그 구단과 바로 계약해요", () => {
    expect(pathOf("프랑스")).toMatchObject({ college: null, pro: "lnb", draft: null, ncaa: true, quota: [] });
    expect(pathOf("스페인")).toMatchObject({ college: null, pro: "acb", draft: null, ncaa: true, quota: [] });
    expect(pathOf("세르비아")).toMatchObject({ college: null, pro: "aba", draft: null, ncaa: true, quota: [] });
  });

  it("유로리그에 나가는 구단은 자국 리그 목록에 없어요", () => {
    const euro = TEAMS.euro.map(([n]) => n);
    for (const lg of ["lnb", "acb", "aba"] as const) for (const [name] of TEAMS[lg]) expect(euro, name).not.toContain(name);
    expect(LEAGUES.aba.avg).toBeLessThan(LEAGUES.lnb.avg);
    expect(LEAGUES.lnb.avg).toBeLessThan(LEAGUES.acb.avg);
    expect(LEAGUES.acb.avg).toBeLessThan(LEAGUES.euro.avg);
  });

  it("북미 국적은 NCAA가 주된 길이고, 다른 나라 리그의 외국선수로 뛰어요", () => {
    expect(pathOf("미국")).toMatchObject({ college: null, pro: "gleague", draft: null, ncaa: true, quota: [] });
    expect(pathOf("캐나다")).toMatchObject({ college: "usports", pro: "cebl", draft: null, ncaa: true, quota: [] });
    for (const lg of ["cebl", "kbl", "bleague", "cba", "pba", "nbl", "acb"] as const) expect(pathOf("미국").imports, lg).toContain(lg);
    // 캐나다 선수에게 CEBL은 자국 리그예요.
    expect(pathOf("캐나다").imports).not.toContain("cebl");
    expect(pathOf("캐나다").imports).toContain("kbl");
    // 다른 국적은 외국선수 자리로 가지 않아요.
    for (const n of NATIONS) if (n.name !== "미국" && n.name !== "캐나다") expect(pathOf(n.name).imports, n.name).toEqual([]);
    // CEBL은 G리그보다 한참 아래, KBL 언저리예요.
    expect(LEAGUES.cebl.avg).toBeGreaterThanOrEqual(LEAGUES.kbl.avg);
    expect(LEAGUES.cebl.avg).toBeLessThan(LEAGUES.cba.avg);
    expect(LEAGUES.usports.avg).toBeLessThan(LEAGUES.ncaa.avg);
  });

  it("표에 없는 국적은 예전처럼 U-리그·KBL로 가요", () => {
    expect(pathOf("몽골")).toMatchObject({ college: "kuniv", pro: "kbl", quota: [], imports: [] });
  });

  it("모든 국적의 진로가 실제 리그를 가리켜요", () => {
    for (const n of NATIONS) {
      const p = pathOf(n.name);
      expect(LEAGUES[p.pro].pro).toBe(true);
      if (p.college) expect(LEAGUES[p.college].pro).toBe(false);
      for (const lg of p.quota) expect(LEAGUES[lg].pro).toBe(true);
      for (const lg of p.imports) expect(LEAGUES[lg].pro).toBe(true);
    }
  });

  it("팀 이름은 모든 리그를 통틀어 하나씩이에요", () => {
    const names = Object.values(TEAMS).flatMap((list) => list.map(([n]) => n));
    expect(new Set(names).size).toBe(names.length);
    for (const lg of Object.keys(LEAGUES) as LeagueKey[]) expect(TEAMS[lg].length, lg).toBeGreaterThanOrEqual(8);
  });
});

describe("고교 졸업 진로", () => {
  it("일본·필리핀·중국 선수는 자국 대학 진학을 고를 수 있어요", () => {
    setRandom(seeded(1));
    expect(tags(player("일본", 52))).toEqual(["일본 대학"]);
    expect(tags(player("필리핀", 52))).toEqual(["UAAP"]);
    expect(tags(player("중국", 52))).toEqual(["CUBAL"]);
    expect(tags(player("대한민국", 52))).toEqual(["U-리그"]);
  });

  it("잘하는 고교 졸업생은 자국 신인드래프트에 고졸로 나설 수 있어요", () => {
    setRandom(seeded(2));
    // B.리그 평균 72 - 9 = 63부터
    const jp = highSchoolGraduation(player("일본", 64));
    expect(jp.opts.map((o) => o.label)).toContain("B.리그 드래프트 고졸 참가");
    expect(highSchoolGraduation(player("일본", 61)).opts.map((o) => o.tag)).not.toContain("드래프트");
    expect(highSchoolGraduation(player("필리핀", 60)).opts.map((o) => o.label)).toContain("PBA 신인드래프트 고졸 참가");
    expect(highSchoolGraduation(player("중국", 63)).opts.map((o) => o.label)).toContain("CBA 신인드래프트 고졸 참가");
  });

  it("호주 선수는 자국 대학이 없어서 NCAA나 NBL 계약으로 가요", () => {
    setRandom(seeded(3));
    // 아무리 낮아도 NCAA 워크온은 받아 줘요.
    const low = highSchoolGraduation(player("호주", 46));
    expect(low.opts).toHaveLength(1);
    expect(low.opts[0].act).toMatchObject({ k: "school", lg: "ncaa", walk: true });
    // NCAA 평균 - 5부터 장학생, NBL 평균 - 14부터 육성 선수, - 9부터 Next Stars
    const mid = highSchoolGraduation(player("호주", 63));
    expect(mid.opts.map((o) => o.tag)).toEqual(["NCAA", "NBL"]);
    expect(mid.opts[0].act).toMatchObject({ k: "school", lg: "ncaa", walk: false });
    expect(mid.opts[1].label).toMatch(/육성 선수 계약$/);
    expect(mid.opts[1].act).toMatchObject({ k: "sign", lg: "nbl", years: 2, deal: true });
    const top = highSchoolGraduation(player("호주", 68));
    expect(top.opts[1].label).toMatch(/Next Stars 계약$/);
    expect(tags(player("호주", 68))).toEqual(["NCAA", "Next Stars"]);
  });

  it("유럽 선수는 구단 유소년을 마치면 NCAA나 자국 리그 유스·프로 계약으로 가요", () => {
    setRandom(seeded(32));
    for (const [nat, lg, low] of [["프랑스", "lnb", "에스푸아 계약"], ["스페인", "acb", "유스 계약"], ["세르비아", "aba", "유스 계약"]] as const) {
      const avg = LEAGUES[lg].avg;
      // 아무리 낮아도 NCAA 워크온은 받아 줘요. 자국 대학이나 드래프트는 없어요.
      const weak = highSchoolGraduation(player(nat, 46));
      expect(weak.opts.map((o) => o.act), nat).toEqual([expect.objectContaining({ k: "school", lg: "ncaa", walk: true })]);
      // 리그 평균 - 14부터 유스(에스푸아) 계약, - 9부터 프로 계약
      const mid = highSchoolGraduation(player(nat, avg - 13));
      expect(mid.opts[1].label.endsWith(low), `${nat} ${mid.opts[1].label}`).toBe(true);
      expect(mid.opts[1].act).toMatchObject({ k: "sign", lg, years: 2, deal: true });
      const top = highSchoolGraduation(player(nat, avg - 8));
      expect(top.opts[1].label.endsWith("프로 계약"), `${nat} ${top.opts[1].label}`).toBe(true);
      expect(top.opts.map((o) => o.tag)).toEqual(["NCAA", LEAGUES[lg].short]);
    }
  });

  it("미국 선수는 고교를 마치면 NCAA로 가요", () => {
    setRandom(seeded(33));
    // 아무리 낮아도 워크온은 받아 줘요.
    expect(highSchoolGraduation(player("미국", 46)).opts.map((o) => o.act)).toEqual([expect.objectContaining({ k: "school", lg: "ncaa", walk: true })]);
    // 아무리 잘해도 고졸로 G리그에 가는 길은 없어요.
    const top = highSchoolGraduation(player("미국", 72));
    expect(top.opts.map((o) => o.tag)).toEqual(["NCAA"]);
    expect(top.opts[0].act).toMatchObject({ k: "school", lg: "ncaa", walk: false });
  });

  it("캐나다 선수는 NCAA나 자국 대학 U 스포츠로 가요", () => {
    setRandom(seeded(34));
    expect(tags(player("캐나다", 46))).toEqual(["NCAA", "U 스포츠"]);
    // 드래프트도 고졸 프로 계약도 없어요.
    const top = highSchoolGraduation(player("캐나다", 68));
    expect(top.opts.map((o) => o.tag)).toEqual(["NCAA", "U 스포츠"]);
    expect(top.opts[1].act).toMatchObject({ k: "school", lg: "usports" });
  });

  it("NCAA 제안의 절반쯤은 그 나라 선수가 많이 간 학교에서 와요", () => {
    setRandom(seeded(35));
    const ties = ncaaTies("호주").map(([n]) => n);
    expect(ties).toEqual(["세인트메리대"]);
    let hit = 0;
    for (let i = 0; i < 200; i++) {
      const a = highSchoolGraduation(player("호주", 62)).opts[0].act;
      if (a.k === "school" && ties.includes(a.team.name)) hit++;
    }
    // 절반은 인연 학교, 나머지 절반은 22개 학교 가운데 무작위예요.
    expect(hit).toBeGreaterThan(80);
    expect(hit).toBeLessThan(130);
    // 표에 적은 학교는 모두 NCAA 목록에 있어요.
    const count: Record<string, number> = { 대한민국: 2, 일본: 2, 호주: 1, 캐나다: 5, 프랑스: 1, 스페인: 2, 세르비아: 1 };
    for (const n of NATIONS) expect(ncaaTies(n.name), n.name).toHaveLength(count[n.name] ?? 0);
  });

  it("NBL 육성 계약을 고르면 협상 없이 바로 프로가 돼요", () => {
    setRandom(seeded(4));
    const c = player("호주", 63);
    c.queue = [highSchoolGraduation(c)];
    expect(chooseOption(c, 1)).toBe(true);
    expect(c.stage).toBe("pro");
    expect(c.team?.lg).toBe("nbl");
    expect(c.contract).toEqual({ years: 2, salary: 0.4 });
    expect(c.queue).toHaveLength(0);
  });
});

describe("대학 시즌 종료", () => {
  it("자국 대학 선수는 자국 신인드래프트를 신청해요", () => {
    setRandom(seeded(5));
    const c = player("일본", 62);
    setTeam(c, "juniv", { name: TEAMS.juniv[0][0], color: TEAMS.juniv[0][1], q: 0.5 });
    c.stage = "college";
    c.collegeYears = 4;
    const d = collegeSeasonEnd(c);
    expect(d.opts.map((o) => o.label)).toEqual(["B.리그 드래프트 신청"]);
    expect(d.opts[0].act).toEqual({ k: "draft", d: "bleague" });
  });

  it("NCAA를 마친 호주 선수는 NBA 드래프트나 NBL 계약을 골라요", () => {
    setRandom(seeded(6));
    const grad = (attr: number) => {
      const c = player("호주", attr);
      setTeam(c, "ncaa", { name: TEAMS.ncaa[0][0], color: TEAMS.ncaa[0][1], q: 0.5 });
      c.stage = "college";
      c.collegeYears = 4;
      return collegeSeasonEnd(c);
    };
    // NBL은 리그 평균 - 12부터 받아 줘요.
    const d = grad(LEAGUES.nbl.avg - 12);
    expect(d.opts.map((o) => o.tag)).toEqual(["NBA", "NBL"]);
    expect(d.opts[1].act).toMatchObject({ k: "sign", lg: "nbl" });
    // 그 아래는 NBA 드래프트에 나선 뒤 시장에서 팀을 찾아요.
    expect(grad(LEAGUES.nbl.avg - 14).opts.map((o) => o.tag)).toEqual(["NBA"]);
  });

  it("NCAA를 마친 미국 선수는 NBA 드래프트에 나서요", () => {
    setRandom(seeded(61));
    const c = player("미국", 72);
    setTeam(c, "ncaa", { name: TEAMS.ncaa[0][0], color: TEAMS.ncaa[0][1], q: 0.5 });
    c.stage = "college";
    c.collegeYears = 4;
    // G리그·해외 제안은 드래프트 뒤에 받아요.
    expect(collegeSeasonEnd(c).opts.map((o) => o.tag)).toEqual(["NBA"]);
  });

  it("대학을 마친 캐나다 선수는 CEBL 구단과 바로 계약해요", () => {
    setRandom(seeded(62));
    const grad = (lg: LeagueKey, attr: number) => {
      const c = player("캐나다", attr);
      setTeam(c, lg, { name: TEAMS[lg][0][0], color: TEAMS[lg][0][1], q: 0.5 });
      c.stage = "college";
      c.collegeYears = 4;
      return collegeSeasonEnd(c);
    };
    const ok = LEAGUES.cebl.avg - 10;
    expect(grad("usports", ok).opts.map((o) => o.tag)).toEqual(["CEBL"]);
    expect(grad("usports", ok).opts[0].act).toMatchObject({ k: "sign", lg: "cebl" });
    expect(grad("ncaa", ok).opts.map((o) => o.tag)).toEqual(["NBA", "CEBL"]);
    // CEBL 기준(평균 - 12)에 못 미치는 U 스포츠 졸업생은 팀 없이 시장에 나가요.
    expect(grad("usports", LEAGUES.cebl.avg - 15).opts.map((o) => o.act)).toEqual([{ k: "skip" }]);
  });

  it("진로 표가 생기기 전에 U-리그에 들어간 호주 선수는 KBL 드래프트로 프로에 가요", () => {
    setRandom(seeded(7));
    const c = player("호주", 60);
    setTeam(c, "kuniv", { name: TEAMS.kuniv[0][0], color: TEAMS.kuniv[0][1], q: 0.5 });
    c.stage = "college";
    c.collegeYears = 4;
    expect(collegeSeasonEnd(c).opts.map((o) => o.act)).toEqual([{ k: "draft", d: "kbl" }]);
  });
});

describe("자국 신인드래프트", () => {
  it("KBL 드래프트 순위는 예전 공식 그대로예요", () => {
    const old = (score: number) => Math.max(1, Math.round(20 - (score - (LEAGUES.kbl.avg - 11)) * 1.3));
    for (let s = 50; s <= 80; s += 0.5) expect(homePick("kbl", s)).toBe(old(s));
  });

  it("리그 평균 - 11이면 마지막 순위이고, 리그가 달라도 평균 대비 같은 실력이면 같은 라운드예요", () => {
    for (const d of ["kbl", "bleague", "pba", "cba"] as const) {
      const size = homeDraftSize(d);
      expect(size).toBe(TEAMS[d].length * 2);
      expect(homePick(d, LEAGUES[d].avg - 11)).toBe(size);
      expect(homePick(d, LEAGUES[d].avg - 12)).toBeGreaterThan(size);
      expect(homePick(d, LEAGUES[d].avg - 3)).toBeLessThanOrEqual(size / 2);
      expect(homePick(d, LEAGUES[d].avg + 6)).toBe(1);
    }
  });

  it("지명되면 그 리그 구단에 신인 계약으로 입단하고 지명 순서가 남아요", () => {
    for (const [nat, d, lg] of [["일본", "bleague", "B.리그"], ["필리핀", "pba", "PBA"], ["중국", "cba", "CBA"]] as const) {
      setRandom(seeded(8));
      const c = player(nat, LEAGUES[d].avg);
      c.age = 22;
      runDraft(c, d);
      expect(c.stage).toBe("pro");
      expect(c.team?.lg).toBe(d);
      expect(c.draft).toMatchObject({ lg, round: 1 });
      expect(c.contract!.years).toBeGreaterThanOrEqual(2);
      expect(c.draftShow!.picks).toHaveLength(homeDraftSize(d));
      expect(c.draftShow!.picks.filter((p) => p.mine)).toHaveLength(1);
      // 한 라운드에 모든 구단이 한 번씩 뽑아요.
      const round1 = c.draftShow!.picks.slice(0, c.draftShow!.roundSize).map((p) => p.team);
      expect(new Set(round1).size).toBe(TEAMS[d].length);
    }
  });
});

describe("계약 제안", () => {
  const leaguesOf = (c: Career, n = 60) => {
    const seen = new Map<string, Set<string>>();
    for (let i = 0; i < n; i++)
      for (const o of generateOffers(c, null, 6)) {
        if (o.act.k !== "sign") continue;
        if (!seen.has(o.act.lg)) seen.set(o.act.lg, new Set());
        seen.get(o.act.lg)!.add(o.tag ?? "");
      }
    return seen;
  };

  it("자국 프로 리그의 제안이 와요", () => {
    setRandom(seeded(9));
    for (const [nat, lg] of [
      ["일본", "bleague"], ["필리핀", "pba"], ["중국", "cba"], ["호주", "nbl"], ["대한민국", "kbl"], ["프랑스", "lnb"], ["스페인", "acb"], ["세르비아", "aba"],
    ] as const) {
      const c = player(nat, LEAGUES[lg].avg - 8);
      c.age = 25;
      const seen = leaguesOf(c, 5);
      expect([...seen.keys()], nat).toContain(lg);
    }
  });

  it("주전급 아시아 선수는 다른 나라 리그의 아시아쿼터 제안을 받아요", () => {
    setRandom(seeded(10));
    const kr = player("대한민국", 73);
    kr.age = 26;
    const seen = leaguesOf(kr);
    expect(seen.get("bleague")).toEqual(new Set(["아시아쿼터"]));
    expect(seen.get("nbl")).toEqual(new Set(["아시아쿼터"]));
    // 필리핀 선수는 KBL·B.리그 아시아쿼터로 나가요. 호주 NBL은 아시아쿼터 대상이 아니에요.
    const ph = player("필리핀", 74);
    ph.age = 24;
    const phSeen = leaguesOf(ph);
    expect(phSeen.get("kbl")).toEqual(new Set(["아시아쿼터"]));
    expect(phSeen.get("bleague")).toEqual(new Set(["아시아쿼터"]));
    expect(phSeen.has("nbl")).toBe(false);
  });

  it("리그 평균 - 3에 못 미치면 아시아쿼터 제안은 오지 않아요", () => {
    setRandom(seeded(11));
    const kr = player("대한민국", 66);
    kr.age = 26;
    const seen = leaguesOf(kr);
    expect(seen.has("bleague")).toBe(false);
    expect(seen.has("nbl")).toBe(false);
    expect(seen.has("kbl")).toBe(true);
  });

  it("미국·유럽 선수는 아시아쿼터 제안을 받지 않아요", () => {
    setRandom(seeded(12));
    for (const nat of ["프랑스", "스페인", "세르비아"]) {
      const c = player(nat, 74);
      c.age = 26;
      const seen = leaguesOf(c);
      expect(seen.has("bleague"), nat).toBe(false);
      expect(seen.has("nbl"), nat).toBe(false);
      // 유럽 선수는 이제 KBL이 아니라 자국 리그로 가요.
      expect(seen.has("kbl"), nat).toBe(false);
    }
    // 북미 선수가 아시아 리그에 가면 아시아쿼터가 아니라 외국선수예요.
    for (const nat of ["미국", "캐나다"]) {
      const c = player(nat, 74);
      c.age = 26;
      for (const [lg, tag] of leaguesOf(c)) if (lg !== pathOf(nat).pro && lg !== "euro") expect([...tag], `${nat} ${lg}`).toEqual(["외국선수"]);
    }
  });

  it("주전급 북미 선수는 세계 여러 리그의 외국선수 제안을 받아요", () => {
    setRandom(seeded(122));
    const us = player("미국", 71);
    us.age = 25;
    const seen = leaguesOf(us, 200);
    for (const lg of ["cebl", "pba", "kbl", "cba", "bleague", "aba", "lnb"]) expect(seen.get(lg), lg).toEqual(new Set(["외국선수"]));
    // 호주 NBL은 평균 - 3(73)부터라 아직 오지 않아요.
    expect(seen.has("nbl")).toBe(false);
    // 한 번에 두 리그까지만 제안해요.
    for (let i = 0; i < 30; i++) expect(generateOffers(us, null, 6).filter((o) => o.tag === "외국선수").length).toBeLessThanOrEqual(2);
  });

  it("외국선수 자리는 리그 평균 - 3부터지만, CEBL은 미국 선수도 평균 - 12부터 받아 줘요", () => {
    setRandom(seeded(123));
    const us = player("미국", LEAGUES.cebl.avg - 10);
    us.age = 24;
    const seen = leaguesOf(us);
    expect([...seen.keys()]).toEqual(["cebl"]);
    // 그보다 낮으면 어느 리그도 부르지 않아요.
    const low = player("미국", LEAGUES.cebl.avg - 15);
    low.age = 24;
    expect(leaguesOf(low).size).toBe(0);
  });

  it("미국 선수의 자국 리그는 G리그예요", () => {
    setRandom(seeded(124));
    // 다른 국적은 G리그 평균 - 9, 27세까지지만 미국 선수는 평균 - 12, 30세까지 받아 줘요.
    const us = player("미국", LEAGUES.gleague.avg - 11);
    us.age = 29;
    expect(leaguesOf(us).get("gleague")).toEqual(new Set(["G리그"]));
    const kr = player("대한민국", LEAGUES.gleague.avg - 11);
    kr.age = 25;
    expect(leaguesOf(kr).has("gleague")).toBe(false);
    us.age = 31;
    expect(leaguesOf(us).has("gleague")).toBe(false);
  });

  it("캐나다 선수는 CEBL에서 뛰고, 실력이 되면 외국선수로도 나가요", () => {
    setRandom(seeded(125));
    const low = player("캐나다", LEAGUES.cebl.avg - 10);
    low.age = 24;
    expect([...leaguesOf(low).keys()]).toEqual(["cebl"]);
    const top = player("캐나다", 74);
    top.age = 25;
    const seen = leaguesOf(top, 200);
    expect(seen.get("cebl")).toEqual(new Set(["CEBL"]));
    expect(seen.get("kbl")).toEqual(new Set(["외국선수"]));
    expect(seen.get("bleague")).toEqual(new Set(["외국선수"]));
  });

  it("자국 리그에서 잘하는 유럽 선수는 유로리그 구단의 제안을 받아요", () => {
    setRandom(seeded(121));
    const c = player("세르비아", LEAGUES.euro.avg - 6);
    c.age = 25;
    const seen = leaguesOf(c, 10);
    expect(seen.has("euro")).toBe(true);
    expect(seen.has("aba")).toBe(true);
  });

  it("아시아 리그에서 NBA 평균을 넘어서면 NBA 구단이 데려가요", () => {
    setRandom(seeded(13));
    for (const lg of ["bleague", "cba", "pba", "nbl", "lnb", "acb", "aba"] as const) {
      const c = asPro(player("일본", LEAGUES.nba.avg + 3), lg, 26);
      expect(nbaOffer(c)?.title, lg).toBe("NBA 영입 제안");
      expect(nbaOffer(asPro(player("일본", LEAGUES.nba.avg), lg, 26))).toBeNull();
    }
  });
});

describe("프로 선수의 NBA 드래프트", () => {
  it("스카우트가 지켜보는 어린 NBL 선수는 NBA 드래프트 신청을 물어요", () => {
    setRandom(seeded(14));
    const c = asPro(player("호주", 74), "nbl", 19);
    c.p.pot = 90;
    const d = proDraftEntry(c);
    expect(d?.title).toBe("NBA 드래프트 신청");
    expect(d!.opts[0].act).toEqual({ k: "draft", d: "nba" });
    // 같은 실력이라도 22세를 넘기면 대상이 아니에요.
    expect(proDraftEntry(asPro(player("호주", 74), "nbl", 23))).toBeNull();
    // 유럽 프로 리그의 어린 선수도 NBA 스카우트가 지켜봐요.
    for (const lg of ["lnb", "acb", "aba", "euro"] as const) {
      const eu = asPro(player("프랑스", 74), lg, 19);
      eu.p.pot = 90;
      expect(proDraftEntry(eu)?.title, lg).toBe("NBA 드래프트 신청");
    }
    // 그 밖의 리그에서는 NBA 평균 - 7은 돼야 해요.
    const kbl = asPro(player("대한민국", 74), "kbl", 19);
    kbl.p.pot = 90;
    expect(proDraftEntry(kbl)).toBeNull();
    const star = asPro(player("대한민국", 81), "kbl", 20);
    expect(proDraftEntry(star)).not.toBeNull();
  });

  it("지명받지 못하면 소속팀에 남고 다시 신청할 수 없어요", () => {
    setRandom(seeded(15));
    const c = asPro(player("호주", 60), "nbl", 19);
    const team = c.team!.name;
    runDraft(c, "nba");
    expect(c.team?.name).toBe(team);
    expect(c.stage).toBe("pro");
    expect(c.queue).toHaveLength(0);
    expect(c.milestones).toContain("nbadraft");
    c.p.pot = 95;
    for (const k of ATTR_KEYS) c.p.attrs[k] = 78;
    expect(proDraftEntry(c)).toBeNull();
  });

  it("지명되면 NBA 팀으로 옮겨요", () => {
    setRandom(seeded(16));
    const c = asPro(player("중국", 84), "cba", 20);
    c.p.pot = 95;
    runDraft(c, "nba");
    expect(c.team?.lg).toBe("nba");
    expect(c.draft?.lg).toBe("NBA");
    expect(proDraftEntry(c)).toBeNull();
  });

  it("오프시즌에 대상이면 NBA 드래프트 신청이 대기열에 들어가요", () => {
    setRandom(seeded(17));
    const c = asPro(player("호주", 74), "nbl", 19, 2);
    c.p.pot = 90;
    c.year += 3;
    runOffseason(c, c.year - 1);
    expect(c.queue.some((q) => !("lazy" in q) && q.title === "NBA 드래프트 신청")).toBe(true);
  });
});

describe("육성 환경", () => {
  /** 같은 시드·같은 후보로 고교 3년을 보낸 뒤의 평균 오버롤 */
  const afterHighSchool = (nat: string) => {
    const rand = seeded(77);
    setRandom(rand);
    let sum = 0;
    for (let i = 0; i < 40; i++) {
      const pos = POS_KEYS[i % POS_KEYS.length];
      const c = createCareer({ name: "유", num: i, nat, pos, path: "domestic" }, generateCandidate(pos, i % ARCHETYPES[pos].length), `y-${i}`);
      let steps = 0;
      while (c.stage === "hs" && !c.queue.length && steps++ < 5) simulateSeason(c);
      sum += ATTR_KEYS.reduce((t, k) => t + c.p.attrs[k], 0) / ATTR_KEYS.length;
    }
    return sum / 40;
  };

  it("호주와 유럽·북미 강국은 육성 환경이 좋고, 다른 나라는 모두 같아요", () => {
    const strong: Record<string, number> = { 호주: 1.25, 프랑스: 1.2, 스페인: 1.25, 세르비아: 1.15, 미국: 1.15, 캐나다: 1.05 };
    for (const n of NATIONS) expect(pathOf(n.name).youth, n.name).toBe(strong[n.name] ?? 1);
    expect(YOUTH_AGE).toBe(22);
  });

  it("호주 선수는 고교를 마칠 때 다른 나라 선수보다 능력치가 높아요", () => {
    const au = afterHighSchool("호주");
    const jp = afterHighSchool("일본");
    expect(au - jp).toBeGreaterThan(1.5);
    expect(au - jp).toBeLessThan(6);
  });
});

describe("국적별 커리어 시뮬레이션", () => {
  const seen = (cs: Career[]) => new Set(cs.flatMap((c) => c.hist.map((h) => h.lg)).filter(Boolean));

  it("자국 리그가 있는 국적의 커리어가 모두 오류 없이 은퇴까지 가고, 자국 리그에서 뛰어요", () => {
    const expected: Record<string, { home: LeagueKey[]; never: LeagueKey[] }> = {
      일본: { home: ["juniv", "bleague"], never: ["kuniv", "uaap", "cubal", "pba", "cba"] },
      필리핀: { home: ["uaap", "pba"], never: ["kuniv", "juniv", "cubal", "cba", "nbl"] },
      중국: { home: ["cubal", "cba"], never: ["kuniv", "juniv", "uaap", "pba", "kbl"] },
      호주: { home: ["ncaa", "nbl"], never: ["kuniv", "juniv", "uaap", "cubal", "kbl", "pba", "cba", "bleague"] },
      대한민국: { home: ["kuniv", "kbl"], never: ["juniv", "uaap", "cubal", "pba", "cba", "lnb", "acb", "aba"] },
      프랑스: { home: ["lnb"], never: ["kuniv", "kbl", "acb", "aba", "nbl", "bleague"] },
      스페인: { home: ["acb"], never: ["kuniv", "kbl", "lnb", "aba", "nbl", "bleague"] },
      세르비아: { home: ["aba"], never: ["kuniv", "kbl", "lnb", "acb", "nbl", "bleague"] },
      미국: { home: ["ncaa", "gleague"], never: ["kuniv", "usports", "juniv", "uaap", "cubal"] },
      캐나다: { home: ["ncaa", "usports", "cebl"], never: ["kuniv", "juniv", "uaap", "cubal"] },
    };
    for (const [nat, want] of Object.entries(expected)) {
      const rand = seeded(nat.charCodeAt(0));
      setRandom(rand);
      const careers: Career[] = [];
      for (let i = 0; i < 30; i++) {
        const pos = POS_KEYS[i % POS_KEYS.length];
        const c = createCareer({ name: `${nat}${i}`, num: i, nat, pos, path: "domestic" }, generateCandidate(pos, i % ARCHETYPES[pos].length), `${nat}-${i}`);
        play(c, rand);
        expect(c.stage).toBe("retired");
        careers.push(c);
      }
      const lgs = seen(careers);
      for (const lg of want.home) expect(lgs.has(lg), `${nat} 선수가 ${lg}에서 뛰어야 해요`).toBe(true);
      for (const lg of want.never) expect(lgs.has(lg), `${nat} 선수는 ${lg}에서 뛰지 않아요`).toBe(false);
    }
  });
});
