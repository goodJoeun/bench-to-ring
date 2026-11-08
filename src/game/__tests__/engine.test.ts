import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ACHIEVEMENTS,
  EMPTY_LIFETIME,
  addLifetime,
  fromCareer,
  setBrowserRecord,
  ARCHETYPES,
  checkAchievements,
  retire,
  ATTR_KEYS,
  LEAGUES,
  NATIONS,
  LOOKS,
  LOOK_KEYS,
  lookFromSkin,
  owesService,
  playerLook,
  randomLooks,
  toLook,
  POS_KEYS,
  RECORD_BOARDS,
  applyAction,
  careerTotals,
  recordBoardsFor,
  chooseOption,
  createCareer,
  currentDecision,
  generateCandidate,
  generateCandidates,
  ovrOf,
  placeOnBoard,
  newlyRanked,
  rankHall,
  rankScore,
  sumSeasons,
  SCORE_CAP,
  resetRandom,
  scoreParts,
  SCORE_AWARDS,
  SCORE_OTHER,
  seeded,
  setRandom,
  START_CAP,
  CAP_JITTER,
  START_MIN,
  SPIKE_CAP,
  TEAMS,
  hsSchools,
  findTeam,
  STUDENT_ALLOWANCE,
  bodyOf,
  careerSummary,
  canAffordInvest,
  investCost,
  investLineup,
  investPerks,
  chosenInvest,
  INVESTMENTS,
  INVEST_OFFER,
  startCap,
  simulateSeason,
  simulateTournament,
  canRetire,
  startSeason,
  stepSeason,
  type SeasonStep,
  buy,
  donate,
  requestTransfer,
  canRequestTransfer,
  careerJourney,
  HOME_NATION,
  SHOP_SIZE,
  ownedItems,
  shopLineup,
  CRITICAL_HEALTH,
  injuryKind,
  evalOvr,
  evalOvrOf,
  specialtiesOf,
  specialtyBonus,
  COMPS,
  namuWikiUrl,
  careerProfile,
  similarPlayers,
  teamPower,
  titleHistory,
  stripYear,
  awardGroups,
  type AttrKey,
  type AwardKey,
  type LeagueKey,
  type SeasonRecord,
  type Career,
  type PosKey,
  type Decision,
  type CareerSummary,
} from "@/game";
import { SHORT } from "@/game/core/data";
import { awardName, conferenceFinalsMvpName, nbaConference } from "@/game/world/awards";
import {
  CLUTCH_DEFENSE,
  CLUTCH_OFFENSE,
  CLUTCH_SHOWN,
  bigGameDecision,
  clutchDecision,
  clutchFinal,
  clutchOdds,
  overtimeOdds,
  drawClutchLead,
  injuryDecision,
  lifeEvent,
  seasonEvent,
  signatureMove,
} from "@/game/season/events";
import { makeLiveGame } from "@/game/season/live";
import { giveAward, setTeam } from "@/game/career/log";
import { militaryDecision } from "@/game/world/military";
import { TRAITS, TRAIT_KEYS } from "@/game/player/players";
import { runOffseason } from "@/game/season/offseason";
import { leverage } from "@/game/season/decisions";
import { nationalCallUp, runNationalTeam } from "@/game/world/national";
import { browserRecord, loadAchievements, loadLifeView, parseCareer, saveCareer, saveHall, startLifetime } from "@/game/career/storage";
import { canDonate, donatedThisSeason, refreshShop, shopPerks } from "@/game/economy/shop";

afterEach(() => resetRandom());

/** 결정이 있으면 무작위로 고르고, 없으면 시즌을 진행해 은퇴까지 끝까지 플레이해요. */
function playToRetirement(c: Career, rand: () => number): number {
  let steps = 0;
  while (c.stage !== "retired" && steps++ < 200) {
    const d = currentDecision(c);
    if (c.queue.length) {
      expect(d, "대기열 맨 앞은 항상 준비된 결정이어야 해요").not.toBeNull();
      expect(chooseOption(c, Math.floor(rand() * d!.opts.length))).toBe(true);
    } else {
      simulateSeason(c);
    }
    for (const k of ATTR_KEYS) {
      expect(c.p.attrs[k]).toBeGreaterThanOrEqual(20);
      expect(c.p.attrs[k]).toBeLessThanOrEqual(99);
    }
    expect(c.health).toBeGreaterThanOrEqual(15);
  }
  return steps;
}

describe("후보 선수", () => {
  it("같은 유형을 다시 뽑으면 상한에 닿던 주특기도 값이 달라져요", () => {
    setRandom(seeded(10));
    const a = ARCHETYPES.SG.findIndex((x) => x.name === "퓨어 슈터");
    const shots = new Set(Array.from({ length: 60 }, () => generateCandidate("SG", a).attrs.sht));
    expect(shots.size).toBeGreaterThanOrEqual(4);
    for (const v of shots) expect(v).toBeGreaterThanOrEqual(55 - CAP_JITTER);
  });

  it("모든 포지션·플레이 유형에서 오버롤 45로 시작하고, 유형이 키우는 능력치가 상위권이에요", () => {
    setRandom(seeded(7));
    let miss = 0;
    let total = 0;
    for (let i = 0; i < 40; i++) {
      for (const pos of POS_KEYS) {
        ARCHETYPES[pos].forEach((arch, a) => {
          const cand = generateCandidate(pos, a);
          expect(Math.round(ovrOf(cand.attrs, pos))).toBe(45);
          for (const k of ATTR_KEYS) expect(cand.attrs[k]).toBeGreaterThanOrEqual(START_MIN);
          const top = (Object.entries(arch.e) as [AttrKey, number][]).sort((x, y) => y[1] - x[1])[0][0];
          const higher = ATTR_KEYS.filter((k) => cand.attrs[k] > cand.attrs[top]).length;
          if (higher > 2) miss++;
          total++;
        });
      }
    }
    expect(miss / total).toBeLessThan(0.05);
  });

  it("능력치 하나가 57을 넘는 후보는 아주 드물고, 넘어도 62까지예요", () => {
    setRandom(seeded(8));
    let spiked = 0;
    let total = 0;
    for (let i = 0; i < 100; i++) {
      for (const pos of POS_KEYS) {
        for (const cand of ARCHETYPES[pos].map((_, a) => generateCandidate(pos, a))) {
          const high = ATTR_KEYS.filter((k) => cand.attrs[k] > START_CAP);
          expect(high.length).toBeLessThanOrEqual(1);
          for (const k of ATTR_KEYS) expect(cand.attrs[k]).toBeLessThanOrEqual(SPIKE_CAP);
          if (high.length) spiked++;
          total++;
        }
      }
    }
    expect(spiked / total).toBeLessThan(0.03);
  });

  it("유형마다 주특기는 55, 강점은 50 언저리(±2)까지 시작해 같은 능력치라도 유형별로 차이가 나요", () => {
    setRandom(seeded(9));
    for (const pos of POS_KEYS)
      ARCHETYPES[pos].forEach((arch, a) => {
        for (let i = 0; i < 60; i++) {
          const cand = generateCandidate(pos, a);
          const over = ATTR_KEYS.filter((k) => cand.attrs[k] > startCap(arch, k) + CAP_JITTER);
          // 아주 드물게 가장 강한 능력치 하나만 5 더 열려요.
          expect(over.length).toBeLessThanOrEqual(1);
          for (const k of over) expect(cand.attrs[k]).toBeLessThanOrEqual(startCap(arch, k) + CAP_JITTER + 5);
        }
      });
    const avgShot = (pos: "SG", name: string) => {
      const a = ARCHETYPES[pos].findIndex((x) => x.name === name);
      let t = 0;
      for (let i = 0; i < 100; i++) t += generateCandidate(pos, a).attrs.sht;
      return t / 100;
    };
    expect(avgShot("SG", "퓨어 슈터") - avgShot("SG", "아이솔레이션 스코어러")).toBeGreaterThanOrEqual(4);
  });

  it("유형마다 어울리는 키와 윙스팬으로 시작하고, 16세에는 성인 키까지 조금 남아 있어요", () => {
    setRandom(seeded(10));
    for (const pos of POS_KEYS)
      ARCHETYPES[pos].forEach((arch, a) => {
        const body = bodyOf(pos, arch);
        for (let i = 0; i < 30; i++) {
          const cand = generateCandidate(pos, a);
          expect(cand.hFinal).toBeGreaterThanOrEqual(body.h[0]);
          expect(cand.hFinal).toBeLessThanOrEqual(body.h[1]);
          expect(cand.hFinal - cand.h).toBeGreaterThanOrEqual(2);
          expect(cand.hFinal - cand.h).toBeLessThanOrEqual(6);
          expect(cand.wsd).toBeGreaterThanOrEqual(body.wsd[0]);
          expect(cand.wsd).toBeLessThanOrEqual(body.wsd[1]);
        }
      });
    const big = ARCHETYPES.PG.find((x) => x.name === "빅 가드")!;
    expect(bodyOf("PG", big).h[0]).toBeGreaterThanOrEqual(189);
  });

  it("후보 세 명은 서로 다른 플레이 유형을 무작위로 받아요", () => {
    setRandom(seeded(11));
    for (const pos of POS_KEYS) {
      const seen = new Set<string>();
      for (let i = 0; i < 30; i++) {
        const names = generateCandidates(pos).map((c) => c.arch);
        expect(new Set(names).size).toBe(3);
        names.forEach((n) => seen.add(n));
      }
      expect(seen.size).toBe(ARCHETYPES[pos].length);
    }
  });
});

describe("커리어 시뮬레이션", () => {
  it("무작위로 고른 커리어 300개가 모두 오류 없이 은퇴까지 가요", () => {
    const rand = seeded(2027);
    setRandom(rand);
    const summaries: CareerSummary[] = [];
    for (let i = 0; i < 300; i++) {
      const pos = POS_KEYS[i % POS_KEYS.length];
      const cand = generateCandidate(pos, i % ARCHETYPES[pos].length);
      const c = createCareer(
        { name: `테스트${i}`, num: i % 100, nat: "대한민국", pos, path: i % 2 ? "abroad" : "domestic" },
        cand,
        `t${i}`,
      );
      playToRetirement(c, rand);
      expect(c.stage).toBe("retired");
      expect(c.summary).not.toBeNull();
      expect(c.age).toBeLessThanOrEqual(41);
      summaries.push(c.summary!);
    }
    const peaks = summaries.map((s) => s.peak).sort((a, b) => a - b);
    // 대부분은 평범한 커리어, 일부만 슈퍼스타가 돼요.
    expect(peaks[Math.floor(peaks.length / 2)]).toBeGreaterThan(65);
    expect(peaks[peaks.length - 1]).toBeLessThanOrEqual(99);
    expect(summaries.some((s) => s.seasons > 0)).toBe(true);
  });

  it("같은 시드면 같은 커리어가 나와요", () => {
    const run = () => {
      const rand = seeded(42);
      setRandom(rand);
      const c = createCareer({ name: "재현", num: 1, nat: "일본", pos: "PG", path: "abroad" }, generateCandidates("PG")[0], "same");
      playToRetirement(c, rand);
      return c.summary;
    };
    expect(run()).toEqual(run());
  });
});

describe("저장", () => {
  it("한글이 들어간 커리어도 그대로 되돌려요", () => {
    setRandom(seeded(3));
    const c = createCareer({ name: "벤치의 왕", num: 23, nat: "대한민국", pos: "SF", path: "domestic" }, generateCandidates("SF")[1], "save");
    simulateSeason(c);
    expect(parseCareer(JSON.stringify(c))).toEqual(c);
    expect(parseCareer("이건 저장 파일이 아니에요")).toBeNull();
  });
});

describe("예전 저장 파일", () => {
  it("리바운드·핸들링 능력치를 슛·볼 핸들링·패스·수비·BQ·운동능력으로 바꾸고 예전 오버롤을 지켜요", () => {
    setRandom(seeded(21));
    const c = createCareer({ name: "옛 능력치", num: 4, nat: "대한민국", pos: "C", path: "domestic" }, generateCandidates("C")[0], "attrs");
    const old = JSON.parse(JSON.stringify(c));
    old.p.attrs = { sht: 30, hdl: 34, def: 60, reb: 70, ath: 55, iq: 40 };
    old.lastDelta = { sht: 1, hdl: 2, def: 0, reb: 3, ath: -1, iq: 1 };
    old.focus = "reb";
    old.perks = { trainer: "reb" };
    old.queue = [{ title: "이벤트", body: "", opts: [{ label: "훈련", act: { k: "boost", attrs: { reb: 2 } } }] }];
    const m = parseCareer(JSON.stringify(old))!;
    expect(Object.keys(m.p.attrs).sort()).toEqual([...ATTR_KEYS].sort());
    // 예전 센터 가중치로 계산한 오버롤
    const oldOvr = 30 * 0.06 + 34 * 0.06 + 60 * 0.26 + 70 * 0.32 + 55 * 0.18 + 40 * 0.12;
    expect(ovrOf(m.p.attrs, "C")).toBeCloseTo(oldOvr, 5);
    expect(m.p.attrs.pas).toBeCloseTo(m.p.attrs.hdl, 5);
    expect(m.lastDelta).toMatchObject({ hdl: 2, pas: 2 });
    expect(m.focus).toBe("bal");
    expect(m.perks.trainer).toBe("def");
    expect(m.queue[0]).toMatchObject({ opts: [{ act: { k: "boost", attrs: { def: 2 } } }] });
    // 이미 새 능력치인 저장은 그대로예요.
    expect(parseCareer(JSON.stringify(m))!.p.attrs).toEqual(m.p.attrs);
  });

  it("v1(가상 리그) 저장을 실제 리그 키로 바꿔서 불러와요", () => {
    setRandom(seeded(11));
    const c = createCareer({ name: "옛 저장", num: 3, nat: "대한민국", pos: "PG", path: "abroad" }, generateCandidates("PG")[0], "old");
    simulateSeason(c);
    const v1 = JSON.parse(JSON.stringify(c).replace('"v":2', '"v":1'));
    v1.team.lg = "court";
    v1.hist[0].lg = "gbl";
    v1.awards = { mvp_gbl: 2, ring: 1 };
    v1.awardLog = [{ y: 2027, k: "mvp_gbl", n: "GBL MVP" }];
    const loaded = parseCareer(JSON.stringify(v1))!;
    expect(loaded.v).toBe(2);
    expect(loaded.team?.lg).toBe("kbl");
    expect(loaded.hist[0].lg).toBe("nba");
    expect(loaded.awards).toEqual({ mvp_nba: 2, ring: 1 });
    expect(loaded.awardLog[0].k).toBe("mvp_nba");
  });
});

describe("생활 이벤트", () => {
  /** 해마다 이벤트를 하나씩 뽑아 제목을 모아요. */
  function draw(c: Career, years: number): string[] {
    const titles: string[] = [];
    for (let y = 0; y < years; y++) {
      const d = lifeEvent(c);
      if (d) {
        expect(d.opts.length).toBeGreaterThanOrEqual(2);
        for (const o of d.opts) expect(o.sub, `${d.title} · ${o.label}`).toBeTruthy();
        titles.push(d.title);
      }
      c.year++;
    }
    return titles;
  }

  it("한 번뿐인 이벤트는 다시 나오지 않고, 같은 이벤트는 3년 안에 반복되지 않아요", () => {
    setRandom(seeded(5));
    for (const stage of ["hs", "college", "pro", "free"] as const) {
      const c = createCareer({ name: "생활", num: 7, nat: "대한민국", pos: "SG", path: "abroad" }, generateCandidates("SG")[0], stage);
      c.stage = stage;
      if (stage === "pro") c.contract = { years: 3, salary: 20 };
      if (stage === "free") c.team = null;
      const titles = draw(c, 60);
      expect(titles.length).toBeGreaterThan(10);
      expect(titles.filter((t) => t === "부모님의 걱정").length).toBeLessThanOrEqual(1);
      expect(titles.filter((t) => t === "에이전시 이적 제안").length).toBeLessThanOrEqual(1);
      for (let i = 0; i < titles.length; i++) expect(titles.slice(i + 1, i + 3)).not.toContain(titles[i]);
    }
  });

  it("에이전시와 트레이너 효과는 커리어에 남고, 예전 저장에는 빈 값으로 채워져요", () => {
    setRandom(seeded(8));
    const c = createCareer({ name: "효과", num: 9, nat: "대한민국", pos: "C", path: "domestic" }, generateCandidates("C")[2], "perk");
    applyAction(c, { k: "boost", agency: true, trainer: "def", money: -1 });
    expect(c.perks).toEqual({ agency: true, trainer: "def" });
    expect(c.earnings).toBe(0);
    const old = JSON.parse(JSON.stringify(c));
    delete old.events;
    delete old.perks;
    const loaded = parseCareer(JSON.stringify(old))!;
    expect(loaded.events).toEqual({});
    expect(loaded.perks).toEqual({});
  });
});

describe("명예의 전당 순위", () => {
  const nbaTeam = TEAMS.nba[0][0];
  const kblTeam = TEAMS.kbl[0][0];
  const base = {
    mvp: 1,
    peak: 90,
    personal: 5,
    pts: 10000,
    reb: 3000,
    ast: 2000,
    teams: [nbaTeam],
    awards: { mvp_nba: 1 },
  } as CareerSummary;

  it("점수와 나머지 세 항목이 모두 같으면 공동 순위예요", () => {
    const ranked = rankHall([
      { ...base, id: "a" },
      { ...base, id: "b" },
      { ...base, id: "c", mvp: 2, awards: { mvp_nba: 2 } },
    ]);
    expect(ranked.map((r) => [r.career.id, r.rank])).toEqual([
      ["c", 1],
      ["a", 2],
      ["b", 2],
    ]);
  });

  it("NBA에서 받은 상과 쌓은 기록을 다른 리그보다 크게 쳐요", () => {
    const share = { seasons: 8, gp: 600, pts: 10000, reb: 3000, ast: 2000, awards: { mvp_nba: 1, fmvp: 2, ring: 2 } };
    const nba = { ...base, awards: { mvp_nba: 1, fmvp: 2, ring: 2 }, nba: share };
    // 같은 상을 NBA 밖에서 받았으면 30%만 쳐요.
    const abroad = { ...nba, nba: { ...share, awards: { mvp_nba: 1 } } };
    expect(rankScore(nba)).toBeGreaterThan(rankScore(abroad));
    expect(scoreParts(nba).awards - scoreParts(abroad).awards).toBeCloseTo((2 * 20 + 2 * 12) * (1 - SCORE_OTHER));
    // KBL에서만 MVP 9번을 받은 레전드보다 NBA MVP 2번이 위예요.
    const kblLegend = {
      ...base,
      mvp: 0,
      teams: [kblTeam],
      awards: { mvp: 9, allleague: 12, allstar: 12, ring: 4, fmvp: 3 },
      pts: 20000,
      nba: { seasons: 0, gp: 0, pts: 0, reb: 0, ast: 0, awards: {} },
    };
    const nbaStar = { ...base, mvp: 2, awards: { mvp_nba: 2, allleague: 3, allstar: 4 }, nba: { ...share, awards: { mvp_nba: 2, allleague: 3, allstar: 4 } } };
    expect(rankScore(nbaStar)).toBeGreaterThan(rankScore(kblLegend));
  });

  it("NBA 몫이 없는 예전 기록도 NBA MVP는 NBA 상으로 쳐요", () => {
    expect(scoreParts(base).awards).toBe(SCORE_AWARDS.mvp_nba);
    expect(scoreParts(base).nba).toBe(10);
    expect(scoreParts({ ...base, teams: [kblTeam] }).nba).toBe(0);
  });

  it("은퇴 요약에 NBA 몫과 캐릭터가 남아요", () => {
    const rand = seeded(21);
    setRandom(rand);
    const c = createCareer({ name: "요약", num: 1, nat: "대한민국", pos: "SF", path: "abroad" }, generateCandidates("SF")[0], "sum");
    playToRetirement(c, rand);
    const s = c.summary!;
    expect(s.nba).toBeDefined();
    expect(s.nba!.seasons).toBeLessThanOrEqual(s.seasons);
    expect(s.nba!.awards.mvp_nba ?? 0).toBe(s.mvp);
    expect(s.look).toMatchObject({ skin: expect.stringMatching(/^#/), hair: expect.stringMatching(/^#/) });
  });
});

describe("국가대표", () => {
  const nation = (name: string) => NATIONS.find((n) => n.name === name)!;
  /** n번 치러 금·메달 비율을 세요. */
  function odds(name: string, ev: "olympics" | "worldcup" | "asiangames", o: number, n = 2000) {
    let gold = 0;
    let medal = 0;
    for (let i = 0; i < n; i++) {
      const r = simulateTournament(ev, nation(name), teamPower(nation(name), ev, o));
      if (r.medal === "금") gold++;
      if (r.medal) medal++;
    }
    return { gold: gold / n, medal: medal / n };
  }

  it("한 대회에서 같은 나라를 두 번 만나지 않아요 (최종예선은 따로 세고, 지역 예선은 홈·원정이라 예외)", () => {
    setRandom(seeded(41));
    for (const ev of ["olympics", "worldcup", "asiangames", "asiacup", "eurobasket", "americup"] as const) {
      for (const name of ["대한민국", "미국", "프랑스", "호주", "일본"]) {
        const n = nation(name);
        for (let i = 0; i < 150; i++) {
          const r = simulateTournament(ev, n, teamPower(n, ev, 70 + (i % 25)), true);
          const main = r.games.filter((g) => !g.stage.startsWith("최종예선"));
          const oqt = r.games.filter((g) => g.stage.startsWith("최종예선"));
          for (const list of [main, oqt]) {
            const opps = list.map((g) => g.opp);
            expect(new Set(opps).size, `${ev} ${name}: ${list.map((g) => `${g.stage} ${g.opp}`).join(", ")}`).toBe(opps.length);
            expect(opps).not.toContain(name);
          }
        }
      }
    }
  });

  it("약체국은 스타가 있어도 올림픽·월드컵 메달이 거의 없고, 강호와 지역 대회는 현실적인 확률이에요", () => {
    setRandom(seeded(31));
    expect(odds("대한민국", "olympics", 85).medal).toBeLessThan(0.01);
    expect(odds("대한민국", "worldcup", 85).medal).toBeLessThan(0.02);
    const ag = odds("대한민국", "asiangames", 70);
    expect(ag.gold).toBeGreaterThan(0.05);
    expect(ag.gold).toBeLessThan(0.35);
    expect(odds("미국", "olympics", 88).gold).toBeGreaterThan(0.6);
  });

  it("약체국도 에이스가 있으면 가끔 올림픽 최종예선을 뚫어요", () => {
    setRandom(seeded(33));
    const qualify = (o: number, n = 3000) => {
      let q = 0;
      for (let i = 0; i < n; i++) if (!simulateTournament("olympics", nation("대한민국"), teamPower(nation("대한민국"), "olympics", o)).label.includes("최종예선")) q++;
      return q / n;
    };
    const ordinary = qualify(66);
    const ace = qualify(85);
    expect(ordinary).toBeGreaterThan(0.02);
    expect(ordinary).toBeLessThan(0.1);
    expect(ace).toBeGreaterThan(0.12);
    expect(ace).toBeLessThan(0.3);
  });

  it("발탁되면 대회마다 합류·불참을 고르고, 합류하면 출전 기록과 결과 소식이 남아요", () => {
    setRandom(seeded(32));
    const make = () => {
      const c = createCareer({ name: "대표", num: 5, nat: "대한민국", pos: "PG", path: "domestic" }, generateCandidates("PG")[0], "nat");
      c.age = 24;
      return c;
    };
    const c = make();
    expect(nationalCallUp(c, 60, 40, 2030)).toBeNull();
    expect(nationalCallUp(c, 70, 0, 2030)).toBeNull();
    const d = nationalCallUp(c, 70, 40, 2030)!;
    expect(d.title).toContain("2030 아시안게임");
    expect(d.opts.map((o) => o.act.k)).toEqual(["national", "national"]);

    applyAction(c, d.opts[0].act);
    expect(c.nat.caps).toBeGreaterThanOrEqual(3);
    expect(c.news[0].m).toContain("아시안게임 출전");

    const skip = make();
    skip.health = 80;
    applyAction(skip, d.opts[1].act);
    expect(skip.nat.caps).toBe(0);
    expect(skip.health).toBe(86);
    expect(skip.news[0].m).toContain("불참");
  });

  it("월드컵 예선 결과가 다음 해 월드컵 본선 진출을 정해요", () => {
    setRandom(seeded(33));
    const c = createCareer({ name: "예선", num: 6, nat: "프랑스", pos: "SF", path: "abroad" }, generateCandidates("SF")[0], "wcq");
    c.age = 25;
    applyAction(c, { k: "national", ev: "wcq", year: 2030, join: true });
    expect(c.nat.wcq?.y).toBe(2031);
    c.nat.wcq = { y: 2031, ok: false };
    applyAction(c, { k: "national", ev: "worldcup", year: 2031, join: true });
    expect(c.news[0].m).toContain("본선 진출 실패");
  });
});

describe("우승 기록", () => {
  it("어느 해, 어느 팀·리그에서 우승했는지와 파이널 MVP를 함께 보여줘요", () => {
    const c = createCareer({ name: "반지", num: 1, nat: "대한민국", pos: "SG", path: "abroad" }, generateCandidates("SG")[0], "ring");
    const rec = (year: number, team: string, lg: "hs" | "nba") =>
      ({ year, age: year - 2011, team, lg, pro: lg === "nba", awards: [] }) as unknown as Career["hist"][number];
    c.hist.push(rec(2028, "휘문고", "hs"), rec(2036, "보스턴 셀틱스", "nba"));
    c.awardLog.push(
      { y: 2036, k: "fmvp", n: "NBA 파이널 MVP" },
      { y: 2036, k: "ring", n: "NBA 우승" },
      { y: 2028, k: "title", n: "고교 전국대회 우승" },
      { y: 2030, k: "nat_gold", n: "2030 아시안게임 금메달" },
    );
    expect(titleHistory(c)).toEqual([
      { year: 2028, age: 17, name: "고교 전국대회 우승", team: "휘문고", league: "고교농구", kind: "amateur", fmvp: false },
      { year: 2030, age: null, name: "아시안게임 금메달", team: "대한민국 대표팀", league: null, kind: "nat", fmvp: false },
      { year: 2036, age: 25, name: "NBA 우승", team: "보스턴 셀틱스", league: "NBA", kind: "pro", fmvp: true },
    ]);
  });
});

describe("커리어 시작", () => {
  it("국적을 정하지 않으면 대한민국 선수로 시작하고 병역 의무가 있어요", () => {
    setRandom(seeded(13));
    const c = createCareer({ name: "국적", num: 7, pos: "PG", path: "domestic" }, generateCandidates("PG")[0], "kor");
    expect(c.p.nat).toBe(HOME_NATION);
    expect(HOME_NATION).toBe("대한민국");
    expect(c.mil).toEqual({ s: "none" });
  });

  it("고른 고등학교로 입학하고, 고르지 않으면 고교 중 하나로 정해져요", () => {
    setRandom(seeded(4));
    const input = { name: "입학", num: 5, nat: "대한민국", pos: "PG" as const, path: "domestic" as const };
    const chosen = createCareer({ ...input, school: "휘문고" }, generateCandidates("PG")[0], "s1");
    expect(chosen.team).toMatchObject({ lg: "hs", name: "휘문고" });
    expect(chosen.news[0].m).toContain("휘문고");
    for (const school of [undefined, "없는 학교"]) {
      const c = createCareer({ ...input, school }, generateCandidates("PG")[0], "s2");
      expect(TEAMS.hs.map(([n]) => n)).toContain(c.team!.name);
    }
  });

  it("국적마다 그 나라 고교(유소년)에 입학하고, 고교 시즌 상대도 그 나라 학교예요", () => {
    setRandom(seeded(5));
    for (const n of NATIONS) {
      const names = hsSchools(n.name).map(([s]) => s);
      const input = { name: "유학", num: 7, nat: n.name, pos: "SF" as const, path: "domestic" as const };
      const c = createCareer(input, generateCandidates("SF")[0], `nat-${n.name}`);
      expect(names, n.name).toContain(c.team!.name);
      expect(findTeam(c.team!.name)?.lg).toBe("hs");
      // 다른 나라 학교를 고르면 무작위 배정이에요.
      const other = createCareer({ ...input, school: n.name === "대한민국" ? "라쿠난고" : "휘문고" }, generateCandidates("SF")[0], "x");
      expect(names).toContain(other.team!.name);
      // 첫 고교 시즌의 정규시즌·전국대회 상대를 모아요.
      const opps = new Set<string>();
      startSeason(c);
      while (c.run && c.run.phase !== "end") {
        if (c.queue.length) chooseOption(c, 0);
        else stepSeason(c);
        for (const o of c.run?.opps ?? []) opps.add(o);
        for (const r of c.run?.post ?? []) opps.add(r.opp);
      }
      expect(opps.size, n.name).toBeGreaterThan(0);
      for (const o of opps) expect(names, `${n.name} · ${o}`).toContain(o);
    }
    const jp = createCareer({ name: "라쿠", num: 4, nat: "일본", pos: "PG", path: "domestic", school: "라쿠난고" }, generateCandidates("PG")[0], "jp");
    expect(jp.team?.name).toBe("라쿠난고");
    expect(jp.news[0].m).toContain("라쿠난고 농구부에 입단");
    const es = createCareer({ name: "마드리드", num: 4, nat: "스페인", pos: "PG", path: "domestic", school: "레알 마드리드 유소년" }, generateCandidates("PG")[0], "es");
    expect(es.news[0].m).toContain("레알 마드리드 유소년에 입단");
  });

  it("고른 캐릭터와 국적으로 시작하고, 대한민국 선수가 아니면 병역 의무가 없어요", () => {
    setRandom(seeded(17));
    for (const look of randomLooks(24)) {
      const c = createCareer({ name: "캐릭터", num: 1, nat: "스페인", look, pos: "SF", path: "domestic" }, generateCandidates("SF")[0], "look");
      expect(playerLook(c.p)).toEqual(look);
      expect(c.p.nat).toBe("스페인");
      expect(owesService(c)).toBe(false);
    }
    const random = createCareer({ name: "무작위", num: 2, pos: "PG", path: "domestic" }, generateCandidates("PG")[0], "rnd");
    expect(LOOK_KEYS).toContain(random.p.face?.kind);
  });

  it("캐릭터는 바탕마다 정해진 범위에서 조합하고, 섞어 뽑으면 네 바탕이 고르게 나와요", () => {
    setRandom(seeded(18));
    const mixed = randomLooks(24);
    for (const k of LOOK_KEYS) expect(mixed.filter((l) => l.kind === k).length).toBe(6);
    for (const l of [...mixed, ...randomLooks(40, "black")]) {
      const range = LOOKS[l.kind];
      expect(range.skins).toContain(l.skin);
      expect(range.hairs).toContain(l.hair);
      expect(range.styles).toContain(l.style);
      expect(range.eyes).toContain(l.eyes);
    }
    expect(new Set(randomLooks(40, "black").map((l) => l.style)).size).toBeGreaterThan(3);
  });

  it("캐릭터가 없는 예전 선수는 피부색으로 바탕을 짐작해요", () => {
    expect(lookFromSkin("#5E3A24")).toBe("black");
    expect(lookFromSkin("#f2d0b1")).toBe("white");
    expect(toLook({ skin: "#C68E63", hair: "#1B1B1B" })).toMatchObject({ kind: "hispanic", style: LOOKS.hispanic.styles[0], beard: "none" });
  });
});

describe("시즌 투자", () => {
  const pro = (seed: string) => {
    const c = createCareer({ name: "투자", num: 8, nat: "일본", pos: "SG", path: "abroad" }, generateCandidates("SG")[0], seed);
    c.stage = "pro";
    c.team = { lg: "kbl", name: "서울 SK 나이츠", color: "#E4002B", q: 0.5 };
    c.contract = { years: 3, salary: 2 };
    c.paidSalary = 2;
    c.age = 22;
    return c;
  };
  /** 투자는 시즌마다 몇 가지만 나와요. 필요한 투자가 모두 나오는 시즌으로 옮겨요. */
  const offering = (c: Career, keys: Career["invest"]) => {
    while (!keys.every((k) => investLineup(c).some((i) => i.key === k))) c.year++;
    return c.year;
  };

  it("연봉이 올라도 오른 연봉을 받기 전까지는 투자 비용이 그대로예요", () => {
    const c = pro("inv-raise");
    c.contract = { years: 3, salary: 5 };
    expect(investCost(c, "coach")).toBe(0.6);
    // 연봉이 깎이면 바로 싸져요.
    c.contract = { years: 3, salary: 1 };
    expect(investCost(c, "coach")).toBe(0.3);

    setRandom(seeded(32));
    c.contract = { years: 3, salary: 5 };
    c.invest = [];
    simulateSeason(c);
    expect(c.paidSalary).toBe(5);
    expect(investCost(c, "coach")).toBe(1.5);
  });

  it("보유 자금과 비용 합계가 딱 맞으면 고를 수 있어요 (소수 오차)", () => {
    const c = pro("inv-exact");
    c.contract = null;
    c.paidSalary = 0;
    // 최저 비용 0.05억(500만) + 0.02억(200만). 용돈 0.06억 + 상금 0.01억은 부동소수로 0.07보다 조금 작지만 화면에는 700만이에요.
    c.earnings = 0.06 + 0.01;
    expect(c.earnings).toBeLessThan(0.07);
    expect(canAffordInvest(c, ["coach"], "diet")).toBe(true);
    c.earnings = 0.06;
    expect(canAffordInvest(c, ["coach"], "diet")).toBe(false);
  });

  it("시즌을 시작할 때 연봉 비례 비용을 내고, 두 가지까지만, 가진 돈 안에서만 해요", () => {
    setRandom(seeded(31));
    const c = pro("inv1");
    expect(investCost(c, "coach")).toBe(0.6);
    expect(investCost(c, "video")).toBe(0.3);
    offering(c, ["coach", "rehab"]);
    c.earnings = 1;
    c.invest = ["coach", "rehab", "video"];
    simulateSeason(c);
    // 스킬 코치 0.6억을 내고 나면 회복 관리팀(0.4억)까지 낼 수 있어요. 세 번째는 고를 수 없어요.
    expect(c.last!.invest).toEqual(["coach", "rehab"]);
    expect(c.spent).toBe(1);
    expect(c.earnings).toBeCloseTo(0 + 2, 5);
    expect(c.invest).toEqual(["coach", "rehab", "video"]);
    expect(careerSummary(c).earn).toBe(Math.round(c.earnings + 1));

    const poor = pro("inv2");
    offering(poor, ["coach", "diet"]);
    poor.earnings = 0.5;
    poor.invest = ["coach", "diet"];
    simulateSeason(poor);
    expect(poor.last!.invest).toEqual(["diet"]);
    expect(poor.news.some((n) => n.m.includes("자금이 모자라"))).toBe(true);
  });

  it("투자한 시즌은 같은 운이라도 더 크고 더 건강해요", () => {
    const run = (invest: Career["invest"], year: number) => {
      setRandom(seeded(77));
      const c = pro("inv3");
      c.year = year;
      c.earnings = 10;
      c.health = 60;
      c.invest = invest;
      const before = { ...c.p.attrs };
      simulateSeason(c);
      return { gain: ATTR_KEYS.reduce((t, k) => t + c.p.attrs[k] - before[k], 0), ath: c.p.attrs.ath - before.ath, health: c.health };
    };
    // 투자한 시즌과 같은 시즌을 투자 없이 보낸 것과 비교해요.
    const vs = (invest: Career["invest"]) => {
      const year = offering(pro("inv3"), invest);
      return [run(invest, year), run([], year)] as const;
    };
    const [coach, none1] = vs(["coach"]);
    expect(coach.gain).toBeGreaterThan(none1.gain);
    const [gym, none2] = vs(["gym"]);
    expect(gym.ath).toBeGreaterThan(none2.ath);
    const [care, none3] = vs(["rehab", "diet"]);
    expect(care.health).toBeGreaterThan(none3.health);
    const [shoot, none4] = vs(["shootcamp"]);
    expect(shoot.gain).toBeGreaterThan(none4.gain);
  });

  it("학생 선수는 시즌마다 용돈·후원금을 받고, 복무 중에는 투자하지 않아요", () => {
    setRandom(seeded(32));
    const c = createCareer({ name: "학생", num: 1, nat: "대한민국", pos: "PG", path: "domestic" }, generateCandidates("PG")[0], "inv4");
    simulateSeason(c);
    expect(c.earnings).toBeCloseTo(STUDENT_ALLOWANCE, 5);
    const m = pro("inv5");
    m.stage = "military";
    m.mil = { s: "serving", kind: "army", prev: { stage: "pro", team: m.team, contract: m.contract } };
    m.team = null;
    m.earnings = 5;
    m.invest = ["coach"];
    simulateSeason(m);
    expect(m.spent).toBe(0);
  });

  it("시즌마다 전체 투자 중 몇 가지가 무작위로 나오고, 같은 시즌이면 같은 목록이에요", () => {
    const c = pro("inv6");
    const lineupOf = (year: number) => {
      c.year = year;
      const keys = investLineup(c).map((i) => i.key);
      expect(keys).toHaveLength(INVEST_OFFER);
      expect(investLineup(c).map((i) => i.key)).toEqual(keys);
      return keys.join(",");
    };
    const years = Array.from({ length: 8 }, (_, i) => lineupOf(2030 + i));
    expect(new Set(years).size).toBeGreaterThan(4);
    // 학생 전용(아카데미 특강)은 프로에게, 프로 전용(로드 매니지먼트)은 학생에게 나오지 않아요.
    const student = createCareer({ name: "학생", num: 1, nat: "대한민국", pos: "PG", path: "domestic" }, generateCandidates("PG")[0], "inv9");
    for (let y = 2030; y < 2080; y++) {
      c.year = y;
      student.year = y;
      expect(investLineup(c).some((i) => i.key === "academy")).toBe(false);
      expect(investLineup(student).some((i) => i.key === "loadmgmt")).toBe(false);
    }
  });

  it("이번 시즌에 없는 투자는 고른 채로 남아 있어도 내지 않아요", () => {
    setRandom(seeded(33));
    const c = pro("inv7");
    c.earnings = 10;
    const offered = investLineup(c)[0].key;
    const missing = INVESTMENTS.find((i) => !investLineup(c).some((x) => x.key === i.key))!.key;
    c.invest = [missing, offered];
    expect(chosenInvest(c)).toEqual([offered]);
    simulateSeason(c);
    expect(c.last!.invest).toEqual([offered]);
  });

  it("투자 효과는 그 시즌에만 나고, 예전부터 있던 투자의 수치는 그대로예요", () => {
    const p = investPerks(["coach", "gym"]);
    expect(p.growth.ath).toBeCloseTo(1.05 * 1.2, 5);
    expect(p.decline.ath).toBeCloseTo(0.75, 5);
    expect(investPerks(["rehab", "diet"]).heal).toBe(14);
    expect(investPerks(["video"]).trust).toBe(0.5);
    expect(investPerks([]).growth.sht).toBe(1);
  });
});

describe("드래프트 진행", () => {
  const prospect = (attr: number) => {
    const c = createCareer({ name: "드래프티", num: 1, nat: "대한민국", pos: "SG", path: "abroad" }, generateCandidates("SG")[0], "dr");
    for (const k of ATTR_KEYS) c.p.attrs[k] = attr;
    // 잠재력이 지금보다 낮으면 스카우트 평가가 깎이니, 아직 클 여지가 있는 유망주로 맞춰요.
    c.p.pot = Math.min(99, attr + 6);
    c.age = 21;
    c.year = 2032;
    c.stage = "college";
    return c;
  };

  it("지명되면 그 순위에 지명한 팀과 내 이름이 있고, 라운드마다 모든 팀이 한 번씩 뽑아요", () => {
    setRandom(seeded(11));
    for (const [d, size, teams] of [["nba", 60, 30], ["kbl", 20, 10]] as const) {
      // 지명될 만한 유망주: NBA 평균 바로 아래, KBL은 평균보다 조금 아래
      const c = prospect(d === "nba" ? LEAGUES.nba.avg - 1 : LEAGUES.kbl.avg - 3);
      applyAction(c, { k: "draft", d });
      const show = c.draftShow!;
      expect(show.name).toBe(`2031 ${d === "nba" ? "NBA 드래프트" : "KBL 신인드래프트"}`);
      expect(show.picks).toHaveLength(size);
      expect(show.mine).toBe(c.draft!.pick);
      const mine = show.picks[show.mine! - 1];
      expect(mine).toMatchObject({ no: c.draft!.pick, team: c.team!.name, who: "드래프티", mine: true });
      expect(show.picks.filter((p) => p.mine)).toHaveLength(1);
      for (const r of [show.picks.slice(0, teams), show.picks.slice(teams)]) expect(new Set(r.map((p) => p.team)).size).toBe(teams);
      expect(show.range[0]).toBeLessThanOrEqual(show.range[1]);
    }
  });

  it("미지명이면 끝까지 다른 선수만 불리고, 미지명 결정이 기다려요", () => {
    setRandom(seeded(12));
    const c = prospect(40);
    applyAction(c, { k: "draft", d: "nba" });
    expect(c.draftShow).toMatchObject({ mine: null });
    expect(c.draftShow!.picks.some((p) => p.mine)).toBe(false);
    expect(c.draftShow!.picks.every((p) => /^(PG|SG|SF|PF|C) · /.test(p.who))).toBe(true);
    expect(c.queue[0]).toMatchObject({ title: "지명받지 못했어요" });
  });
});

describe("기록 리더보드", () => {
  const board = RECORD_BOARDS.find((b) => b.group === "kbl" && b.stat === "pts")!;

  it("실제 순위표는 기록이 많은 순서이고, 리그마다 득점 순위표가 있어요", () => {
    for (const b of RECORD_BOARDS) {
      expect(b.entries.length).toBeGreaterThan(0);
      for (let i = 1; i < b.entries.length; i++) expect(b.entries[i - 1].v).toBeGreaterThanOrEqual(b.entries[i].v);
    }
    for (const g of ["nba", "kbl", "olympics"] as const) expect(RECORD_BOARDS.some((b) => b.group === g && b.stat === "pts")).toBe(true);
  });

  it("내 기록을 끼워 넣으면 아래 선수 순위가 밀리고, 바로 위 선수와의 차이를 알려줘요", () => {
    const p = placeOnBoard(board, { name: "나", v: 11000 });
    expect(p.rank).toBe(3);
    expect(p.rows.map((r) => [r.name, r.rank])).toEqual([
      ["서장훈", 1],
      ["라건아", 2],
      ["나", 3],
      ["애런 헤인즈", 4],
      ["김주성", 5],
      ["추승균", 6],
    ]);
    expect(p.next).toEqual({ name: "라건아", gap: 12163 - 11000 });
    expect(placeOnBoard(board, { name: "나", v: 20000 })).toMatchObject({ rank: 1, next: null });
  });

  it("같은 기록이면 공동 순위, 순위표보다 낮으면 순위 밖, 기록이 없으면 끼워 넣지 않아요", () => {
    const tie = placeOnBoard(board, { name: "나", v: 10878 });
    expect(tie.rank).toBe(3);
    expect(tie.rows.slice(2, 5).map((r) => [r.name, r.rank])).toEqual([
      ["애런 헤인즈", 3],
      ["나", 3],
      ["김주성", 5],
    ]);
    const low = placeOnBoard(board, { name: "나", v: 5000 });
    expect(low.rank).toBeNull();
    expect(low.rows.at(-1)).toMatchObject({ name: "나", rank: null, mine: true });
    expect(low.next).toEqual({ name: "추승균", gap: 10019 - 5000 });
    expect(placeOnBoard(board, { name: "나", v: 0 })).toEqual({ rows: board.entries.map((e, i) => ({ ...e, rank: i + 1 })), rank: null, next: null });
  });

  it("리그별 통산은 그 리그 시즌만, 올림픽은 합류한 본선 경기 득점만 더해요", () => {
    const c = createCareer({ name: "기록", num: 7, nat: "대한민국", pos: "SF", path: "domestic" }, generateCandidates("SF")[0], "rec");
    const rec = (lg: "kbl" | "nba" | "ncaa" | null, gp: number, pts: number, reb: number, ast: number) =>
      ({ lg, gp, pts, reb, ast }) as unknown as Career["hist"][number];
    c.hist.push(rec("ncaa", 30, 20, 5, 3), rec("kbl", 54, 18.5, 6.2, 3.1), rec("kbl", 50, 20, 7, 4), rec(null, 0, 0, 0, 0), rec("nba", 82, 10, 3, 1));
    const game = (pts?: number, stage = "조별리그 1차전") => ({ stage, opp: "미국", us: 80, them: 90, win: false, pts });
    const tour = (ev: "olympics" | "asiangames", joined: boolean, games: ReturnType<typeof game>[]) =>
      ({ year: 2032, ev, name: "대회", joined, label: "", medal: null, story: "", games }) as Career["natLog"][number];
    c.natLog.push(
      tour("olympics", true, [game(15, "최종예선 결승"), game(12), game(20), game(8)]),
      tour("olympics", false, [game(), game()]),
      tour("asiangames", true, [game(30)]),
    );
    expect(careerTotals(c)).toEqual({
      kbl: { gp: 104, pts: 999 + 1000, reb: Math.round(54 * 6.2 + 350), ast: Math.round(54 * 3.1 + 200), stl: 0, blk: 0 },
      nba: { gp: 82, pts: 820, reb: 246, ast: 82, stl: 0, blk: 0 },
      olympics: { gp: 3, pts: 40, reb: 0, ast: 0, stl: 0, blk: 0 },
    });
    // 스틸·블록이 남은 시즌은 경기 수를 곱해 더해요.
    c.hist.push({ ...rec("nba", 50, 10, 3, 1), stl: 1.5, blk: 0.8 } as Career["hist"][number]);
    expect(careerTotals(c).nba).toMatchObject({ stl: 75, blk: 40 });
  });

  it("가드는 통산 스틸, 포워드·센터는 통산 블록 순위표를 더 봐요", () => {
    for (const g of ["nba", "kbl"] as const) {
      const stats = (pos: "PG" | "SG" | "SF" | "PF" | "C") => recordBoardsFor(g, pos).map((b) => b.stat);
      for (const pos of ["PG", "SG"] as const) expect(stats(pos)).toEqual(["pts", "reb", "ast", "stl"]);
      for (const pos of ["SF", "PF", "C"] as const) expect(stats(pos)).toEqual(["pts", "reb", "ast", "blk"]);
    }
    expect(recordBoardsFor("olympics", "C").map((b) => b.stat)).toEqual(["pts"]);
  });

  it("리그 통산이 실제 역대 순위표에 처음 든 시즌에만 진입으로 쳐요", () => {
    const c = createCareer({ name: "기록", num: 7, nat: "대한민국", pos: "SG", path: "domestic" }, generateCandidates("SG")[0], "rec2");
    const rec = (lg: "kbl" | "nba", pts: number) => ({ lg, gp: 82, pts, reb: 0, ast: 0, stl: 0, blk: 0 }) as unknown as Career["hist"][number];
    // NBA 통산 득점 20위는 26,496점이에요. 30점씩 82경기면 10시즌 24,600점, 11시즌 27,060점(15위)이에요.
    for (let i = 0; i < 10; i++) c.hist.push(rec("nba", 30));
    let before = careerTotals(c);
    c.hist.push(rec("nba", 30));
    expect(newlyRanked(c, before).map(({ board, rank, v }) => [board.group, board.stat, rank, v])).toEqual([["nba", "pts", 15, 27060]]);
    // 이미 순위표에 든 기록은 더 올라가도 다시 알리지 않아요. KBL은 따로 세요.
    before = careerTotals(c);
    c.hist.push(rec("nba", 30), rec("kbl", 0));
    expect(newlyRanked(c, before)).toEqual([]);
    before = careerTotals(c);
    for (let i = 0; i < 2; i++) c.hist.push(rec("kbl", 70));
    expect(newlyRanked(c, before).map(({ board }) => `${board.group}-${board.stat}`)).toEqual(["kbl-pts"]);
  });
});

describe("병역", () => {
  /** 23세 KBL 선수. 계약 3년이 남아 있어요. */
  function soldier(nat = "대한민국") {
    const c = createCareer({ name: "병장", num: 3, nat, pos: "SG", path: "domestic" }, generateCandidates("SG")[0], "mil");
    c.stage = "pro";
    c.age = 23;
    c.team = { name: "서울 SK 나이츠", color: "#E11B22", q: 0.5, lg: "kbl" };
    c.contract = { years: 3, salary: 2 };
    c.queue = [];
    return c;
  }
  const choiceOf = (c: Career, k: string) => militaryDecision(c)!.opts.findIndex((o) => o.act.k === "military" && o.act.choice === k);

  it("대한민국 선수만 23세부터 입대 시기를 묻고, 28세가 되면 연기할 수 없어요", () => {
    expect(militaryDecision(soldier("일본"))).toBeNull();
    const young = soldier();
    young.age = 22;
    expect(militaryDecision(young)).toBeNull();
    const c = soldier();
    expect(militaryDecision(c)!.opts.map((o) => o.label)).toEqual(["상무 지원", "현역 입대", "입대 연기"]);
    applyAction(c, { k: "military", choice: "defer" });
    expect(c.mil.ask).toBe(25);
    c.age = 24;
    expect(militaryDecision(c)).toBeNull();
    c.age = 28;
    expect(militaryDecision(c)!.opts.map((o) => o.label)).toEqual(["상무 지원", "현역 입대"]);
    expect(choiceOf(c, "defer")).toBe(-1);
  });

  it("상무에 가면 D리그를 뛰고, 전역하면 원래 팀과 계약 그대로 돌아와 시즌 중반에 합류해요", () => {
    setRandom(seeded(41));
    const c = soldier();
    for (const k of ATTR_KEYS) c.p.attrs[k] = 80;
    c.hist.push({ gp: 50 } as Career["hist"][number]);
    c.queue = [militaryDecision(c)!, { lazy: "fa" }];
    chooseOption(c, 0);
    expect(c.stage).toBe("military");
    expect(c.mil.kind).toBe("sangmu");
    expect(c.team).toBeNull();
    expect(c.queue).toEqual([]);
    const rec = simulateSeason(c);
    expect(rec.mil).toBe("sangmu");
    expect(rec.team).toContain("상무");
    expect(rec.gp).toBeGreaterThan(0);
    expect(c.stage).toBe("pro");
    expect(c.team?.name).toBe("서울 SK 나이츠");
    expect(c.contract).toEqual({ years: 3, salary: 2 });
    expect(c.mil.s).toBe("served");
    while (c.queue.length) chooseOption(c, 0);
    const back = simulateSeason(c);
    expect(back.gp).toBeLessThanOrEqual(Math.round(54 * 0.6));
    expect(militaryDecision(c)).toBeNull();
  });

  it("현역은 한 시즌 경기를 못 뛰고 운동능력과 슛 감각이 떨어져요", () => {
    setRandom(seeded(42));
    const c = soldier();
    const before = { ...c.p.attrs };
    applyAction(c, { k: "military", choice: "army" });
    const rec = simulateSeason(c);
    expect(rec.gp).toBe(0);
    expect(c.p.attrs.ath).toBeLessThan(before.ath);
    expect(c.p.attrs.sht).toBeLessThan(before.sht);
    expect(c.mil).toMatchObject({ s: "served", kind: "army" });
  });

  it("아시안게임 금메달을 따면 병역 특례를 받고, 남은 입대 결정이 사라져요", () => {
    setRandom(seeded(43));
    let exempt = 0;
    for (let i = 0; i < 60 && !exempt; i++) {
      const c = soldier();
      for (const k of ATTR_KEYS) c.p.attrs[k] = 90;
      c.queue = [militaryDecision(c)!];
      const t = runNationalTeam(c, "asiangames", 2030, true);
      if (t.medal === "금") {
        expect(c.mil.s).toBe("exempt");
        expect(c.queue).toEqual([]);
        expect(c.news.some((n) => n.m.includes("병역 특례"))).toBe(true);
        exempt++;
      } else expect(c.mil.s).toBe("none");
    }
    expect(exempt).toBe(1);
  });
});

describe("대회 진행과 결승 중계", () => {
  it("대회 기록에 경기마다 단계·상대·점수가 남고, 합류하면 내 득점도 남아요", () => {
    setRandom(seeded(44));
    const c = createCareer({ name: "기록", num: 4, nat: "호주", pos: "C", path: "abroad" }, generateCandidates("C")[0], "log");
    c.age = 25;
    const t = runNationalTeam(c, "asiacup", 2029, true);
    expect(c.natLog.at(-1)).toBe(t);
    expect(t.games.length).toBeGreaterThanOrEqual(3);
    expect(t.games[0].stage).toBe("조별리그 1차전");
    for (const g of t.games) {
      expect(g.win).toBe(g.us > g.them);
      expect(g.pts).toBeGreaterThanOrEqual(0);
    }
    if (t.games.at(-1)!.stage === "결승") expect(c.live?.key).toBe("nat-2029");
  });

  it("중계는 결과와 같은 점수로 끝나고, 쿼터가 넷이에요", () => {
    setRandom(seeded(45));
    const g = makeLiveGame({
      title: "2034 NBA 파이널 6차전", key: "league-2034", us: "보스턴", them: "덴버", usColor: "#000", themColor: "#111",
      usScore: 104, themScore: 99, periodMin: 12, player: "김선수", mine: { pts: 27, reb: 6, ast: 5 },
    });
    const last = g.plays.at(-1)!;
    expect([last.us, last.them]).toEqual([104, 99]);
    expect(last.text).toBe("경기 종료");
    expect(g.plays.filter((p) => p.mark).length).toBe(4);
    expect(g.win).toBe(true);
    const mine = g.plays.filter((p) => p.mine).length;
    expect(mine).toBeGreaterThan(0);
    expect(g.mine.pts).toBeLessThanOrEqual(27);
    for (let i = 1; i < g.plays.length; i++) {
      expect(g.plays[i].us).toBeGreaterThanOrEqual(g.plays[i - 1].us);
      expect(g.plays[i].q).toBeGreaterThanOrEqual(g.plays[i - 1].q);
    }
  });

  it("리그 결승에 오르면 시즌 기록에 결승 결과가, 커리어에 그 경기 중계가 남아요", () => {
    setRandom(seeded(46));
    let found = false;
    for (let i = 0; i < 400 && !found; i++) {
      const c = createCareer({ name: "결승", num: 8, nat: "미국", pos: "PF", path: "abroad" }, generateCandidates("PF")[0], "fin");
      c.stage = "pro";
      c.team = { name: "보스턴 셀틱스", color: "#007A33", q: 0.8, lg: "nba" };
      c.contract = { years: 3, salary: 30 };
      const rec = simulateSeason(c);
      if (!rec.final) continue;
      found = true;
      expect(rec.final.series).toMatch(/^[0-4]-[0-4]$/);
      expect(c.live?.key).toBe(`league-${rec.year}`);
      const last = c.live!.plays.at(-1)!;
      expect([last.us, last.them]).toEqual([rec.final.us, rec.final.them]);
      expect(rec.final.win).toBe(rec.result === "리그 우승");
    }
    expect(found).toBe(true);
  });
});

describe("시즌 진행", () => {
  /** NBA 강팀 주전으로 시즌을 하나 준비해요. */
  function proCareer(id: string): Career {
    const c = createCareer({ name: "시즌", num: 30, nat: "미국", pos: "SG", path: "abroad" }, generateCandidates("SG")[0], id);
    c.stage = "pro";
    c.team = { name: "보스턴 셀틱스", color: "#007A33", q: 0.8, lg: "nba" };
    c.contract = { years: 3, salary: 30 };
    return c;
  }

  /** 결정은 첫 선택지로 고르며 시즌 끝까지 한 칸씩 진행하고, 칸마다 결과를 모아요. */
  function stepThrough(c: Career): SeasonStep[] {
    const steps: SeasonStep[] = [];
    if (!c.run) startSeason(c);
    while (c.run) {
      if (c.queue.length) {
        expect(stepSeason(c), "결정이 남았으면 진행하지 않아요").toBeNull();
        chooseOption(c, 0);
        continue;
      }
      const g = c.run.g;
      const phase = c.run.phase;
      steps.push(stepSeason(c)!);
      if (phase === "reg" && c.run?.games) expect(c.run.g).toBe(g + 1);
    }
    return steps;
  }

  it("정규시즌은 한 경기씩, 플레이오프는 한 라운드씩 진행하고 결산하면 시즌 기록이 하나 남아요", () => {
    setRandom(seeded(61));
    for (let i = 0; i < 30; i++) {
      const c = proCareer(`run${i}`);
      const year = c.year;
      startSeason(c);
      expect(c.run?.phase).toBe("pre");
      expect(canRetire({ ...c, age: 33 })).toBe(false);
      const games = c.run!.games;
      const steps = stepThrough(c);
      const rec = c.last!;
      expect(c.run).toBeNull();
      expect(c.year).toBe(year + 1);
      expect(rec.year).toBe(year);
      expect(rec.w + rec.l).toBe(games);
      expect(rec.gp).toBeLessThanOrEqual(games);
      expect(steps.at(-1)).toBe("done");
      expect(steps.filter((s) => s === "done").length).toBe(1);
      // 프리시즌 + 경기 수 + 플레이오프 라운드(NBA 0~4) + 결산, 결승 직전 출전 결정을 물으면 한 칸 더
      expect(steps.length).toBeGreaterThanOrEqual(games + 2);
      expect(steps.length).toBeLessThanOrEqual(games + 7);
      if (c.live?.key === `league-${year}`) expect(steps).toContain("final");
    }
  });

  it("NBA 플레이오프는 1라운드 → 컨퍼런스 세미파이널 → 컨퍼런스 파이널 → 파이널 순서예요", () => {
    setRandom(seeded(63));
    const order = ["플레이오프 1라운드", "컨퍼런스 세미파이널", "컨퍼런스 파이널", "NBA 파이널"];
    const exits = new Set<string>();
    let champs = 0;
    for (let i = 0; i < 80; i++) {
      const c = proCareer(`po${i}`);
      startSeason(c);
      while (c.run && c.run.phase !== "post" && c.run.phase !== "end") {
        if (c.queue.length) chooseOption(c, 0);
        else stepSeason(c);
      }
      if (!c.run || c.run.phase !== "post") continue;
      const names = c.run.post.map((r) => r.name);
      expect(names).toEqual(order.slice(0, names.length));
      if (c.run.champ) {
        champs++;
        expect(names).toEqual(order);
      } else exits.add(c.run.result);
    }
    expect(champs).toBeGreaterThan(0);
    expect([...exits].every((r) => ["플레이오프 1라운드", "컨퍼런스 세미파이널", "컨퍼런스 파이널", "파이널 준우승"].includes(r))).toBe(true);
    expect(exits.size).toBeGreaterThanOrEqual(3);
  });

  it("KBL은 6강 → 4강 → 챔피언결정전이고, 정규리그 1·2위 승률이면 4강으로 직행해요", () => {
    setRandom(seeded(64));
    const order = ["6강 플레이오프", "4강 플레이오프", "KBL 챔피언결정전"];
    let byes = 0;
    let six = 0;
    for (let i = 0; i < 120; i++) {
      const c = proCareer(`kpo${i}`);
      c.team = { name: "서울 SK 나이츠", color: "#E4002B", q: 0.5 + (i % 4) * 0.1, lg: "kbl" };
      startSeason(c);
      while (c.run && c.run.phase !== "post" && c.run.phase !== "end") {
        if (c.queue.length) chooseOption(c, 0);
        else stepSeason(c);
      }
      if (!c.run || c.run.phase !== "post") continue;
      const run = c.run;
      const names = run.post.map((r) => r.name);
      const wp = run.w / run.games;
      if (names[0] === "4강 플레이오프") {
        byes++;
        expect(wp).toBeGreaterThanOrEqual(0.59);
        expect(names).toEqual(order.slice(1, 1 + names.length));
      } else {
        six++;
        if (wp >= 0.65) throw new Error(`승률 ${wp}인데 6강부터 치렀어요`);
        expect(names).toEqual(order.slice(0, names.length));
      }
      if (run.champ) expect(names.at(-1)).toBe("KBL 챔피언결정전");
    }
    expect(byes).toBeGreaterThan(0);
    expect(six).toBeGreaterThan(0);
  });

  it("미리 정한 승수를 경기마다 나눠 주어 정규시즌 승수가 정확히 맞아요", () => {
    setRandom(seeded(62));
    const c = proCareer("wins");
    startSeason(c);
    const wins = c.run!.wins;
    while (c.run && c.run.phase !== "post" && c.run.phase !== "end") {
      if (c.queue.length) chooseOption(c, 0);
      else stepSeason(c);
    }
    expect(c.run!.w).toBe(wins);
  });

  it("결승에 오르면 결승 라운드에서 중계를 만들고, 시즌 기록에 같은 결과가 남아요", () => {
    setRandom(seeded(63));
    let found = false;
    for (let i = 0; i < 200 && !found; i++) {
      const c = proCareer(`fin${i}`);
      const steps = stepThrough(c);
      if (!steps.includes("final")) continue;
      found = true;
      const rec = c.last!;
      expect(rec.final).toBeDefined();
      expect(c.live?.key).toBe(`league-${rec.year}`);
      const last = c.live!.plays.at(-1)!;
      expect([last.us, last.them]).toEqual([rec.final!.us, rec.final!.them]);
    }
    expect(found).toBe(true);
  });

  it("시즌 도중에 저장해도 그대로 불러와 이어서 진행해요", () => {
    setRandom(seeded(64));
    const c = proCareer("mid");
    startSeason(c);
    for (let i = 0; i < 20; i++) {
      if (c.queue.length) chooseOption(c, 0);
      stepSeason(c);
    }
    const loaded = parseCareer(JSON.stringify(c))!;
    expect(loaded).toEqual(c);
    expect(loaded.run?.g).toBeGreaterThan(0);
    simulateSeason(loaded);
    expect(loaded.run).toBeNull();
    expect(loaded.hist.length).toBe(1);
  });

  it("오래 쉬어야 하는 부상은 복귀 시점을 묻고, 서둘러 돌아오면 결장 경기가 줄어요", () => {
    setRandom(seeded(65));
    const c = proCareer("inj");
    startSeason(c);
    c.run!.out = 20;
    c.run!.outWhy = "부상";
    const d = injuryDecision(20);
    applyAction(c, d.opts[0].act);
    expect(c.run!.out).toBe(12);
    expect(c.run!.form).toBeLessThan(0);
    // 쉬는 이벤트는 결장을 늘려요.
    applyAction(c, { k: "boost", sit: 2 });
    expect(c.run!.out).toBe(14);
  });

  it("팀이 없는 시즌은 정해진 일정을 한 칸씩 지나 결산해요", () => {
    setRandom(seeded(66));
    const c = proCareer("solo");
    c.stage = "free";
    c.team = null;
    c.contract = null;
    const steps = stepThrough(c);
    expect(steps.length).toBe(7);
    expect(c.last?.result).toBe("개인 훈련");
  });
});

describe("기자회견", () => {
  /** 팀 성적 기자회견(열애설·불화설 기자회견 말고)이 나올 때까지 시즌 중 이벤트를 뽑아요. */
  function press(w: number, l: number): Decision {
    const c = createCareer({ name: "회견", num: 3, nat: "미국", pos: "SG", path: "abroad" }, generateCandidates("SG")[0], `press${w}-${l}`);
    c.stage = "pro";
    c.team = { name: "보스턴 셀틱스", color: "#007A33", q: 0.8, lg: "nba" };
    c.contract = { years: 3, salary: 30 };
    startSeason(c);
    Object.assign(c.run!, { w, l });
    for (let i = 0; i < 500; i++) {
      c.events = {};
      const d = seasonEvent(c);
      if (d && /^기자회견: (우승 후보\?|부진의 이유|짓궂은 질문)$/.test(d.title)) return d;
    }
    throw new Error("기자회견이 나오지 않았어요");
  }

  it("프로 시즌 중에 무작위로 열리고, 팀 성적에 따라 질문이 달라져요", () => {
    setRandom(seeded(29));
    expect(press(20, 5).title).toBe("기자회견: 우승 후보?");
    expect(press(4, 18).title).toBe("기자회견: 부진의 이유");
    expect(press(8, 7).title).toBe("기자회견: 짓궂은 질문");
    for (const d of [press(20, 5), press(4, 18), press(8, 7)]) {
      expect(d.opts.length).toBe(2);
      for (const o of d.opts) expect(o.sub).toBeTruthy();
    }
  });

  it("고교 시즌에는 열리지 않아요", () => {
    setRandom(seeded(30));
    const c = createCareer({ name: "고교", num: 3, pos: "SG", path: "domestic" }, generateCandidates("SG")[0], "press-hs");
    startSeason(c);
    for (let i = 0; i < 300; i++) {
      c.events = {};
      expect(seasonEvent(c)?.title ?? "").not.toMatch(/^기자회견/);
    }
  });
});

describe("체력과 빅매치", () => {
  function nba(id: string, ovrBoost: number): Career {
    const c = createCareer({ name: "체력", num: 1, nat: "미국", pos: "SF", path: "abroad" }, generateCandidates("SF")[0], id);
    for (const k of ATTR_KEYS) c.p.attrs[k] += ovrBoost;
    c.stage = "pro";
    c.team = { name: "보스턴 셀틱스", color: "#007A33", q: 0.5, lg: "nba" };
    c.contract = { years: 3, salary: 30 };
    c.p.trait = "강철몸";
    return c;
  }

  /** 정규시즌 절반을 치른 뒤의 건강 (결정은 첫 선택지) */
  function healthAtHalf(c: Career): number {
    startSeason(c);
    while (c.run!.phase === "pre" || c.run!.g < c.run!.games / 2) {
      if (c.queue.length) chooseOption(c, 1);
      else stepSeason(c);
    }
    return c.health;
  }

  it("오래 뛸수록 경기마다 건강이 많이 닳아요", () => {
    setRandom(seeded(81));
    // 후보는 오버롤 45로 시작하니, NBA 평균보다 10 높은 주전과 거의 못 뛰는 벤치 선수를 비교해요.
    const star = healthAtHalf(nba("star", LEAGUES.nba.avg + 10 - 45));
    setRandom(seeded(81));
    const bench = healthAtHalf(nba("bench", 0));
    expect(star).toBeLessThan(bench - 8);
  });

  it("빅매치에서 강행해 성공하면 경기력이 오르고, 실패하면 다쳐서 다음 경기에 못 나가요", () => {
    setRandom(seeded(82));
    const c = nba("big", 20);
    startSeason(c);
    stepSeason(c);
    const d = bigGameDecision(c, "라이벌전", false);
    expect(d.opts[0].act.k).toBe("gamble");
    setRandom(() => 0);
    applyAction(c, d.opts[0].act);
    expect(c.run!.form).toBeGreaterThan(1);
    expect(c.run!.out).toBe(0);
    setRandom(() => 0.999);
    applyAction(c, d.opts[0].act);
    expect(c.run!.out).toBeGreaterThanOrEqual(1);
    expect(c.run!.outWhy).toBe("부상");
    // 쉬는 쪽을 고르면 한 경기 쉬어요.
    const rest = nba("rest", 20);
    startSeason(rest);
    applyAction(rest, bigGameDecision(rest, "라이벌전", false).opts[1].act);
    expect(rest.run!.out).toBe(1);
  });
});

describe("연봉 협상과 이적 요청", () => {
  function kbl(id: string): Career {
    const c = createCareer({ name: "협상", num: 2, nat: "대한민국", pos: "PG", path: "domestic" }, generateCandidates("PG")[0], id);
    // 후보는 오버롤 45로 시작하니, KBL 평균보다 조금 높은 주전으로 만들어요.
    for (const k of ATTR_KEYS) c.p.attrs[k] += LEAGUES.kbl.avg + 2 - 45;
    c.age = 26;
    c.mil = { s: "exempt" };
    c.stage = "pro";
    c.team = { name: "서울 SK 나이츠", color: "#D7141A", q: 0.5, lg: "kbl" };
    c.contract = { years: 2, salary: 3 };
    return c;
  }
  const offer = () => ({
    title: "FA",
    body: "",
    opts: [
      { label: "부산 KCC 이지스", act: { k: "sign" as const, lg: "kbl" as const, team: { name: "부산 KCC 이지스", color: "#003A70", q: 0.5 }, years: 3, salary: 4 } },
      { label: "무소속", act: { k: "skip" as const } },
    ],
  });

  it("제안을 고르면 바로 서명하지 않고 협상하고, 인상에 성공하면 오른 연봉에 서명해요", () => {
    setRandom(seeded(91));
    const c = kbl("nego");
    c.queue = [offer()];
    chooseOption(c, 0);
    const d = currentDecision(c)!;
    expect(d.title).toContain("연봉 협상");
    expect(d.opts.map((o) => o.act.k)).toEqual(["sign", "nego", "nego", "nego"]);
    setRandom(() => 0);
    chooseOption(c, 1);
    expect(c.contract).toEqual({ years: 3, salary: 4.4 });
    expect(c.team?.name).toBe("부산 KCC 이지스");
  });

  it("작은 요구가 거절되면 원래 조건, 큰 요구가 거절되면 협상이 깨져 다른 선택지로 돌아가요", () => {
    setRandom(seeded(92));
    const c = kbl("walk");
    c.queue = [offer()];
    chooseOption(c, 0);
    setRandom(() => 0.999);
    chooseOption(c, 1);
    expect(c.contract).toEqual({ years: 3, salary: 4 });

    const w = kbl("walk2");
    w.queue = [offer()];
    chooseOption(w, 0);
    chooseOption(w, 2);
    const back = currentDecision(w)!;
    expect(back.title).toBe("협상 결렬");
    expect(back.opts.map((o) => o.label)).toEqual(["무소속"]);
    expect(w.team?.name).toBe("서울 SK 나이츠");
  });

  it("이적 요청은 오프시즌마다 한 번이고, 허락되면 다른 구단 제안이, 거절되면 위약금 해지 선택지가 와요", () => {
    setRandom(() => 0);
    const ok = kbl("move");
    expect(canRequestTransfer(ok)).toBe(true);
    expect(requestTransfer(ok)).toBe(true);
    expect(canRequestTransfer(ok)).toBe(false);
    const d = currentDecision(ok)!;
    expect(d.title).toBe("이적 시장");
    for (const o of d.opts.slice(0, -1)) {
      expect(o.act.k).toBe("sign");
      if (o.act.k === "sign") expect(o.act.team.name).not.toBe("서울 SK 나이츠");
    }

    setRandom(() => 0.999);
    const no = kbl("stay");
    no.earnings = 10;
    requestTransfer(no);
    const r = currentDecision(no)!;
    expect(r.title).toBe("이적 요청 거절");
    const i = r.opts.findIndex((o) => o.act.k === "buyout");
    expect(i).toBeGreaterThan(0);
    setRandom(seeded(93));
    chooseOption(no, i);
    expect(no.earnings).toBe(7);
    expect(no.team).toBeNull();
    expect(no.stage).toBe("free");
    expect(currentDecision(no)?.title).toBe("다시 시장에 나왔어요");
  });
});

describe("자금 쓰기", () => {
  const rich = (id: string) => {
    const c = createCareer({ name: "부자", num: 0, nat: "대한민국", pos: "C", path: "domestic" }, generateCandidates("C")[0], id);
    c.earnings = 400;
    return c;
  };
  /** 이번 시즌 진열을 정해 둬요. */
  const stock = (c: Career, keys: string[]) => (c.shop = { year: c.year, keys, bought: [] });

  it("시즌마다 싼 것·중간·비싼 것이 고루 섞인 여섯 개가 진열되고, 시즌이 바뀌면 진열도 바뀌어요", () => {
    const c = rich("lineup");
    const first = shopLineup(c);
    expect(first).toHaveLength(SHOP_SIZE);
    expect(first.filter((i) => i.price < 1).length).toBeGreaterThanOrEqual(2);
    expect(first.filter((i) => i.price > 20).length).toBeGreaterThanOrEqual(2);
    // 같은 커리어·같은 시즌이면 같은 진열이에요.
    const again: Career = { ...c, shop: null };
    refreshShop(again);
    expect(again.shop!.keys).toEqual(c.shop!.keys);
    const seen = new Set(c.shop!.keys);
    for (let y = 1; y <= 4; y++) {
      c.year++;
      refreshShop(c);
      c.shop!.keys.forEach((k) => seen.add(k));
    }
    expect(seen.size).toBeGreaterThan(SHOP_SIZE * 2);
  });

  it("진열된 것만 살 수 있고, 산 것은 보유 목록에 남아 다시 진열되지 않아요", () => {
    setRandom(seeded(95));
    const c = rich("own");
    c.health = 70;
    stock(c, ["parents", "shoes", "academy"]);
    expect(buy(c, "court")).toBe(false);
    expect(buy(c, "parents")).toBe(true);
    expect(c.health).toBe(80);
    expect(buy(c, "parents")).toBe(false);
    expect(buy(c, "academy")).toBe(true);
    expect(ownedItems(c).map((i) => i.key)).toEqual(["parents", "academy"]);
    expect(careerSummary(c).legacyItems).toEqual(["부모님께 집 선물", "유소년 농구 아카데미 설립"]);
    for (let y = 1; y <= 10; y++) {
      c.year++;
      refreshShop(c);
      expect(c.shop!.keys).not.toContain("parents");
      expect(c.shop!.keys).not.toContain("academy");
    }
  });

  it("일회성 상품은 시즌마다 한 번 살 수 있고 보유 목록에 남지 않아요", () => {
    setRandom(seeded(96));
    const c = rich("repeat");
    c.health = 50;
    stock(c, ["familytrip"]);
    expect(buy(c, "familytrip")).toBe(true);
    expect(c.health).toBe(58);
    expect(buy(c, "familytrip")).toBe(false);
    expect(c.owned).toEqual([]);
    c.year++;
    stock(c, ["familytrip"]);
    expect(buy(c, "familytrip")).toBe(true);
  });

  it("장비 효과는 성장과 부상에 반영되고, 기부는 누적되며, 시즌 중에는 살 수 없어요", () => {
    setRandom(seeded(97));
    const c = rich("perk");
    stock(c, ["shootingmachine", "recovery", "shoes"]);
    buy(c, "shootingmachine");
    buy(c, "recovery");
    const perks = shopPerks(c);
    expect(perks.growth.sht).toBeCloseTo(1.06, 5);
    expect(perks.growth.def).toBe(1);
    expect(perks.injury).toBeCloseTo(0.85, 5);
    expect(donate(c, 10)).toBe(true);
    expect(careerSummary(c).donated).toBe(10);
    startSeason(c);
    expect(buy(c, "shoes")).toBe(false);
  });

  it("기부는 금액마다 한 시즌에 한 번이고, 가끔 금액에 맞는 보답이 와요", () => {
    const c = rich("give");
    // 보답이 오지 않게(난수 0.99)
    setRandom(() => 0.99);
    const attrs = { ...c.p.attrs };
    expect(donate(c, 1)).toBe(true);
    expect(c.p.attrs).toEqual(attrs);
    expect(donatedThisSeason(c, 1)).toBe(true);
    expect(canDonate(c, 1)).toBe(false);
    expect(donate(c, 1)).toBe(false);
    // 다른 금액은 따로 셀 수 있어요.
    expect(canDonate(c, 0.1)).toBe(true);

    // 보답이 오면(난수 0) 1억은 무작위 능력치 하나 +1, 1000만은 건강과 시즌 시작 경기력
    setRandom(() => 0);
    const sum = (a: typeof c.p.attrs) => Object.values(a).reduce((t, x) => t + x, 0);
    const before = sum(c.p.attrs);
    expect(donate(c, 10)).toBe(true);
    expect(sum(c.p.attrs)).toBeCloseTo(before + 2, 5);
    c.health = 50;
    expect(donate(c, 0.1)).toBe(true);
    expect(c.health).toBe(55);
    expect(c.shop!.form).toBeCloseTo(0.3 + 0.5, 5);
    expect(c.news[0].m).toContain("힘이 났어요");

    // 다음 시즌 상점이 열리면 다시 기부할 수 있어요.
    c.year += 1;
    refreshShop(c);
    expect(canDonate(c, 1)).toBe(true);
  });
});

describe("랭킹 점수", () => {
  /** 리그 하나에서 MVP 한 번만 받은 프로 커리어 */
  const mvpIn = (lg: LeagueKey, caps = 0): CareerSummary => {
    const awards = { mvp: 1 };
    return {
      awards, pts: 0, reb: 0, ast: 0, peak: 60, teams: [], caps,
      leagues: { [lg]: { seasons: 1, gp: 0, pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, tpm: 0, awards } },
    } as unknown as CareerSummary;
  };

  it("같은 상이라도 리그 수준에 따라 다르게 치고, 국가대표 출전도 더해요", () => {
    expect(rankScore(mvpIn("euro"))).toBeGreaterThan(rankScore(mvpIn("kbl")));
    expect(rankScore(mvpIn("kbl"))).toBeGreaterThan(rankScore(mvpIn("ncaa")));
    expect(rankScore(mvpIn("ncaa"))).toBeGreaterThan(rankScore(mvpIn("hs")));
    expect(rankScore(mvpIn("kbl", 100))).toBeCloseTo(rankScore(mvpIn("kbl")) + 100 * SCORE_CAP, 1);
  });

  it("엔진이 만든 은퇴 기록에는 리그별 몫과 스틸·블록·3점슛 통산이 있고, 리그별 몫이 없는 예전 기록도 점수를 매겨요", () => {
    const rand = seeded(55);
    setRandom(rand);
    const c = createCareer({ name: "점수", num: 7, nat: "대한민국", pos: "SG", path: "domestic" }, generateCandidates("SG")[0], "rs1");
    playToRetirement(c, rand);
    const s = careerSummary(c);
    expect(s.leagues?.hs?.seasons).toBeGreaterThan(0);
    expect(s.stl).toBeGreaterThanOrEqual(0);
    expect(s.tpm).toBe(sumSeasons(c.hist.filter((h) => h.pro)).tpm);
    if (s.gp > 0) expect(c.hist.filter((h) => h.pro && h.gp > 0).every((h) => (h.tpm ?? -1) >= 0)).toBe(true);
    const old = { ...s, leagues: undefined };
    expect(rankScore(old)).toBeGreaterThan(0);
  });
});

describe("커리어 요약 수상", () => {
  it("리그·대회 이름별로 세어 팀·개인·국가대표로 나누고, 리그 수준 순·같은 리그에서는 MVP부터예요", () => {
    const c = createCareer({ name: "요약", num: 3, nat: "대한민국", pos: "SG", path: "domestic" }, generateCandidates("SG")[0], "aw1");
    // 수상의 리그는 그해 시즌 기록에서 찾아요.
    const season = (year: number, lg: LeagueKey) => c.hist.push({ year, lg } as SeasonRecord);
    season(2027, "hs");
    for (const y of [2030, 2031, 2032]) season(y, "kbl");
    season(2035, "nba");
    const log = (y: number, k: AwardKey, n: string) => c.awardLog.push({ y, k, n });
    log(2027, "title", "고교 전국대회 우승");
    log(2027, "scoring", "고교 득점왕");
    log(2030, "ring", "KBL 우승");
    log(2030, "fmvp", "KBL 챔피언결정전 MVP");
    log(2030, "mvp", "KBL 정규리그 MVP");
    log(2031, "ring", "KBL 우승");
    log(2031, "mvp", "KBL 정규리그 MVP");
    log(2031, "nat_gold", "2031 아시안게임 금메달");
    log(2032, "ring", "KBL 우승");
    log(2032, "fmvp", "KBL 챔피언결정전 MVP");
    log(2032, "mvp", "KBL 정규리그 MVP");
    log(2035, "ring", "NBA 우승");
    log(2035, "sixth", "NBA 식스맨상");
    const g = awardGroups(c);
    expect(g.team).toEqual([
      { name: "NBA 우승", count: 1 },
      { name: "KBL 우승", count: 3 },
      { name: "고교 전국대회 우승", count: 1 },
    ]);
    expect(g.personal).toEqual([
      { name: "NBA 식스맨상", count: 1 },
      { name: "KBL 정규리그 MVP", count: 3 },
      { name: "KBL 챔피언결정전 MVP", count: 2 },
      { name: "고교 득점왕", count: 1 },
    ]);
    expect(g.nat).toEqual([{ name: "아시안게임 금메달", count: 1 }]);
  });
});

describe("은퇴 회고", () => {
  it("입단에서 시작해 굵직한 순간이 있던 해마다 한 칸씩 지나 은퇴로 끝나고, 쌓인 기록은 줄지 않아요", () => {
    const rand = seeded(97);
    setRandom(rand);
    for (let i = 0; i < 20; i++) {
      const c = createCareer({ name: "회고", num: 9, nat: "대한민국", pos: "SF", path: i % 2 ? "abroad" : "domestic" }, generateCandidates("SF")[0], `fw${i}`);
      playToRetirement(c, rand);
      const steps = careerJourney(c);
      expect(steps[0].title).toBe("벤치에서 시작");
      expect(steps.at(-1)!.title).toBe("은퇴");
      expect(steps.at(-1)!.detail).toContain(`${c.hist.length}시즌`);
      // 한 해에 한 칸이고, 그해의 수상·메달은 모두 그 칸에 담겨요. 상도 드래프트도 없던 해는 칸이 없어요.
      expect(new Set(steps.map((s) => s.year)).size).toBe(steps.length);
      for (const a of c.awardLog) {
        const s = steps.find((x) => x.year === a.y)!;
        expect([s.title, ...s.awards]).toContain(stripYear(a.n));
      }
      // 칸 안의 순서: MVP → 우승 → 그 밖의 개인 수상 → 메달
      const rank = (k: string) => (["mvp_nba", "mvp", "fmvp", "cfmvp"].includes(k) ? 0 : ["ring", "title"].includes(k) ? 1 : k.startsWith("nat_") ? 3 : 2);
      for (const s of steps) {
        const ranks = [s.title, ...s.awards].flatMap((n) => c.awardLog.filter((a) => a.y === s.year && stripYear(a.n) === n).map((a) => rank(a.k)));
        expect(ranks).toEqual([...ranks].sort((x, y) => x - y));
      }
      for (const h of c.hist.slice(1, -1))
        if (!c.awardLog.some((a) => a.y === h.year) && c.draft?.year !== h.year) expect(steps.some((s) => s.year === h.year)).toBe(false);
      for (let k = 1; k < steps.length; k++) {
        expect(steps[k].year).toBeGreaterThanOrEqual(steps[k - 1].year);
        expect(steps[k].pts).toBeGreaterThanOrEqual(steps[k - 1].pts);
        expect(steps[k].trophies).toBeGreaterThanOrEqual(steps[k - 1].trophies);
      }
      expect(steps.at(-1)!.trophies).toBe(c.awardLog.length);
      if (c.awards.ring) expect(steps.some((s) => s.big && [s.title, ...s.awards].some((a) => a.endsWith("우승")))).toBe(true);
    }
  });
});

describe("닮은 꼴 선수", () => {
  it("나무위키 주소는 이름으로 만들고, 동명이인은 따로 적은 문서 제목으로 만들어요", () => {
    const url = (title: string) => `https://namu.wiki/w/${encodeURIComponent(title)}`;
    expect(namuWikiUrl("마이클 조던")).toBe(url("마이클 조던"));
    expect(namuWikiUrl("양동근")).toBe(url("양동근(농구)"));
    // 플레이 유형 예시의 '작은 이정현'은 닮은 꼴 선수의 이정현과 다른 사람이에요.
    expect(namuWikiUrl("(작)이정현")).toBe(url("이정현(1999)"));
    expect(namuWikiUrl("이정현")).toBe(url("이정현(1987)"));
    const names = [
      ...[...COMPS.nba, ...COMPS.kbl].map((x) => x.name),
      ...Object.values(ARCHETYPES).flatMap((list) => list.flatMap((a) => [...a.kbl, ...a.nba])),
    ];
    for (const n of names) expect(namuWikiUrl(n)).toMatch(/^https:\/\/namu\.wiki\/w\/[^\s/]+$/);
  });

  it("프로 기록이 있으면 KBL·NBA에서 닮은 순서로 세 명을 고르고, 없으면 비워 둬요", () => {
    const rand = seeded(98);
    setRandom(rand);
    let found = 0;
    for (let i = 0; i < 40; i++) {
      const c = createCareer({ name: "닮은꼴", num: 3, nat: "대한민국", pos: POS_KEYS[i % 5], path: i % 2 ? "abroad" : "domestic" }, generateCandidates(POS_KEYS[i % 5])[0], `cmp${i}`);
      playToRetirement(c, rand);
      for (const lg of ["kbl", "nba"] as const) {
        const m = similarPlayers(c, lg);
        if (!c.hist.some((h) => h.pro && h.gp > 0)) {
          expect(m).toEqual([]);
          continue;
        }
        found++;
        expect(m).toHaveLength(3);
        expect(new Set(m.map((x) => x.player.name)).size).toBe(3);
        for (let k = 1; k < m.length; k++) expect(m[k].score).toBeLessThanOrEqual(m[k - 1].score);
        for (const x of m) {
          expect(x.score).toBeGreaterThanOrEqual(30);
          expect(x.score).toBeLessThanOrEqual(99);
          expect(x.reasons.length).toBeLessThanOrEqual(3);
        }
      }
    }
    expect(found).toBeGreaterThan(10);
  });

  it("커리어가 실제 선수와 똑같으면 그 선수가 가장 닮았다고 나와요", () => {
    setRandom(seeded(99));
    const c = createCareer({ name: "복제", num: 23, nat: "미국", pos: "SG", path: "abroad" }, generateCandidates("SG")[0], "clone");
    const jordan = COMPS.nba.find((x) => x.name === "마이클 조던")!;
    for (let y = 0; y < jordan.seasons; y++) {
      c.hist.push({
        year: 2030 + y, age: 21 + y, team: "시카고 불스", lg: "nba", pro: true, role: "에이스", gp: 80, min: 38,
        pts: jordan.ppg, reb: jordan.rpg, ast: jordan.apg, stl: 2, blk: 1, fg: 50, rating: 9, w: 60, l: 22,
        result: "리그 우승", ovr0: 93, ovr1: 94, awards: [],
      });
    }
    for (let k = 0; k < 5; k++) c.awardLog.push({ y: 2030 + k, k: "mvp_nba", n: "NBA MVP" });
    for (let k = 0; k < 6; k++) c.awardLog.push({ y: 2031 + k, k: "ring", n: "NBA 우승" });
    const top = similarPlayers(c, "nba")[0];
    expect(top.player.name).toBe("마이클 조던");
    expect(top.score).toBe(99);
    expect(top.reasons).toContain("MVP 수상");
    // NBA에서 뛰었으니 KBL은 "KBL로 치면"이에요.
    expect(careerProfile(c, "kbl")!.played).toBe(false);
  });
});

describe("히든 스탯", () => {
  const attrs = (o: Partial<Record<AttrKey, number>>, rest = 55) =>
    ({ sht: rest, hdl: rest, pas: rest, def: rest, iq: rest, ath: rest, ...o }) as Record<AttrKey, number>;

  it("두 능력치가 함께 높고 나머지보다 두드러지면 히든 스탯이 되고, 낮은 쪽이 높을수록 보너스가 커요", () => {
    expect(specialtiesOf(attrs({ sht: 72, def: 71 })).map((h) => [h.spec.name, h.bonus])).toEqual([["투웨이 플레이어", 1]]);
    expect(specialtiesOf(attrs({ hdl: 84, sht: 82 }))[0]).toMatchObject({ spec: { key: "scorer" }, bonus: 2 });
    expect(specialtiesOf(attrs({ def: 93, ath: 91 }))[0]).toMatchObject({ spec: { key: "stopper" }, bonus: 3 });
    expect(specialtiesOf(attrs({ pas: 75, hdl: 76 }))[0].spec.name).toBe("메인 핸들러");
  });

  it("여러 능력치가 고르게 적당하면 히든 스탯이 없고, 조합은 하나만 인정해요", () => {
    // 모두 72: 높지만 두드러지지 않아요.
    expect(specialtiesOf(attrs({}, 72))).toEqual([]);
    // 한쪽만 높으면 조합이 아니에요.
    expect(specialtiesOf(attrs({ sht: 90 }))).toEqual([]);
    // 세 능력치가 높으면 나머지와 차이가 가장 큰 조합 하나만
    const hits = specialtiesOf(attrs({ sht: 80, def: 80, ath: 74 }, 50));
    expect(hits).toHaveLength(1);
    expect(hits[0].spec.key).toBe("twoway");
  });

  it("BQ는 혼자 유난히 높아도 스마트 플레이어가 되고, 보너스는 합쳐서 4까지예요", () => {
    expect(specialtiesOf(attrs({ iq: 84 })).map((h) => h.spec.key)).toEqual(["smart"]);
    expect(specialtiesOf(attrs({ iq: 80 }))).toEqual([]);
    const both = attrs({ def: 95, ath: 95, iq: 95 }, 55);
    expect(specialtiesOf(both).map((h) => h.spec.key)).toEqual(["stopper", "smart"]);
    expect(specialtyBonus(both)).toBe(4);
  });

  it("평가 오버롤은 오버롤에 히든 스탯 보너스를 더한 값이에요", () => {
    const a = attrs({ sht: 82, def: 81 });
    expect(evalOvrOf(a, "SF") - ovrOf(a, "SF")).toBe(2);
    const plain = attrs({}, 70);
    expect(evalOvrOf(plain, "SF")).toBe(ovrOf(plain, "SF"));
  });
});

describe("NCAA 벤치 성장", () => {
  /** 19세, 리그 평균보다 한참 낮아 거의 못 뛰는 선수 */
  function benchPlayer(id: string, lg: "ncaa" | "kbl", collegeYears = 0): Career {
    const c = createCareer({ name: "벤치", num: 0, nat: "미국", pos: "SG", path: "abroad" }, generateCandidates("SG")[0], id);
    for (const k of ATTR_KEYS) c.p.attrs[k] = LEAGUES[lg].avg - 15;
    c.p.pot = 90;
    c.age = 19;
    c.mil = { s: "exempt" };
    c.stage = lg === "ncaa" ? "college" : "pro";
    c.collegeYears = collegeYears;
    c.team = lg === "ncaa" ? { name: "듀크대", color: "#003087", q: 0.5, lg } : { name: "서울 SK 나이츠", color: "#D7141A", q: 0.5, lg };
    if (lg === "kbl") c.contract = { years: 3, salary: 1 };
    return c;
  }

  it("NCAA 선수는 학년과 상관없이 벤치에 있어도 성장 한계가 깎이지 않고, 프로 벤치는 21세부터 깎여요", () => {
    setRandom(seeded(101));
    const fresh = benchPlayer("ncaa1", "ncaa", 0);
    simulateSeason(fresh);
    expect(fresh.last!.min).toBeLessThan(15);
    expect(fresh.p.pot).toBe(90);

    setRandom(seeded(101));
    const junior = benchPlayer("ncaa3", "ncaa", 2);
    simulateSeason(junior);
    expect(junior.p.pot).toBe(90);

    setRandom(seeded(101));
    const rookie = benchPlayer("kbl20", "kbl");
    rookie.age = 20;
    simulateSeason(rookie);
    expect(rookie.last!.min).toBeLessThan(15);
    expect(rookie.p.pot).toBe(90);

    setRandom(seeded(101));
    const pro = benchPlayer("kbl", "kbl");
    pro.age = 21;
    simulateSeason(pro);
    expect(pro.last!.min).toBeLessThan(15);
    expect(pro.p.pot).toBeLessThan(90);
  });

  it("NCAA 선수는 거의 못 뛰어도 팀 훈련으로 프로 벤치보다 더 커요", () => {
    let ncaa = 0;
    let kbl = 0;
    for (let i = 0; i < 30; i++) {
      setRandom(seeded(200 + i));
      const a = benchPlayer(`n${i}`, "ncaa");
      const before = ovrOf(a.p.attrs, a.p.pos);
      simulateSeason(a);
      ncaa += ovrOf(a.p.attrs, a.p.pos) - before;
      setRandom(seeded(200 + i));
      const b = benchPlayer(`k${i}`, "kbl");
      const before2 = ovrOf(b.p.attrs, b.p.pos);
      simulateSeason(b);
      kbl += ovrOf(b.p.attrs, b.p.pos) - before2;
    }
    expect(ncaa).toBeGreaterThan(kbl * 1.3);
  });
});

describe("부상 정도", () => {
  const rs = Array.from({ length: 101 }, (_, i) => i / 100.0001);

  it("시즌 아웃급 부상은 건강이 아주 낮을 때만 나오고, 건강할수록 짧게 빠져요", () => {
    for (const h of [CRITICAL_HEALTH, 45, 60, 100])
      for (const r of rs) {
        const k = injuryKind(h, r);
        expect(k.severe).toBe(false);
        expect(k.frac[1]).toBeLessThanOrEqual(h >= 50 ? 0.22 : 0.3);
      }
    const low = rs.map((r) => injuryKind(CRITICAL_HEALTH - 1, r));
    expect(low.some((k) => k.severe)).toBe(true);
    expect(low.filter((k) => k.severe).every((k) => k.frac[0] >= 0.5)).toBe(true);
  });

  it("건강이 낮을수록 가벼운 부상의 비율이 줄어요", () => {
    const lightShare = (h: number) => rs.filter((r) => injuryKind(h, r).name === "가벼운 부상").length / rs.length;
    expect(lightShare(90)).toBeGreaterThan(lightShare(40));
    expect(lightShare(40)).toBeGreaterThan(lightShare(20));
  });
});

describe("클러치", () => {
  /** KBL 팀 선수: 리그 평균 대비 rel만큼 높은 능력치 */
  function kblPlayer(id: string, rel: number): Career {
    const c = createCareer({ name: "클러치", num: 3, pos: "SG", path: "domestic" }, generateCandidates("SG")[0], id);
    for (const k of ATTR_KEYS) c.p.attrs[k] = LEAGUES.kbl.avg + rel;
    c.p.pot = 99;
    c.age = 25;
    c.mil = { s: "exempt" };
    c.stage = "pro";
    c.team = { name: "서울 SK 나이츠", color: "#D7141A", q: 0.5, lg: "kbl" };
    c.contract = { years: 5, salary: 3 };
    return c;
  }

  const clutchBoard = (lead: number, tie = 77) => ({ lg: "kbl" as const, team: "서울 SK 나이츠", teamColor: "#D7141A", opp: "부산 KCC 이지스", oppColor: "#003A70", tie, lead });
  const clutchActs = (d: ReturnType<typeof clutchDecision>) =>
    d.opts.map((o) => {
      if (o.act.k !== "clutch") throw new Error("클러치 선택지가 아니에요");
      return o.act;
    });

  it("동점이면 주무기 하나와 공격 플레이 셋이 나오고, 어떤 능력치를 쓰는지는 보여주지 않아요", () => {
    setRandom(seeded(31));
    const c = kblPlayer("opts", 0);
    const seen = new Set<string>();
    for (let i = 0; i < 60; i++) {
      for (const board of [undefined, clutchBoard(0)]) {
        const d = clutchDecision(c, "라이벌전", LEAGUES.kbl.avg, board);
        expect(d.opts).toHaveLength(CLUTCH_SHOWN);
        expect(new Set(d.opts.map((o) => o.label)).size).toBe(CLUTCH_SHOWN);
        expect(d.opts.map((o) => o.tag)).toEqual(["주무기", "공격", "공격", "공격"]);
        expect(clutchActs(d).every((a) => a.ot === undefined)).toBe(true);
        for (const o of d.opts) {
          for (const name of Object.values(SHORT)) expect(o.sub ?? "", o.label).not.toContain(name);
          seen.add(o.label);
        }
      }
    }
    // 주무기와 겹치는 플레이 하나만 빼고 공격 플레이가 모두 나와요.
    expect(seen.size).toBeGreaterThanOrEqual(CLUTCH_OFFENSE.length);
  });

  it("2점 뒤지면 3점슛이 꼭 나오고, 2점짜리는 성공해도 동점이라 연장에서 한 번 더 승부해요", () => {
    setRandom(seeded(32));
    const c = kblPlayer("behind", 0);
    for (const k of ATTR_KEYS) c.p.attrs[k] = 60;
    c.p.attrs.hdl = 75;
    for (let i = 0; i < 30; i++) {
      const d = clutchDecision(c, "라이벌전", LEAGUES.kbl.avg, clutchBoard(-2));
      const acts = clutchActs(d);
      expect(d.opts).toHaveLength(CLUTCH_SHOWN);
      expect(d.opts[0].tag).toBe("주무기");
      expect(d.opts.some((o) => o.label === "3점 라인 밖에서 승부를 건다")).toBe(true);
      for (const a of acts) expect(a.ot === undefined).toBe((a.pts ?? 2) >= 3);
    }
    expect(clutchDecision(c, "라이벌전", LEAGUES.kbl.avg, clutchBoard(-2)).body).toContain("2점 뒤진");
  });

  it("2점 앞서면 상대의 마지막 공격을 막는 수비 플레이만 나와요", () => {
    setRandom(seeded(33));
    const c = kblPlayer("ahead", 0);
    const seen = new Set<string>();
    for (let i = 0; i < 30; i++) {
      const d = clutchDecision(c, "라이벌전", LEAGUES.kbl.avg, clutchBoard(2));
      expect(d.opts).toHaveLength(CLUTCH_SHOWN);
      expect(d.opts.every((o) => o.tag === "수비")).toBe(true);
      d.opts.forEach((o) => seen.add(o.label));
    }
    expect([...seen].sort()).toEqual(CLUTCH_DEFENSE.map((x) => x.label).sort());
    expect(seen).toContain("기습적인 트랩으로 공을 빼앗는다");
  });

  it("주무기는 가장 높은 공격 능력치로 정해지고, 가드와 빅맨의 무브가 달라요", () => {
    const c = kblPlayer("sig", 0);
    for (const k of ATTR_KEYS) c.p.attrs[k] = 60;
    c.p.attrs.def = 95;
    c.p.attrs.sht = 80;
    c.p.pos = "SG";
    expect(signatureMove(c)).toMatchObject({ attr: "sht", pts: 3, label: "가장 자신 있는 무브 · 스텝백 3점슛" });
    c.p.pos = "C";
    expect(signatureMove(c)).toMatchObject({ attr: "sht", pts: 2, label: "가장 자신 있는 무브 · 하이포스트 페이더웨이" });
    c.p.attrs.iq = 85;
    c.p.pos = "SF";
    expect(signatureMove(c).label).toContain("턴어라운드 페이더웨이");
    // 주무기는 같은 능력치의 보통 플레이보다 성공하기 쉬워요. 상한(0.9)에 닿지 않게 능력치를 리그 평균으로 맞춰 비교해요.
    const move = signatureMove(c);
    c.p.attrs.iq = LEAGUES.kbl.avg;
    expect(clutchOdds(c, "iq", LEAGUES.kbl.avg, move)).toBeGreaterThan(clutchOdds(c, "iq", LEAGUES.kbl.avg));
  });

  it("3점슛과 트랩은 잘하는 선수에게 더 유리하고 못하는 선수에게 더 불리해요. 자유투는 덜 갈려요", () => {
    const c = kblPlayer("swing", 0);
    const three = CLUTCH_OFFENSE.find((x) => x.pts === 3 && x.attr === "sht")!;
    const ft = CLUTCH_OFFENSE.find((x) => x.label.includes("파울"))!;
    const gap = (x?: { edge?: number; swing?: number }) => {
      c.p.attrs.sht = LEAGUES.kbl.avg + 15;
      const hi = clutchOdds(c, "sht", LEAGUES.kbl.avg, x);
      c.p.attrs.sht = LEAGUES.kbl.avg - 10;
      return hi - clutchOdds(c, "sht", LEAGUES.kbl.avg, x);
    };
    expect(gap(three)).toBeGreaterThan(gap());
    expect(gap(ft)).toBeLessThan(gap());
  });

  it("상황마다 최종 점수가 달라요: 역전 3점은 1점 차, 트랩 성공은 4점 차, 막지 못하면 3점 역전패, 연장은 연장 점수", () => {
    setRandom(seeded(34));
    expect(clutchFinal(clutchBoard(0), { pts: 2 }, true, true)).toEqual({ final: [79, 77] });
    expect(clutchFinal(clutchBoard(0), { pts: 3 }, true, true)).toEqual({ final: [80, 77] });
    expect(clutchFinal(clutchBoard(0), { pts: 2 }, false, false)).toEqual({ final: [77, 79] });
    expect(clutchFinal(clutchBoard(-2), { pts: 3 }, true, true)).toEqual({ final: [80, 79] });
    expect(clutchFinal(clutchBoard(-2), { pts: 3 }, false, false)).toEqual({ final: [77, 81] });
    expect(clutchFinal(clutchBoard(2), { pts: 0 }, true, true)).toEqual({ final: [79, 77] });
    expect(clutchFinal(clutchBoard(2), { pts: 2 }, true, true)).toEqual({ final: [81, 77] });
    expect(clutchFinal(clutchBoard(2), { pts: 0 }, false, false)).toEqual({ final: [79, 80] });
    for (const win of [true, false]) {
      const r = clutchFinal(clutchBoard(-2), { pts: 2, ot: 0.5 }, true, win);
      expect(r.ot).toBe(true);
      const [us, them] = r.final!;
      expect(us > them).toBe(win);
      expect(Math.min(us, them)).toBeGreaterThan(79);
    }
  });

  it("클러치 상황은 동점, 2점 뒤짐, 2점 앞섬이 모두 나와요", () => {
    setRandom(seeded(35));
    const leads = Array.from({ length: 400 }, () => drawClutchLead());
    for (const lead of [0, -2, 2]) expect(leads.filter((x) => x === lead).length).toBeGreaterThan(60);
  });

  it("뒤진 채 동점을 만들어도 연장에서 지면 경기를 져요. 능력치는 오르고, 경기 기록에 연장이 남아요", () => {
    setRandom(seeded(36));
    const c = kblPlayer("ot", 8);
    startSeason(c);
    stepSeason(c);
    const board = clutchBoard(-2);
    c.run!.next = board;
    const before = c.p.attrs.hdl;
    const wins = c.clutchWins;
    // 첫 난수로 동점 성공, 두 번째 난수로 연장 패배
    const rolls = [0, 0.999];
    setRandom(() => rolls.shift() ?? 0.5);
    applyAction(c, { k: "clutch", attr: "hdl", play: "돌파 레이업", p: 0.6, pts: 2, ot: 0.5 });
    expect(c.p.attrs.hdl).toBe(before + 1);
    expect(c.clutchWins).toBe(wins);
    expect(c.run!.forced).toBe("loss");
    expect(c.news[0].m).toContain("연장 끝에 졌어요");
    setRandom(seeded(37));
    const l = c.run!.l;
    stepSeason(c);
    const g = c.run!.log[0];
    expect(c.run!.l).toBe(l + 1);
    expect(g).toMatchObject({ clutch: "loss", ot: true, opp: board.opp });
    expect(g.us).toBeLessThan(g.them);
  });

  it("고른 플레이의 능력치가 높을수록 성공하기 쉬워요", () => {
    const c = kblPlayer("odds", 0);
    c.p.attrs.sht = LEAGUES.kbl.avg + 15;
    c.p.attrs.hdl = LEAGUES.kbl.avg - 5;
    expect(clutchOdds(c, "sht", LEAGUES.kbl.avg)).toBeGreaterThan(clutchOdds(c, "hdl", LEAGUES.kbl.avg));
  });

  it("성공하면 다음 경기를 이기고 고른 능력치가 오르고, 실패하면 다음 경기를 져요", () => {
    setRandom(seeded(111));
    const c = kblPlayer("win", 8);
    startSeason(c);
    stepSeason(c);
    const act = clutchDecision(c, "라이벌전", LEAGUES.kbl.avg).opts[0].act;
    if (act.k !== "clutch") throw new Error("클러치 선택지가 아니에요");
    const before = c.p.attrs[act.attr];
    setRandom(() => 0);
    applyAction(c, act);
    expect(c.p.attrs[act.attr]).toBe(before + 1);
    setRandom(seeded(112));
    const w = c.run!.w;
    stepSeason(c);
    expect(c.run!.w).toBe(w + 1);
    expect(c.run!.log[0].clutch).toBe("win");

    setRandom(() => 0.999);
    applyAction(c, act);
    setRandom(seeded(113));
    const l = c.run!.l;
    stepSeason(c);
    expect(c.run!.l).toBe(l + 1);
    expect(c.run!.log[0].clutch).toBe("loss");
  });

  it("정규시즌은 한 바퀴에 모든 팀을 한 번씩 만나고, 백투백은 있어도 같은 팀과 세 번 연속 붙지 않아요", () => {
    setRandom(seeded(131));
    let backToBack = 0;
    for (let i = 0; i < 30; i++) {
      const c = kblPlayer(`sched${i}`, 4);
      startSeason(c);
      const opps: string[] = [];
      while (c.run && c.run.phase !== "post" && c.run.phase !== "end") {
        if (currentDecision(c)) chooseOption(c, 0);
        else {
          const g = c.run.g;
          stepSeason(c);
          if (c.run && c.run.g > g) opps.push(c.run.log[0].opp);
        }
      }
      expect(opps.length).toBe(LEAGUES.kbl.games);
      for (let k = 2; k < opps.length; k++) expect(opps[k] === opps[k - 1] && opps[k] === opps[k - 2], `${k}번째 경기 ${opps[k]}`).toBe(false);
      for (let k = 1; k < opps.length; k++) if (opps[k] === opps[k - 1]) backToBack++;
      expect(opps).not.toContain(c.team!.name);
      const counts = [...opps.reduce((m, o) => m.set(o, (m.get(o) ?? 0) + 1), new Map<string, number>()).values()];
      expect(counts.length).toBe(TEAMS.kbl.length - 1);
      expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
    }
    // 바퀴가 바뀔 때 가끔 백투백이 나와요.
    expect(backToBack).toBeGreaterThan(0);
  });

  it("은퇴를 묻는 오프시즌(35세 이상)에는 트레이드하지 않아서, 옮긴 팀에서 안 뛰고 은퇴하는 일이 없어요", () => {
    const traded = (age: number) => {
      let n = 0;
      for (let i = 0; i < 400; i++) {
        setRandom(seeded(5000 + i));
        const c = kblPlayer(`tr${i}`, 8);
        c.age = age;
        c.contract = { years: 3, salary: 5 };
        runOffseason(c, c.year - 1);
        if (c.team!.name !== "서울 SK 나이츠") n++;
        if (age >= 35) expect(c.queue.some((q) => "title" in q && q.title.includes("은퇴"))).toBe(true);
      }
      return n;
    };
    expect(traded(30)).toBeGreaterThan(0);
    expect(traded(35)).toBe(0);
  });

  it("특성마다 설명이 있고, 큰 경기 보정은 승부사 > 보통 > 새가슴, 스타성은 협상에 유리해요", () => {
    expect(TRAIT_KEYS).toHaveLength(13);
    for (const t of TRAIT_KEYS) expect(TRAITS[t].length, t).toBeGreaterThan(10);
    const c = kblPlayer("trait", 0);
    for (const k of ATTR_KEYS) c.p.attrs[k] = LEAGUES.kbl.avg;
    const odds = (t: (typeof TRAIT_KEYS)[number]) => {
      c.p.trait = t;
      return [clutchOdds(c, "sht", LEAGUES.kbl.avg), overtimeOdds(c, LEAGUES.kbl.avg), leverage(c, "kbl")];
    };
    const [hero, normal, choke, star] = [odds("승부사"), odds("꾸준함"), odds("새가슴"), odds("스타성")];
    expect(hero[0]).toBeGreaterThan(normal[0]);
    expect(normal[0]).toBeGreaterThan(choke[0]);
    expect(hero[1]).toBeGreaterThan(normal[1]);
    expect(normal[1]).toBeGreaterThan(choke[1]);
    expect(star[2]).toBeCloseTo(normal[2] + 0.12);
  });

  it("라이벌전으로 걸린 다음 경기는 기록에 라이벌전이 남고, 내가 뛰어서 이겨야 라이벌전 승리로 세요", () => {
    setRandom(seeded(38));
    const c = kblPlayer("rival", 8);
    startSeason(c);
    stepSeason(c);
    const next = (forced: "win" | "loss", out = 0) => {
      c.queue = [];
      Object.assign(c.run!, { rival: true, forced, out, outWhy: out ? "부상" : c.run!.outWhy });
      stepSeason(c);
      return c.run!.log[0];
    };
    expect(next("win")).toMatchObject({ rival: true, win: true });
    expect(c.rivalWins).toBe(1);
    // 진 경기와 결장한 경기는 세지 않아요.
    expect(next("loss")).toMatchObject({ rival: true, win: false });
    expect(next("win", 2)).toMatchObject({ rival: true, win: true, out: "부상" });
    expect(c.rivalWins).toBe(1);
    // 그다음 경기는 다시 보통 경기예요.
    c.queue = [];
    c.run!.out = 0;
    stepSeason(c);
    expect(c.run!.log[0].rival).toBeUndefined();
    c.rivalWins = 5;
    checkAchievements(c);
    expect(c.achv).not.toContain("rival_killer");
    c.rivalWins = 6;
    checkAchievements(c);
    expect(c.achv).toContain("rival_killer");
    // 예전 저장에는 0을 채워요.
    const old = JSON.parse(JSON.stringify(c));
    delete old.rivalWins;
    expect(parseCareer(JSON.stringify(old))!.rivalWins).toBe(0);
  });

  it("예전 저장처럼 최종 점수가 없는 클러치 경기는 전광판의 상대와 동점에서 2점 차로 끝나요", () => {
    setRandom(seeded(121));
    const c = kblPlayer("board", 8);
    startSeason(c);
    stepSeason(c);
    const board = { lg: "kbl" as const, team: c.team!.name, teamColor: c.team!.color, opp: "부산 KCC 이지스", oppColor: "#003A70", tie: 77 };
    for (const [forced, us, them] of [["win", 79, 77], ["loss", 77, 79]] as const) {
      c.run!.next = board;
      c.run!.forced = forced;
      stepSeason(c);
      const g = c.run!.log[0];
      expect(g.opp).toBe(board.opp);
      expect([g.us, g.them]).toEqual([us, them]);
      expect(c.run!.next).toBeNull();
    }
    expect(clutchDecision(c, "라이벌전", LEAGUES.kbl.avg, board).board).toEqual(board);
  });

  it("클러치 상황은 주전이면 시즌마다 한 번, 에이스면 한두 번, 그 아래면 오지 않아요", () => {
    setRandom(seeded(120));
    /** 시즌마다 [예상 출전 시간, 클러치 횟수] */
    const seasons: [number, number][] = [];
    for (const rel of [-12, 4, 8, 12]) {
      for (let i = 0; i < 20; i++) {
        const c = kblPlayer(`s${rel}-${i}`, rel);
        startSeason(c);
        const min = c.run!.min;
        let n = 0;
        while (c.run) {
          const d = currentDecision(c);
          if (d) {
            if (d.title.startsWith("클러치")) n++;
            chooseOption(c, 0);
          } else stepSeason(c);
        }
        seasons.push([min, n]);
      }
    }
    const ace = seasons.filter(([m]) => m >= 33).map(([, n]) => n);
    const starter = seasons.filter(([m]) => m >= 26 && m < 33).map(([, n]) => n);
    const bench = seasons.filter(([m]) => m < 26).map(([, n]) => n);
    for (const list of [ace, starter, bench]) expect(list.length).toBeGreaterThan(10);
    // 에이스: 한 번이나 두 번. 시즌 끝까지 다쳐 있지 않으면 적어도 한 번은 와요.
    expect(Math.max(...ace)).toBe(2);
    expect(ace).toContain(1);
    expect(ace.filter((n) => n >= 1).length / ace.length).toBeGreaterThan(0.85);
    // 주전: 많아야 한 번이고, 거의 늘 한 번
    expect(Math.max(...starter)).toBe(1);
    expect(starter.filter((n) => n === 1).length / starter.length).toBeGreaterThan(0.85);
    expect(bench.every((n) => n === 0)).toBe(true);
  });
});

describe("결승 클러치", () => {
  function kblAce(id: string, rel = 14): Career {
    const c = createCareer({ name: "결승", num: 23, pos: "SF", path: "domestic" }, generateCandidates("SF")[0], id);
    for (const k of ATTR_KEYS) c.p.attrs[k] = LEAGUES.kbl.avg + rel;
    c.p.pot = 99;
    c.age = 26;
    c.mil = { s: "exempt" };
    c.stage = "pro";
    c.team = { name: "서울 SK 나이츠", color: "#D7141A", q: 0.75, lg: "kbl" };
    c.contract = { years: 5, salary: 3 };
    return c;
  }
  const isFinalClutch = (d: Decision | null) => !!d?.board?.finals && d.opts.every((o) => o.act.k === "clutch" && o.act.finals);
  /** 결승 클러치의 성공 확률을 p로 고정하고 첫 선택지를 골라요. */
  function pickFinal(c: Career, p: number) {
    const d = currentDecision(c)!;
    for (const o of d.opts) if (o.act.k === "clutch") Object.assign(o.act, { p, ot: o.act.ot === undefined ? undefined : 1 });
    chooseOption(c, 0);
  }
  /** 결승 클러치가 걸리는 시즌까지 돌려요. 걸리면 그 결정에서 멈춘 커리어를 돌려줘요. */
  function seasonWithFinalClutch(seed: number): Career {
    setRandom(seeded(seed));
    for (let i = 0; i < 80; i++) {
      const c = kblAce(`fc${seed}-${i}`);
      startSeason(c);
      while (c.run) {
        const d = currentDecision(c);
        if (isFinalClutch(d)) return c;
        if (d) chooseOption(c, 0);
        else stepSeason(c);
      }
    }
    throw new Error("결승 클러치가 걸린 시즌이 없어요");
  }

  it("에이스가 결승에 오르면 우승이 걸린 7차전 클러치가 걸리고, 성공하면 4-3 우승이에요", () => {
    const c = seasonWithFinalClutch(301);
    const d = currentDecision(c)!;
    expect(d.art).toBe("clutch");
    expect(d.title).toBe(`결승 클러치 · ${c.run!.year} KBL 챔피언결정전 7차전`);
    expect(d.board).toMatchObject({ lg: "kbl", team: "서울 SK 나이츠", opp: c.run!.final!.opp, finals: `${c.run!.year} KBL 챔피언결정전 7차전` });
    expect(d.opts.every((o) => o.sub?.includes("우승"))).toBe(true);
    const rings = c.awards.ring ?? 0;
    pickFinal(c, 1);
    expect(c.run!.final).toMatchObject({ win: true, series: "4-3" });
    expect(c.run!.champ).toBe(true);
    expect(c.run!.post.at(-1)).toMatchObject({ win: true, score: "4-3" });
    expect(c.news[0].m).toContain("결승 클러치 성공");
    expect(c.run!.final!.us).toBeGreaterThan(c.run!.final!.them);
    // 마지막 플레이로 경기가 끝났으니 결승을 처음부터 다시 중계하지 않고, 결승 결과 소식으로 넘어가요.
    const steps: (string | null)[] = [];
    while (c.run) steps.push(currentDecision(c) ? (chooseOption(c, 0), null) : stepSeason(c));
    expect(steps).not.toContain("final");
    expect(c.live?.key).not.toBe(`league-${c.last!.year}`);
    expect(c.news.some((n) => n.m.startsWith(`KBL 챔피언결정전 · ${c.last!.final!.opp} 상대 4-3 승리`))).toBe(true);
    expect(c.last!.result).toBe("리그 우승");
    expect(c.awards.ring).toBe(rings + 1);
    expect(c.last!.final).toMatchObject({ win: true, series: "4-3" });
  });

  it("결승 클러치에 실패하면 3-4 준우승이고 반지를 받지 못해요", () => {
    const c = seasonWithFinalClutch(302);
    const rings = c.awards.ring ?? 0;
    pickFinal(c, 0);
    expect(c.run!.final).toMatchObject({ win: false, series: "3-4" });
    expect(c.news[0].m).toContain("결승 클러치 실패");
    while (c.run) if (!stepSeason(c)) chooseOption(c, 0);
    expect(c.last!.result).toBe("챔피언결정전 준우승");
    expect(c.awards.ring ?? 0).toBe(rings);
    expect(c.last!.final!.us).toBeLessThan(c.last!.final!.them);
  });

  it("결승에 오른 에이스·주전은 일정 확률로 결승 클러치를 맡고, 그 아래 역할은 맡지 않아요", () => {
    setRandom(seeded(303));
    const count = (rel: number) => {
      let finals = 0;
      let clutch = 0;
      for (let i = 0; i < 60; i++) {
        const c = kblAce(`rate${rel}-${i}`, rel);
        startSeason(c);
        let asked = false;
        while (c.run) {
          const d = currentDecision(c);
          if (isFinalClutch(d)) asked = true;
          if (d) chooseOption(c, 0);
          else stepSeason(c);
        }
        if (c.last!.final && c.last!.gp > 0) {
          finals++;
          if (asked) clutch++;
        }
      }
      return { finals, rate: clutch / Math.max(1, finals) };
    };
    const ace = count(14);
    expect(ace.finals).toBeGreaterThan(10);
    expect(ace.rate).toBeGreaterThan(0.3);
    expect(ace.rate).toBeLessThan(0.9);
    const bench = count(-14);
    expect(bench.rate).toBe(0);
  });

  it("국가대표 결승 클러치: 결승 전까지만 치르고 기다렸다가, 고르면 메달·결승 중계·병역 특례를 정해요", () => {
    setRandom(seeded(304));
    const make = (i: number) => {
      const c = createCareer({ name: "대표", num: 7, nat: "대한민국", pos: "SG", path: "domestic" }, generateCandidates("SG")[0], `nf${i}`);
      for (const k of ATTR_KEYS) c.p.attrs[k] = 92;
      c.age = 25;
      return c;
    };
    for (const p of [1, 0]) {
      let c: Career | null = null;
      for (let i = 0; i < 200 && !c; i++) {
        const x = make(i * 2 + p);
        runNationalTeam(x, "asiangames", 2030, true);
        if (x.natFinal) c = x;
      }
      expect(c).not.toBeNull();
      const t = c!.natLog.at(-1)!;
      expect(t).toMatchObject({ label: "결승 진출", medal: null });
      expect(t.games.some((g) => g.stage === "결승")).toBe(false);
      expect(c!.awards.nat_gold ?? 0).toBe(0);
      expect(c!.live).toBeNull();
      const d = currentDecision(c!)!;
      expect(isFinalClutch(d)).toBe(true);
      expect(d.board).toMatchObject({ lg: "nat", finals: "2030 아시안게임 결승" });
      expect(d.opts.every((o) => o.sub?.includes("금메달"))).toBe(true);
      const caps = c!.nat.caps;
      pickFinal(c!, p);
      const after = c!.natLog.at(-1)!;
      expect(c!.natFinal).toBeNull();
      expect(after.games.at(-1)).toMatchObject({ stage: "결승", win: p === 1 });
      expect(after.medal).toBe(p === 1 ? "금" : "은");
      expect(after.clutch).toMatchObject({ win: p === 1 });
      expect(c!.nat.caps).toBe(caps + 1);
      // 결승 마지막 플레이를 이미 골랐으니 결승 중계는 만들지 않아요.
      expect(c!.live).toBeNull();
      expect(p === 1 ? c!.awards.nat_gold : c!.awards.nat_silver).toBe(1);
      // 아시안게임 금메달이면 병역 특례예요.
      expect(c!.mil.s).toBe(p === 1 ? "exempt" : "none");
    }
  });
});

describe("리그별 시상", () => {
  it("같은 상도 리그마다 실제 이름으로 불러요", () => {
    expect(awardName("nba", "allleague")).toBe("올-NBA 퍼스트팀");
    expect(awardName("nba", "allleague2", 2)).toBe("올-NBA 세컨드팀");
    expect(awardName("nba", "allleague2", 3)).toBe("올-NBA 서드팀");
    expect(awardName("nba", "alldef", 2)).toBe("NBA 올-디펜시브 세컨드팀");
    expect(awardName("nba", "dpoy")).toContain("하킴 올라주원");
    expect(awardName("kbl", "allleague")).toBe("KBL 베스트5");
    expect(awardName("kbl", "alldef")).toBe("KBL 수비 5걸");
    expect(awardName("kbl", "dpoy")).toBe("KBL 최우수수비상");
    expect(awardName("kbl", "scoring")).toBe("KBL 득점왕");
    expect(awardName("euro", "allleague2", 2)).toBe("올-유로리그 세컨드팀");
    expect(nbaConference("LA 레이커스")).toBe("서부");
    expect(nbaConference("보스턴 셀틱스")).toBe("동부");
    expect(conferenceFinalsMvpName("LA 레이커스")).toContain("매직 존슨 트로피");
    expect(conferenceFinalsMvpName("보스턴 셀틱스")).toContain("래리 버드 트로피");
  });

  it("NBA MVP는 늘 올-NBA 퍼스트팀과 올스타이고, 컨퍼런스 파이널 MVP는 파이널에 오른 시즌에만 받아요", () => {
    setRandom(seeded(71));
    let mvps = 0;
    for (let i = 0; i < 120; i++) {
      const c = createCareer({ name: "별", num: 1, nat: "미국", pos: "SF", path: "abroad" }, generateCandidates("SF")[0], `aw${i}`);
      for (const k of ATTR_KEYS) c.p.attrs[k] = LEAGUES.nba.avg + 10;
      c.age = 26;
      c.stage = "pro";
      c.proSeasons = 3;
      c.team = { name: "LA 레이커스", color: "#552583", q: 0.6, lg: "nba" };
      c.contract = { years: 3, salary: 100 };
      const rec = simulateSeason(c);
      if (rec.awards.some((a) => a.startsWith("NBA MVP"))) {
        mvps++;
        expect(rec.awards).toContain("올-NBA 퍼스트팀");
        expect(rec.awards).toContain("NBA 올스타");
      }
      const cf = rec.awards.find((a) => a.includes("컨퍼런스 파이널 MVP"));
      if (cf) {
        expect(cf).toContain("서부");
        expect(rec.result === "리그 우승" || rec.result === "파이널 준우승").toBe(true);
      }
    }
    expect(mvps).toBeGreaterThan(0);
  });

  it("기량발전상은 프로 2년차부터 받아요. 데뷔 시즌은 고교·대학 시절보다 많이 늘었어도 못 받아요", () => {
    setRandom(seeded(73));
    const start = () => {
      const c = createCareer({ name: "별", num: 1, nat: "대한민국", pos: "SG", path: "domestic" }, generateCandidates("SG")[0], "mip");
      for (const k of ATTR_KEYS) c.p.attrs[k] = LEAGUES.kbl.avg + 2;
      c.age = 22;
      c.stage = "pro";
      c.team = { name: "서울 SK 나이츠", color: "#E60012", q: 0.5, lg: "kbl" };
      c.contract = { years: 3, salary: 3 };
      return c;
    };
    // 지난 시즌 기록: 오버롤이 크게 낮았던 시즌
    const last = { ...simulateSeason(start()), ovr0: 40 };
    const mips = { rookie: 0, second: 0 };
    for (let i = 0; i < 200; i++) {
      const c = start();
      const rookie = i % 2 === 0;
      c.proSeasons = rookie ? 0 : 1;
      c.hist = [last];
      if (simulateSeason(c).awards.some((a) => a.includes("기량발전상"))) mips[rookie ? "rookie" : "second"]++;
    }
    expect(mips.rookie).toBe(0);
    expect(mips.second).toBeGreaterThan(0);
  });

  it("NBA MVP·올-NBA·올스타·파이널 MVP는 기록이 그 상에 걸맞은 시즌에만 받아요", () => {
    setRandom(seeded(72));
    const given = new Set<string>();
    for (let i = 0; i < 300; i++) {
      const c = createCareer({ name: "별", num: 1, nat: "미국", pos: POS_KEYS[i % 5], path: "abroad" }, generateCandidates(POS_KEYS[i % 5])[0], `fl${i}`);
      for (const k of ATTR_KEYS) c.p.attrs[k] = LEAGUES.nba.avg + (i % 11);
      c.age = 26;
      c.stage = "pro";
      c.proSeasons = 3;
      c.team = { name: "LA 레이커스", color: "#552583", q: 0.6, lg: "nba" };
      c.contract = { years: 3, salary: 100 };
      const rec = simulateSeason(c);
      const pra = rec.pts + rec.reb + rec.ast;
      for (const a of rec.awards) {
        const floor = a.startsWith("NBA MVP") ? [20, 32]
          : a === "올-NBA 퍼스트팀" ? [20, 32]
          : a === "올-NBA 세컨드팀" ? [19, 31]
          : a === "올-NBA 서드팀" || a.includes("파이널 MVP") ? [17, 29]
          : a === "NBA 올스타" ? [15, 26]
          : null;
        if (!floor) continue;
        given.add(a);
        expect(rec.pts, a).toBeGreaterThanOrEqual(floor[0]);
        expect(pra, a).toBeGreaterThanOrEqual(floor[1]);
      }
    }
    expect(given.has("올-NBA 퍼스트팀") && given.has("NBA 올스타")).toBe(true);
  });
});

describe("축하 팝업", () => {
  const fresh = (id: string) => createCareer({ name: "축하", num: 9, nat: "대한민국", pos: "SF", path: "abroad" }, generateCandidates("SF")[0], id);

  it("우승·금메달·시즌 MVP·파이널 MVP를 받으면 축하가 쌓이고, 다른 상은 쌓이지 않아요", () => {
    const c = fresh("ch1");
    c.team = { name: "보스턴 셀틱스", color: "#007A33", q: 0.6, lg: "nba" };
    const rec = { year: 2034, team: "보스턴 셀틱스", pts: 28.1, reb: 7, ast: 6, awards: [] as string[] } as unknown as Career["hist"][number];
    giveAward(c, "allstar", "NBA 올스타", rec);
    giveAward(c, "mvp_nba", "NBA MVP (마이클 조던 트로피)", rec);
    giveAward(c, "ring", "NBA 우승", rec);
    giveAward(c, "fmvp", "NBA 파이널 MVP (빌 러셀 트로피)", rec);
    giveAward(c, "nat_gold", "2034 아시안게임 금메달");
    expect(c.cheers.map((x) => x.kind)).toEqual(["mvp", "title", "fmvp", "gold"]);
    expect(c.cheers[0].sub).toContain("경기당 28.1점");
    expect(c.cheers[1].color).toBe("#007A33");
  });

  it("NBA 밖 리그도 시즌 MVP → 챔피언결정전 우승 → 파이널 MVP 순으로 축하해요", () => {
    const c = fresh("ch4");
    c.team = { name: "서울 SK 나이츠", color: "#E11B22", q: 0.6, lg: "kbl" };
    const rec = { year: 2031, team: "서울 SK 나이츠", pts: 24.3, reb: 6, ast: 5, awards: [] as string[] } as unknown as Career["hist"][number];
    giveAward(c, "mvp", "KBL 정규리그 MVP", rec);
    giveAward(c, "allleague", "KBL 베스트5", rec);
    giveAward(c, "ring", "KBL 우승", rec);
    giveAward(c, "fmvp", "KBL 챔피언결정전 MVP", rec);
    expect(c.cheers.map((x) => [x.kind, x.title])).toEqual([
      ["mvp", "KBL 정규리그 MVP"],
      ["title", "KBL 우승"],
      ["fmvp", "KBL 챔피언결정전 MVP"],
    ]);
  });

  it("NBA 첫 입성은 한 번만 축하하고, 예전 저장에서 이미 NBA를 뛰었으면 축하하지 않아요", () => {
    const c = fresh("ch2");
    setTeam(c, "kbl", { name: "서울 SK 나이츠", color: "#E11B22", q: 0.5 });
    expect(c.cheers).toEqual([]);
    setTeam(c, "nba", { name: "LA 레이커스", color: "#552583", q: 0.5 });
    setTeam(c, "nba", { name: "보스턴 셀틱스", color: "#007A33", q: 0.5 });
    expect(c.cheers.filter((x) => x.kind === "nba")).toHaveLength(1);
    expect(c.cheers[0].sub).toContain("LA 레이커스");

    const old = JSON.parse(JSON.stringify(fresh("ch3")));
    delete old.cheers;
    delete old.milestones;
    old.hist = [{ year: 2033, lg: "nba", team: "LA 레이커스", awards: [] }];
    const loaded = parseCareer(JSON.stringify(old))!;
    expect(loaded.milestones).toContain("nba");
    setTeam(loaded, "nba", { name: "보스턴 셀틱스", color: "#007A33", q: 0.5 });
    expect(loaded.cheers).toEqual([]);
  });
});

describe("업적", () => {
  it("능력치마다 99를 찍으면 따로 따고, 히든 스탯까지 더한 오버롤 100은 한계 돌파예요", () => {
    const c = createCareer({ name: "업적", num: 7, nat: "대한민국", pos: "SG", path: "domestic" }, generateCandidates("SG")[0], "ach99");
    for (const k of ATTR_KEYS) c.p.attrs[k] = 98;
    expect(checkAchievements(c)).not.toContain("max_sht");
    c.p.attrs.sht = 99;
    expect(checkAchievements(c)).toEqual(["max_sht"]);
    for (const k of ATTR_KEYS) c.p.attrs[k] = 99;
    const got = checkAchievements(c);
    expect(got).toEqual(expect.arrayContaining(["max_hdl", "max_pas", "max_def", "max_iq", "max_ath"]));
    expect(got).not.toContain("max_sht");
    // 능력치가 모두 99면 히든 스탯이 걸리지 않아 오버롤 99에서 멈춰요.
    expect(evalOvr(c.p)).toBe(99);
    expect(got).not.toContain("beyond");
    // 센터가 볼 핸들링만 낮으면 두 능력치 조합 히든 스탯(+3)이 붙어 100을 넘어요.
    c.p.pos = "C";
    c.p.attrs.hdl = 75;
    expect(evalOvr(c.p)).toBeGreaterThanOrEqual(100);
    expect(checkAchievements(c)).toEqual(["beyond"]);
  });

  const fresh = (id: string) => createCareer({ name: "업적", num: 7, nat: "대한민국", pos: "SG", path: "domestic" }, generateCandidates("SG")[0], id);
  /** 프로 시즌 한 줄. 나이는 2027년에 16세로 시작한 선수 기준이에요. */
  const season = (year: number, team: string, lg: LeagueKey, extra: Partial<SeasonRecord> = {}): SeasonRecord => ({
    year, age: year - 2011, team, lg, pro: LEAGUES[lg].pro, role: "주전", gp: 50, min: 30, pts: 15, reb: 5, ast: 4, stl: 1, blk: 0,
    fg: 45, rating: 7, w: 30, l: 20, result: "플레이오프 1라운드", ovr0: 70, ovr1: 70, awards: [], ...extra,
  });
  const won = { result: "리그 우승" };
  const has = (c: Career, id: string) => c.achv.includes(id);

  it("업적 id는 겹치지 않고, 리그마다 왕조 건설과 지배자가 있어요", () => {
    const names = ACHIEVEMENTS.map((a) => a.name);
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
    expect(names).toEqual(expect.arrayContaining(["NBA 왕조 건설", "KBL 왕조 건설", "유로리그의 지배자", "G리그의 지배자", "무관의 제왕", "애국자"]));
  });

  it("한 팀 10시즌 연속은 프랜차이즈 스타예요. 군 복무는 연속을 끊지 않고, 따면 소식과 축하 팝업이 한 번만 떠요", () => {
    const c = fresh("ach1");
    for (let y = 2031; y < 2040; y++) c.hist.push(season(y, "서울 SK 나이츠", "kbl"));
    expect(checkAchievements(c)).not.toContain("franchise");
    c.hist.push({ ...season(2040, "상무", "kbl"), lg: null, pro: false, mil: "sangmu" }, season(2041, "서울 SK 나이츠", "kbl"));
    expect(checkAchievements(c)).toContain("franchise");
    expect(c.cheers.filter((x) => x.kind === "achv" && x.title === "프랜차이즈 스타")).toHaveLength(1);
    expect(c.news[0].m).toContain("업적 달성");
    expect(checkAchievements(c)).toEqual([]);
  });

  it("3시즌 연속 우승은 그 리그의 왕조 건설이에요. 사이에 우승을 놓치면 다시 세요", () => {
    const c = fresh("ach2");
    c.hist.push(season(2031, "서울 SK 나이츠", "kbl", won), season(2032, "서울 SK 나이츠", "kbl", won), season(2033, "서울 SK 나이츠", "kbl"));
    c.hist.push(season(2034, "서울 SK 나이츠", "kbl", won), season(2035, "서울 SK 나이츠", "kbl", won));
    checkAchievements(c);
    expect(has(c, "dynasty_kbl")).toBe(false);
    c.hist.push(season(2036, "서울 SK 나이츠", "kbl", won));
    checkAchievements(c);
    expect(has(c, "dynasty_kbl")).toBe(true);
    expect(has(c, "dynasty_nba")).toBe(false);
  });

  it("3시즌 연속 MVP는 지배자, 우승 없는 MVP 3회는 은퇴해야 무관의 제왕이에요", () => {
    const c = fresh("ach3");
    for (const y of [2031, 2032, 2033]) {
      c.hist.push(season(y, "보스턴 셀틱스", "nba"));
      c.awardLog.push({ y, k: "mvp_nba", n: "NBA MVP" });
    }
    c.awards.mvp_nba = 3;
    checkAchievements(c);
    expect(has(c, "ruler_nba")).toBe(true);
    expect(has(c, "uncrowned")).toBe(false);
    c.stage = "pro";
    c.team = null;
    retire(c);
    expect(has(c, "uncrowned")).toBe(true);
    // 은퇴하며 딴 업적은 팝업 대신 은퇴 화면에서 보여줘요.
    expect(c.cheers.some((x) => x.title === "무관의 제왕")).toBe(false);
  });

  it("한 시즌 MVP·우승·파이널 MVP는 트리플 크라운, 5할 미만 팀의 우승은 언더독, 31세 이후 첫 MVP는 늦게 핀 꽃이에요", () => {
    const c = fresh("ach4");
    c.hist.push(season(2041, "LA 레이커스", "nba", { ...won, w: 38, l: 44 }));
    c.awardLog.push({ y: 2041, k: "mvp_nba", n: "NBA MVP" }, { y: 2041, k: "fmvp", n: "NBA 파이널 MVP" });
    checkAchievements(c);
    expect(has(c, "triple_crown")).toBe(true);
    expect(has(c, "underdog")).toBe(true);
    expect(has(c, "late_bloomer")).toBe(c.hist[0].age >= 31);
  });

  it("드래프트·진로 업적: 1순위, 신데렐라, 역수출, 네 리그 경험", () => {
    const c = fresh("ach5");
    c.draft = { lg: "KBL", pick: 3, round: 1, inRound: 3, team: "서울 SK 나이츠", year: 2030 };
    c.hist.push(season(2031, "서울 SK 나이츠", "kbl"), season(2032, "엑스 팀", "gleague"), season(2033, "레알 마드리드", "euro"), season(2034, "보스턴 셀틱스", "nba"));
    c.awardLog.push({ y: 2031, k: "mvp", n: "KBL 정규리그 MVP" }, { y: 2034, k: "mvp_nba", n: "NBA MVP" });
    c.awards.mvp_nba = 1;
    checkAchievements(c);
    expect(c.achv).toEqual(expect.arrayContaining(["reverse_export", "world_tour", "cinderella"]));
    expect(has(c, "first_pick")).toBe(false);
    const top = fresh("ach6");
    top.draft = { lg: "NBA", pick: 1, round: 1, inRound: 1, team: "보스턴 셀틱스", year: 2030 };
    top.awards.mvp_nba = 1;
    checkAchievements(top);
    expect(has(top, "first_pick")).toBe(true);
    expect(has(top, "cinderella")).toBe(false);
  });

  it("금메달 3회는 애국자, 우승·올림픽·월드컵 금메달은 그랜드슬램, 1000억 기부는 기부천사예요", () => {
    const c = fresh("ach7");
    const gold = (ev: "olympics" | "worldcup" | "asiangames") => ({ year: 2032, ev, name: "대회", joined: true, label: "", medal: "금" as const, story: "", games: [] });
    c.natLog.push(gold("asiangames"), gold("olympics"));
    c.donated = 999;
    checkAchievements(c);
    expect(c.achv).toEqual([]);
    c.natLog.push(gold("worldcup"));
    c.awards.ring = 1;
    c.donated = 1000;
    checkAchievements(c);
    expect(c.achv).toEqual(expect.arrayContaining(["patriot", "grand_slam", "donor", "world_cup"]));
  });

  it("월드컵 금메달은 세계 최강이에요. 불참한 대회에서 대표팀이 딴 금메달은 치지 않아요", () => {
    const c = fresh("ach7b");
    const gold = (year: number, ev: "olympics" | "worldcup" | "asiangames", joined: boolean) =>
      ({ year, ev, name: "대회", joined, label: "", medal: "금" as const, story: "", games: [] });
    c.natLog.push(gold(2031, "worldcup", false), gold(2032, "asiangames", false), gold(2033, "olympics", false), gold(2034, "asiangames", true), gold(2035, "asiangames", true));
    checkAchievements(c);
    expect(c.achv).not.toContain("world_cup");
    expect(c.achv).not.toContain("patriot");
    c.natLog.push(gold(2036, "worldcup", true));
    checkAchievements(c);
    expect(c.achv).toEqual(expect.arrayContaining(["world_cup", "patriot"]));
  });

  it("주장 제안을 받아들이면 캡틴이에요. 고사하면 따지 못해요", () => {
    const offer = (seed: number) => {
      setRandom(seeded(seed));
      const c = fresh(`cap${seed}`);
      c.stage = "pro";
      c.team = { name: "서울 SK 나이츠", color: "#E4002B", q: 0.5, lg: "kbl" };
      c.age = 30;
      for (let i = 0; i < 200; i++) {
        const d = lifeEvent(c);
        if (d?.title === "주장 제안") return { c, d };
      }
      throw new Error("주장 제안이 나오지 않았어요");
    };
    const no = offer(1);
    applyAction(no.c, no.d.opts[1].act);
    checkAchievements(no.c);
    expect(no.c.achv).not.toContain("captain");
    const yes = offer(2);
    applyAction(yes.c, yes.d.opts[0].act);
    expect(yes.c.milestones).toContain("captain");
    checkAchievements(yes.c);
    expect(yes.c.achv).toContain("captain");
  });

  it("처음 오른 프로 결승에서 우승하면 로열 로더, 데뷔 시즌 벤치에서 NBA 우승까지 가면 벤치에서 반지까지예요", () => {
    const lost = fresh("ach10");
    const final = (win: boolean) => ({ final: { opp: "상대", us: 4, them: 2, win, series: win ? "4-2" : "2-4" } });
    lost.hist.push(season(2031, "서울 SK 나이츠", "kbl", final(false)), season(2032, "서울 SK 나이츠", "kbl", { ...won, ...final(true) }));
    checkAchievements(lost);
    expect(has(lost, "royal_road")).toBe(false);
    const c = fresh("ach11");
    c.hist.push(season(2031, "보스턴 셀틱스", "nba", { role: "벤치" }), season(2032, "보스턴 셀틱스", "nba", { ...won, ...final(true) }));
    checkAchievements(c);
    expect(c.achv).toEqual(expect.arrayContaining(["royal_road", "bench_to_ring"]));
  });

  it("베스트 팀 7시즌, 데뷔 시즌 신인상·MVP, 개인상 다섯 가지, 득점왕 7회는 프로 시즌에 받은 상만 세요", () => {
    const c = fresh("ach12");
    // 고교 시즌의 상은 세지 않아요.
    c.hist.push(season(2028, "휘문고", "hs"));
    c.awardLog.push({ y: 2028, k: "scoring", n: "고교 득점왕" }, { y: 2028, k: "mip", n: "고교 기량발전상" });
    for (let y = 2031; y < 2038; y++) {
      c.hist.push(season(y, "서울 SK 나이츠", "kbl"));
      c.awardLog.push({ y, k: y % 2 ? "allleague" : "allleague2", n: "KBL 베스트5" }, { y, k: "scoring", n: "KBL 득점왕" });
    }
    c.awardLog.push({ y: 2031, k: "roy", n: "KBL 신인상" }, { y: 2031, k: "mvp", n: "KBL 정규리그 MVP" });
    c.awardLog.push({ y: 2033, k: "fmvp", n: "KBL 챔피언결정전 MVP" }, { y: 2034, k: "dpoy", n: "KBL 최우수수비상" }, { y: 2035, k: "sixth", n: "KBL 식스맨상" });
    checkAchievements(c);
    expect(c.achv).toEqual(expect.arrayContaining(["consistent", "supernova", "scoring_machine"]));
    expect(has(c, "collector")).toBe(false);
    c.awardLog.push({ y: 2036, k: "mip", n: "KBL 기량발전상" });
    checkAchievements(c);
    expect(has(c, "collector")).toBe(true);
  });

  it("NBA를 거쳐 KBL에서 우승하면 금의환향, 국가대표 50경기는 터줏대감이에요", () => {
    const c = fresh("ach13");
    c.hist.push(season(2031, "서울 SK 나이츠", "kbl", won), season(2032, "보스턴 셀틱스", "nba"));
    c.nat.caps = 49;
    checkAchievements(c);
    expect(has(c, "homecoming")).toBe(false);
    expect(has(c, "national_pillar")).toBe(false);
    c.hist.push(season(2033, "서울 SK 나이츠", "kbl", won));
    c.nat.caps = 50;
    checkAchievements(c);
    expect(c.achv).toEqual(expect.arrayContaining(["homecoming", "national_pillar"]));
  });

  it("연봉 인상 요구가 받아들여질 때만 협상 횟수를 세고, 5번이면 협상의 귀재예요", () => {
    const c = fresh("ach14");
    const team = { name: "서울 SK 나이츠", color: "#E60012", q: 0.5 };
    const nego = (ask: number, p: number) => applyAction(c, { k: "nego", lg: "kbl", team, years: 3, salary: 5, ask, p });
    nego(1.1, 1);
    nego(1, 1);
    nego(1.25, 0);
    expect(c.raises).toBe(1);
    for (let i = 0; i < 4; i++) nego(1.1, 1);
    checkAchievements(c);
    expect(has(c, "negotiator")).toBe(true);
  });

  it("고교·대학 업적: 고교 우승과 MVP, NCAA 우승, 대학 MVP 2회, 고졸 프로 MVP, 워크온 NBA 진출", () => {
    const c = fresh("ach20");
    c.hist.push(season(2027, "휘문고", "hs", { result: "전국대회 우승" }), season(2028, "휘문고", "hs"));
    c.awardLog.push({ y: 2028, k: "mvp", n: "고교 MVP" });
    c.hist.push(season(2031, "서울 SK 나이츠", "kbl"));
    c.awardLog.push({ y: 2031, k: "mvp", n: "KBL 정규리그 MVP" });
    checkAchievements(c);
    expect(c.achv).toEqual(expect.arrayContaining(["hs_king", "straight_to_pro"]));

    const u = fresh("ach21");
    applyAction(u, { k: "school", lg: "ncaa", team: { name: "듀크대", color: "#003087", q: 0.5 }, walk: true });
    u.hist.push(season(2030, "듀크대", "ncaa", { result: "전국대회 우승" }), season(2031, "듀크대", "ncaa"), season(2032, "보스턴 셀틱스", "nba"));
    u.awardLog.push({ y: 2030, k: "mvp", n: "NCAA MVP" }, { y: 2032, k: "mvp_nba", n: "NBA MVP" });
    checkAchievements(u);
    expect(u.achv).toEqual(expect.arrayContaining(["march_madness", "walk_on"]));
    // 대학을 거쳤으니 고졸 신화가 아니고, 대학 MVP는 한 번뿐이에요.
    expect(has(u, "straight_to_pro")).toBe(false);
    expect(has(u, "campus_legend")).toBe(false);
    u.awardLog.push({ y: 2031, k: "mvp", n: "NCAA MVP" });
    checkAchievements(u);
    expect(has(u, "campus_legend")).toBe(true);
  });

  it("업적마다 조건과 다른 힌트가 있어요", () => {
    for (const a of ACHIEVEMENTS) {
      expect(a.hint.length, a.id).toBeGreaterThan(0);
      expect(a.hint, a.id).not.toBe(a.desc);
    }
  });

  it("NBA에 간 뒤 한 팀에서만 5시즌, 우승 없이 은퇴하면 마지막 로맨티스트예요", () => {
    const c = fresh("ach30");
    c.hist.push(season(2030, "서울 SK 나이츠", "kbl"));
    for (let y = 2031; y < 2036; y++) c.hist.push(season(y, "보스턴 셀틱스", "nba"));
    checkAchievements(c);
    expect(has(c, "romantic")).toBe(false);
    c.stage = "pro";
    c.team = null;
    retire(c);
    expect(has(c, "romantic")).toBe(true);
    const ringed = fresh("ach31");
    for (let y = 2031; y < 2036; y++) ringed.hist.push(season(y, "보스턴 셀틱스", "nba"));
    ringed.awards.ring = 1;
    ringed.stage = "pro";
    retire(ringed);
    expect(has(ringed, "romantic")).toBe(false);
  });

  it("능력치 네 가지 90, 클러치 성공 10번, 35세 이후 오버롤 92, 사치품 다섯 가지", () => {
    const c = fresh("ach32");
    const keys = ATTR_KEYS.slice(0, 4);
    for (const k of ATTR_KEYS) c.p.attrs[k] = 80;
    for (const k of keys.slice(0, 3)) c.p.attrs[k] = 90;
    checkAchievements(c);
    expect(has(c, "versatile")).toBe(false);
    c.p.attrs[keys[3]] = 90;
    c.hist.push(season(2046, "보스턴 셀틱스", "nba", { ovr1: 92 }));
    expect(c.hist[0].age).toBeGreaterThanOrEqual(35);
    c.owned.push("sneakers", "watch", "trophyroom", "car");
    checkAchievements(c);
    expect(c.achv).toEqual(expect.arrayContaining(["versatile", "ageless"]));
    expect(c.achv.some((id) => id.startsWith("max_") || id === "beyond")).toBe(false);
    expect(has(c, "luxury")).toBe(false);
    c.owned.push("yacht");
    checkAchievements(c);
    expect(has(c, "luxury")).toBe(true);

    setRandom(() => 0);
    c.run = { forced: null, form: 0 } as unknown as Career["run"];
    for (let i = 0; i < 10; i++) applyAction(c, { k: "clutch", attr: "sht", play: "버저비터", p: 1 } as Parameters<typeof applyAction>[1]);
    expect(c.clutchWins).toBe(10);
    c.run = null;
    checkAchievements(c);
    expect(has(c, "clutch_master")).toBe(true);
  });

  it("병역 업적: 상무 입대·D리그 우승·전역 뒤 NBA, 현역 입대·전역 뒤 MVP·우승. 입대 전 기록은 치지 않아요", () => {
    const service = (year: number, kind: "sangmu" | "army", result: string): SeasonRecord => ({
      ...season(year, kind === "sangmu" ? "상무 (국군체육부대)" : "육군 (현역 복무)", "kbl"), lg: null, pro: false, mil: kind, result,
    });
    const s = fresh("mil1");
    checkAchievements(s);
    expect(s.achv.some((id) => id.startsWith("sangmu") || id.startsWith("army"))).toBe(false);
    s.hist.push(season(2034, "보스턴 셀틱스", "nba"));
    s.mil = { s: "serving", kind: "sangmu" };
    checkAchievements(s);
    expect(has(s, "sangmu")).toBe(true);
    s.hist.push(service(2035, "sangmu", "KBL D리그 준우승"), service(2036, "sangmu", "KBL D리그 우승"));
    s.mil = { s: "served", kind: "sangmu" };
    checkAchievements(s);
    expect(has(s, "sangmu_champ")).toBe(true);
    // 입대 전 NBA 시즌은 치지 않아요.
    expect(has(s, "sangmu_nba")).toBe(false);
    s.hist.push(season(2037, "보스턴 셀틱스", "nba"));
    checkAchievements(s);
    expect(has(s, "sangmu_nba")).toBe(true);
    expect(s.achv.some((id) => id.startsWith("army"))).toBe(false);

    const a = fresh("mil2");
    a.hist.push(season(2033, "서울 SK 나이츠", "kbl", won));
    a.awardLog.push({ y: 2033, k: "mvp", n: "KBL MVP" });
    a.mil = { s: "serving", kind: "army" };
    checkAchievements(a);
    expect(has(a, "army")).toBe(true);
    expect(has(a, "army_mvp") || has(a, "army_ring")).toBe(false);
    a.hist.push({ ...service(2034, "army", "현역 복무"), gp: 0 });
    a.mil = { s: "served", kind: "army" };
    a.hist.push(season(2035, "서울 SK 나이츠", "kbl", won));
    a.awardLog.push({ y: 2035, k: "mvp", n: "KBL MVP" });
    checkAchievements(a);
    expect(a.achv).toEqual(expect.arrayContaining(["army_mvp", "army_ring"]));
    expect(has(a, "sangmu")).toBe(false);
  });

  it("끝까지 플레이한 커리어의 업적은 목록에 있는 것만 한 번씩이고, 예전 저장에는 빈 목록을 채워요", () => {
    setRandom(seeded(81));
    for (let i = 0; i < 20; i++) {
      const c = createCareer({ name: "끝", num: 1, nat: "대한민국", pos: POS_KEYS[i % 5], path: i % 2 ? "abroad" : "domestic" }, generateCandidates(POS_KEYS[i % 5])[0], `achp${i}`);
      playToRetirement(c, seeded(900 + i));
      expect(new Set(c.achv).size).toBe(c.achv.length);
      for (const id of c.achv) expect(ACHIEVEMENTS.some((a) => a.id === id)).toBe(true);
    }
    const old = JSON.parse(JSON.stringify(fresh("ach8")));
    delete old.achv;
    expect(parseCareer(JSON.stringify(old))!.achv).toEqual([]);
  });
});

describe("브라우저 업적과 누적 기록", () => {
  afterEach(() => {
    setBrowserRecord();
    vi.unstubAllGlobals();
  });

  const fresh = (id: string, pos: PosKey = "SG", nat = "대한민국") =>
    createCareer({ name: `누적${id}`, num: 7, nat, pos, path: "domestic" }, generateCandidates(pos)[0], id);
  const proSeason = (year: number, extra: Partial<SeasonRecord> = {}): SeasonRecord => ({
    year, age: year - 2011, team: "서울 SK 나이츠", lg: "kbl", pro: true, role: "주전", gp: 50, min: 30, pts: 20, reb: 5, ast: 4, stl: 1, blk: 0,
    fg: 45, rating: 7, w: 30, l: 20, result: "플레이오프 1라운드", ovr0: 70, ovr1: 70, awards: [], ...extra,
  });
  /** 프로 시즌을 n개 쌓은 커리어: 시즌마다 50경기 20득점(1000점) */
  const played = (c: Career, n: number) => {
    for (let i = 0; i < n; i++) c.hist.push(proSeason(2031 + i));
    c.proSeasons = n;
    return c;
  };
  /** 노드에는 localStorage가 없어서 메모리로 흉내 내요. */
  const fakeStorage = () => {
    const m = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => m.set(k, v), removeItem: (k: string) => m.delete(k) },
    });
    return m;
  };

  it("이 브라우저에서 이미 딴 업적은 새 커리어에서 조건을 채워도 다시 뜨지 않아요", () => {
    setBrowserRecord(() => ({ unlocked: new Set(["franchise"]), recent: 0, others: EMPTY_LIFETIME }));
    const c = fresh("dup");
    for (let y = 2031; y < 2042; y++) c.hist.push(proSeason(y));
    expect(checkAchievements(c)).not.toContain("franchise");
    expect(c.achv).not.toContain("franchise");
    expect(c.cheers.some((x) => x.title === "프랜차이즈 스타")).toBe(false);
    expect(c.news.some((n) => n.m.includes("프랜차이즈 스타"))).toBe(false);
    // 브라우저 기록이 없으면 그대로 따요.
    setBrowserRecord();
    expect(checkAchievements(c)).toContain("franchise");
  });

  it("누적 기록 업적은 다른 커리어들의 기록에 이번 커리어를 더해 판정해요", () => {
    const others = { ...EMPTY_LIFETIME, careers: 2, pts: 49500, pos: ["PG", "SF", "PF", "C"] as PosKey[], nats: ["일본", "미국"] };
    setBrowserRecord(() => ({ unlocked: new Set(), recent: 0, others }));
    const c = played(fresh("life"), 1);
    const got = checkAchievements(c);
    // 2점 차로 모자란 은퇴는 아직, 득점(49,500 + 1,000)·포지션(SG 추가)·국적(대한민국 추가)은 달성
    expect(got).toEqual(expect.arrayContaining(["life_points", "life_positions", "life_nations"]));
    expect(got).not.toContain("life_retire3");
    c.stage = "pro";
    c.team = null;
    retire(c);
    expect(c.achv).toContain("life_retire3");
    // 프로 무대를 밟지 않은 커리어는 포지션·국적에 들지 않아요.
    expect(fromCareer(fresh("none", "C", "호주"))).toMatchObject({ pos: [], nats: [], seasons: 0 });
    expect(addLifetime(others, fromCareer(c)).pos).toHaveLength(5);
  });

  it("업적 사냥꾼은 누적 기록을 세기 시작한 뒤로 딴 업적만, 이번에 함께 딴 업적까지 세요", () => {
    const ids = ACHIEVEMENTS.filter((a) => a.group !== "lifetime" && a.id !== "franchise").slice(0, 29).map((a) => a.id);
    const tenYears = () => {
      const c = fresh("hunter");
      for (let y = 2031; y < 2042; y++) c.hist.push(proSeason(y));
      return c;
    };
    // 29개를 모두 세기 시작하기 전에 땄으면 아직이에요.
    setBrowserRecord(() => ({ unlocked: new Set(ids), recent: 0, others: EMPTY_LIFETIME }));
    expect(checkAchievements(tenYears())).not.toContain("life_hunter");
    setBrowserRecord(() => ({ unlocked: new Set(ids), recent: 29, others: EMPTY_LIFETIME }));
    expect(checkAchievements(tenYears())).toEqual(expect.arrayContaining(["franchise", "life_hunter"]));
  });

  it("저장소는 커리어마다 몫을 쌓고, 은퇴하지 않고 새로 시작한 커리어도 남겨요", () => {
    const m = fakeStorage();
    startLifetime(null);
    const a = played(fresh("sa"), 3);
    saveCareer(a);
    expect(loadLifeView().t).toMatchObject({ seasons: 3, pts: 3000, careers: 0 });
    // 같은 커리어를 다시 저장하면 몫을 바꿔 쓸 뿐 두 번 더하지 않아요.
    a.hist.push(proSeason(2034));
    a.proSeasons = 4;
    saveCareer(a);
    expect(loadLifeView().t).toMatchObject({ seasons: 4, pts: 4000 });
    // 은퇴하지 않고 새로 시작해도 쌓은 몫은 남아요.
    saveCareer(null);
    const b = played(fresh("sb", "C"), 2);
    saveCareer(b);
    expect(loadLifeView().t).toMatchObject({ seasons: 6, pts: 6000, pos: ["SG", "C"] });
    // 업적 판정에는 지금 커리어를 뺀 기록을 줘요. 지금 커리어는 판정할 때 새로 더해요.
    expect(browserRecord(b).others).toMatchObject({ seasons: 4, pts: 4000 });
    expect(browserRecord(fresh("sc")).others).toMatchObject({ seasons: 6 });
    expect(m.has("b2r-lifetime-v2")).toBe(true);
  });

  it("저장한 커리어가 딴 업적은 브라우저 기록이 되고, 다음 커리어는 다시 따지 않아요", () => {
    fakeStorage();
    setBrowserRecord(browserRecord);
    const a = fresh("ra");
    for (let y = 2031; y < 2042; y++) a.hist.push(proSeason(y));
    expect(checkAchievements(a)).toContain("franchise");
    saveCareer(a);
    expect(loadAchievements().franchise).toMatchObject({ name: a.p.name, career: "ra" });
    const b = fresh("rb");
    for (let y = 2031; y < 2042; y++) b.hist.push(proSeason(y));
    expect(checkAchievements(b)).not.toContain("franchise");
    // 같은 커리어를 다시 불러와도 이미 딴 업적은 그대로 남아요.
    expect(a.achv).toContain("franchise");
  });

  it("누적 기록은 지금부터 새로 세요: 예전 은퇴 기록과 진행 중인 커리어가 이미 쌓은 기록, 예전에 딴 업적은 치지 않아요", () => {
    const m = fakeStorage();
    // 누적 기록이 생기기 전에 은퇴한 선수와, 그 전에 딴 업적 30개
    const old = played(fresh("hall", "PF", "프랑스"), 5);
    old.awards.ring = 2;
    saveHall([retire(old)]);
    const ids = ACHIEVEMENTS.filter((a) => a.group !== "lifetime").slice(0, 30).map((a) => a.id);
    const longAgo = Object.fromEntries(ids.map((id) => [id, { at: 1, name: "옛 선수", career: "hall" }]));
    // 예전 버전(v1)이 명예의 전당을 옮겨 담아 딴 누적 기록 업적
    m.set("b2r-achv-v1", JSON.stringify({ ...longAgo, life_hunter: { at: 2, name: "옛 선수", career: "now" } }));
    m.set("b2r-lifetime-v1", JSON.stringify({ base: { ...EMPTY_LIFETIME, careers: 9, seasons: 90 }, cur: null }));
    const now = played(fresh("now"), 6);
    now.achv.push("life_hunter");

    startLifetime(now);
    setBrowserRecord(browserRecord);
    expect(loadLifeView()).toEqual({ t: EMPTY_LIFETIME, achv: 0 });
    expect(loadAchievements().life_hunter).toBeUndefined();
    expect(Object.keys(loadAchievements())).toHaveLength(30);
    expect(now.achv).not.toContain("life_hunter");
    expect(m.has("b2r-lifetime-v1")).toBe(false);
    expect(checkAchievements(now).filter((id) => id.startsWith("life_"))).toEqual([]);

    // 진행 중이던 커리어는 그 뒤로 쌓은 시즌만 쳐요.
    now.hist.push(proSeason(2040));
    now.proSeasons = 7;
    saveCareer(now);
    expect(loadLifeView().t).toMatchObject({ seasons: 1, pts: 1000, careers: 0, pos: ["SG"] });
    expect(browserRecord(now).start).toMatchObject({ seasons: 6 });
    // 한 번 세기 시작하면 다시 불러와도 처음으로 돌아가지 않아요.
    startLifetime(now);
    expect(loadLifeView().t.seasons).toBe(1);
  });
});
