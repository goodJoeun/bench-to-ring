import { afterEach, describe, expect, it } from "vitest";
import {
  ATTR_KEYS,
  POS_KEYS,
  chooseOption,
  createCareer,
  currentDecision,
  generateCandidates,
  ovrOf,
  rankHall,
  resetRandom,
  seeded,
  setRandom,
  simulateSeason,
  type Career,
  type CareerSummary,
} from "@/game";
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
  it("모든 포지션에서 능력치 합 240, 오버롤 45로 시작해요", () => {
    setRandom(seeded(7));
    for (let i = 0; i < 40; i++) {
      for (const pos of POS_KEYS) {
        for (const cand of generateCandidates(pos)) {
          const sum = ATTR_KEYS.reduce((t, k) => t + cand.attrs[k], 0);
          expect(sum).toBe(240);
          expect(Math.round(ovrOf(cand.attrs, pos))).toBe(45);
        }
      }
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
      const cand = generateCandidates(pos)[i % 3];
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
