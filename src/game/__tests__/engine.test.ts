import { afterEach, describe, expect, it } from "vitest";
import {
  ARCHETYPES,
  ATTR_KEYS,
  LEAGUES,
  NATIONS,
  POS_KEYS,
  RECORD_BOARDS,
  applyAction,
  careerTotals,
  chooseOption,
  createCareer,
  currentDecision,
  generateCandidate,
  generateCandidates,
  ovrOf,
  placeOnBoard,
  rankHall,
  resetRandom,
  seeded,
  setRandom,
  START_CAP,
  START_MIN,
  SPIKE_CAP,
  TEAMS,
  STUDENT_ALLOWANCE,
  bodyOf,
  careerSummary,
  investCost,
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
  evalOvrOf,
  specialtiesOf,
  specialtyBonus,
  COMPS,
  careerProfile,
  similarPlayers,
  teamPower,
  titleHistory,
  type AttrKey,
  type Career,
  type CareerSummary,
} from "@/game";
import { bigGameDecision, clutchDecision, injuryDecision, lifeEvent } from "@/game/events";
import { makeLiveGame } from "@/game/live";
import { militaryDecision } from "@/game/military";
import { nationalCallUp, runNationalTeam } from "@/game/national";
import { decodeSave, encodeSave } from "@/game/storage";
import { refreshShop, shopPerks } from "@/game/shop";

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

  it("능력치 하나가 55를 넘는 후보는 아주 드물고, 넘어도 60까지예요", () => {
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

  it("유형마다 주특기는 55, 강점은 50까지 시작해 같은 능력치라도 유형별로 차이가 나요", () => {
    setRandom(seeded(9));
    for (const pos of POS_KEYS)
      ARCHETYPES[pos].forEach((arch, a) => {
        for (let i = 0; i < 60; i++) {
          const cand = generateCandidate(pos, a);
          const over = ATTR_KEYS.filter((k) => cand.attrs[k] > startCap(arch, k));
          // 아주 드물게 가장 강한 능력치 하나만 5 더 열려요.
          expect(over.length).toBeLessThanOrEqual(1);
          for (const k of over) expect(cand.attrs[k]).toBeLessThanOrEqual(startCap(arch, k) + 5);
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

describe("저장 코드", () => {
  it("한글이 들어간 커리어도 그대로 되돌려요", () => {
    setRandom(seeded(3));
    const c = createCareer({ name: "벤치의 왕", num: 23, nat: "대한민국", pos: "SF", path: "domestic" }, generateCandidates("SF")[1], "save");
    simulateSeason(c);
    expect(decodeSave(encodeSave(c))).toEqual(c);
    expect(decodeSave("이건 저장 코드가 아니에요")).toBeNull();
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
    const m = decodeSave(JSON.stringify(old))!;
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
    expect(decodeSave(encodeSave(m))!.p.attrs).toEqual(m.p.attrs);
  });

  it("v1(가상 리그) 저장 코드를 실제 리그 키로 바꿔서 불러와요", () => {
    setRandom(seeded(11));
    const c = createCareer({ name: "옛 저장", num: 3, nat: "대한민국", pos: "PG", path: "abroad" }, generateCandidates("PG")[0], "old");
    simulateSeason(c);
    const v1 = JSON.parse(JSON.stringify(c).replace('"v":2', '"v":1'));
    v1.team.lg = "court";
    v1.hist[0].lg = "gbl";
    v1.awards = { mvp_gbl: 2, ring: 1 };
    v1.awardLog = [{ y: 2027, k: "mvp_gbl", n: "GBL MVP" }];
    const code = btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(v1))));
    const loaded = decodeSave(code)!;
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
    const loaded = decodeSave(JSON.stringify(old))!;
    expect(loaded.events).toEqual({});
    expect(loaded.perks).toEqual({});
  });
});

describe("명예의 전당 순위", () => {
  it("네 항목이 모두 같으면 공동 순위예요", () => {
    const base = { mvp: 1, peak: 90, personal: 5, pts: 10000 } as CareerSummary;
    const ranked = rankHall([
      { ...base, id: "a" },
      { ...base, id: "b" },
      { ...base, id: "c", mvp: 2 },
    ]);
    expect(ranked.map((r) => [r.career.id, r.rank])).toEqual([
      ["c", 1],
      ["a", 2],
      ["b", 2],
    ]);
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

  it("약체국은 스타가 있어도 올림픽·월드컵 메달이 거의 없고, 강호와 지역 대회는 현실적인 확률이에요", () => {
    setRandom(seeded(31));
    expect(odds("대한민국", "olympics", 85).medal).toBeLessThan(0.01);
    expect(odds("대한민국", "worldcup", 85).medal).toBeLessThan(0.02);
    const ag = odds("대한민국", "asiangames", 70);
    expect(ag.gold).toBeGreaterThan(0.05);
    expect(ag.gold).toBeLessThan(0.35);
    expect(odds("미국", "olympics", 88).gold).toBeGreaterThan(0.6);
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
});

describe("시즌 투자", () => {
  const pro = (seed: string) => {
    const c = createCareer({ name: "투자", num: 8, nat: "일본", pos: "SG", path: "abroad" }, generateCandidates("SG")[0], seed);
    c.stage = "pro";
    c.team = { lg: "kbl", name: "서울 SK 나이츠", color: "#E4002B", q: 0.5 };
    c.contract = { years: 3, salary: 2 };
    c.age = 22;
    return c;
  };

  it("시즌을 시작할 때 연봉 비례 비용을 내고, 두 가지까지만, 가진 돈 안에서만 해요", () => {
    setRandom(seeded(31));
    const c = pro("inv1");
    expect(investCost(c, "coach")).toBe(0.6);
    expect(investCost(c, "video")).toBe(0.3);
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
    poor.earnings = 0.5;
    poor.invest = ["coach", "diet"];
    simulateSeason(poor);
    expect(poor.last!.invest).toEqual(["diet"]);
    expect(poor.news.some((n) => n.m.includes("자금이 모자라"))).toBe(true);
  });

  it("투자한 시즌은 같은 운이라도 더 크고 더 건강해요", () => {
    const run = (invest: Career["invest"]) => {
      setRandom(seeded(77));
      const c = pro("inv3");
      c.earnings = 10;
      c.health = 60;
      c.invest = invest;
      const before = { ...c.p.attrs };
      simulateSeason(c);
      return { gain: ATTR_KEYS.reduce((t, k) => t + c.p.attrs[k] - before[k], 0), ath: c.p.attrs.ath - before.ath, health: c.health };
    };
    const none = run([]);
    expect(run(["coach"]).gain).toBeGreaterThan(none.gain);
    expect(run(["gym"]).ath).toBeGreaterThan(none.ath);
    expect(run(["rehab", "diet"]).health).toBeGreaterThan(none.health);
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
      kbl: { gp: 104, pts: 999 + 1000, reb: Math.round(54 * 6.2 + 350), ast: Math.round(54 * 3.1 + 200) },
      nba: { gp: 82, pts: 820, reb: 246, ast: 82 },
      olympics: { gp: 3, pts: 40, reb: 0, ast: 0 },
    });
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
    const loaded = decodeSave(encodeSave(c))!;
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
});

describe("은퇴 회고", () => {
  it("입단에서 시작해 시즌마다 한 칸씩 지나 은퇴로 끝나고, 쌓인 기록은 줄지 않아요", () => {
    const rand = seeded(97);
    setRandom(rand);
    for (let i = 0; i < 20; i++) {
      const c = createCareer({ name: "회고", num: 9, nat: "대한민국", pos: "SF", path: i % 2 ? "abroad" : "domestic" }, generateCandidates("SF")[0], `fw${i}`);
      playToRetirement(c, rand);
      const steps = careerJourney(c);
      expect(steps[0].title).toBe("벤치에서 시작");
      expect(steps.at(-1)!.title).toBe("은퇴");
      expect(steps.at(-1)!.detail).toContain(`${c.hist.length}시즌`);
      for (const h of c.hist) expect(steps.some((s) => s.year === h.year && s.team === h.team)).toBe(true);
      for (let k = 1; k < steps.length; k++) {
        expect(steps[k].year).toBeGreaterThanOrEqual(steps[k - 1].year);
        expect(steps[k].pts).toBeGreaterThanOrEqual(steps[k - 1].pts);
        expect(steps[k].trophies).toBeGreaterThanOrEqual(steps[k - 1].trophies);
      }
      expect(steps.at(-1)!.trophies).toBe(c.awardLog.length);
      if (c.awards.ring) expect(steps.some((s) => s.big && s.title.endsWith("우승"))).toBe(true);
    }
  });
});

describe("닮은 꼴 선수", () => {
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

  it("NCAA 선수는 학년과 상관없이 벤치에 있어도 성장 한계가 깎이지 않고, 프로 벤치는 깎여요", () => {
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
    const pro = benchPlayer("kbl", "kbl");
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

  it("공격 셋·수비 둘 중에서 고르고, 그 능력치가 높을수록 성공하기 쉬워요", () => {
    const c = kblPlayer("opts", 0);
    c.p.attrs.sht = LEAGUES.kbl.avg + 15;
    const d = clutchDecision(c, "라이벌전", LEAGUES.kbl.avg);
    expect(d.opts.map((o) => o.tag)).toEqual(["공격", "공격", "공격", "수비", "수비"]);
    const p = (attr: string) => d.opts.map((o) => o.act).find((a) => a.k === "clutch" && a.attr === attr)!;
    const sht = p("sht");
    const hdl = p("hdl");
    if (sht.k !== "clutch" || hdl.k !== "clutch") throw new Error("클러치 선택지가 아니에요");
    expect(sht.p).toBeGreaterThan(hdl.p);
  });

  it("성공하면 다음 경기를 이기고 고른 능력치가 오르고, 실패하면 다음 경기를 져요", () => {
    setRandom(seeded(111));
    const c = kblPlayer("win", 8);
    startSeason(c);
    stepSeason(c);
    const act = clutchDecision(c, "라이벌전", LEAGUES.kbl.avg).opts[0].act;
    const before = c.p.attrs.sht;
    setRandom(() => 0);
    applyAction(c, act);
    expect(c.p.attrs.sht).toBe(before + 1);
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

  it("클러치 상황은 주전 이상에게만 와요", () => {
    const count = (rel: number, seed: number) => {
      setRandom(seeded(seed));
      let n = 0;
      for (let i = 0; i < 25; i++) {
        const c = kblPlayer(`s${seed}-${i}`, rel);
        startSeason(c);
        while (c.run) {
          const d = currentDecision(c);
          if (d) {
            if (d.title.startsWith("클러치")) n++;
            chooseOption(c, 0);
          } else stepSeason(c);
        }
      }
      return n;
    };
    expect(count(8, 120)).toBeGreaterThan(5);
    expect(count(-12, 121)).toBe(0);
  });
});
