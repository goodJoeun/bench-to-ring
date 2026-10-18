import { afterEach, describe, expect, it } from "vitest";
import {
  ARCHETYPES,
  ATTR_KEYS,
  NATIONS,
  POS_KEYS,
  applyAction,
  chooseOption,
  createCareer,
  currentDecision,
  generateCandidate,
  generateCandidates,
  ovrOf,
  rankHall,
  resetRandom,
  seeded,
  setRandom,
  simulateSeason,
  simulateTournament,
  teamPower,
  titleHistory,
  type Career,
  type CareerSummary,
} from "@/game";
import { lifeEvent } from "@/game/events";
import { nationalCallUp } from "@/game/national";
import { decodeSave, encodeSave } from "@/game/storage";

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
  it("모든 포지션·플레이 유형에서 능력치 합 240, 오버롤 45로 시작해요", () => {
    setRandom(seeded(7));
    for (let i = 0; i < 40; i++) {
      for (const pos of POS_KEYS) {
        for (const cand of ARCHETYPES[pos].map((_, a) => generateCandidate(pos, a))) {
          const sum = ATTR_KEYS.reduce((t, k) => t + cand.attrs[k], 0);
          expect(sum).toBe(240);
          expect(Math.round(ovrOf(cand.attrs, pos))).toBe(45);
        }
      }
    }
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
