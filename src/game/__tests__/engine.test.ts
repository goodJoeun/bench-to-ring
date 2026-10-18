import { afterEach, describe, expect, it } from "vitest";
import {
  ARCHETYPES,
  ATTR_KEYS,
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
  simulateSeason,
  simulateTournament,
  teamPower,
  titleHistory,
  type AttrKey,
  type Career,
  type CareerSummary,
} from "@/game";
import { lifeEvent } from "@/game/events";
import { makeLiveGame } from "@/game/live";
import { militaryDecision } from "@/game/military";
import { nationalCallUp, runNationalTeam } from "@/game/national";
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

describe("드래프트 진행", () => {
  const prospect = (attr: number) => {
    const c = createCareer({ name: "드래프티", num: 1, nat: "대한민국", pos: "SG", path: "abroad" }, generateCandidates("SG")[0], "dr");
    for (const k of ATTR_KEYS) c.p.attrs[k] = attr;
    c.age = 21;
    c.year = 2032;
    c.stage = "college";
    return c;
  };

  it("지명되면 그 순위에 지명한 팀과 내 이름이 있고, 라운드마다 모든 팀이 한 번씩 뽑아요", () => {
    setRandom(seeded(11));
    for (const [d, size, teams] of [["nba", 60, 30], ["kbl", 20, 10]] as const) {
      const c = prospect(d === "nba" ? 74 : 62);
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
