import { afterEach, describe, expect, it } from "vitest";
import {
  ARCHETYPES,
  POS_KEYS,
  RULESET_VERSION,
  chooseOption,
  createCareer,
  currentDecision,
  generateCandidate,
  resetRandom,
  seeded,
  setRandom,
  simulateSeason,
  type Career,
  type CareerSummary,
} from "@/game";
import { HIDDEN_NAME, checkSummary, cleanName } from "@/server/validate";

afterEach(() => resetRandom());

function retiredSummaries(n: number): CareerSummary[] {
  const rand = seeded(404);
  setRandom(rand);
  const out: CareerSummary[] = [];
  for (let i = 0; i < n; i++) {
    const pos = POS_KEYS[i % POS_KEYS.length];
    const c: Career = createCareer(
      { name: `선수${i}`, num: i % 100, nat: "대한민국", pos, path: "domestic" },
      generateCandidate(pos, i % ARCHETYPES[pos].length),
      `v${i}`,
    );
    for (let s = 0; c.stage !== "retired" && s < 300; s++) {
      if (c.queue.length) chooseOption(c, Math.floor(rand() * currentDecision(c)!.opts.length));
      else simulateSeason(c);
    }
    out.push(c.summary!);
  }
  return out;
}

describe("은퇴 기록 검사", () => {
  const summaries = retiredSummaries(60);

  it("엔진이 만든 은퇴 기록은 모두 통과하고, 지금 룰셋이 적혀 있어요", () => {
    for (const s of summaries) {
      expect(s.ruleset).toBe(RULESET_VERSION);
      const r = checkSummary(JSON.parse(JSON.stringify(s)));
      expect(r, s.name).toMatchObject({ ok: true });
    }
  });

  // 범위 안에서 조금 고친 값(최고 오버롤 +1 등)은 여기서 못 막아요. 2단계 재생 검증이 맡아요.
  it("엔진이 낼 수 없는 값은 막아요", () => {
    const s = summaries.find((x) => x.seasons >= 5)!;
    const bad: Partial<CareerSummary>[] = [
      { mvp: s.mvp + 1 },
      { awards: { ...s.awards, mvp_nba: (s.awards.mvp_nba ?? 0) + 1 }, mvp: s.mvp + 1 },
      { peak: 120 },
      { pts: s.gp * 100 },
      { retAge: 25 },
      { retYear: s.retYear + 5 },
      { legacy: "역대 최고 논쟁의 주인공" },
      { ruleset: 0 },
      { ruleset: undefined },
      { pos: "G" as never },
    ];
    for (const patch of bad) expect(checkSummary({ ...s, ...patch }), JSON.stringify(patch)).toMatchObject({ ok: false });
    expect(checkSummary("기록")).toMatchObject({ ok: false });
  });

  it("모르는 칸은 버려요", () => {
    const r = checkSummary({ ...summaries[0], verified: true, admin: 1 });
    expect(r.ok && Object.keys(r.summary)).not.toContain("verified");
  });
});

describe("선수 이름 필터", () => {
  it("욕설이 들어간 이름은 바꾸고, 띄어쓰기나 숫자로 끊어도 찾아요", () => {
    expect(cleanName("벤치의 왕")).toBe("벤치의 왕");
    expect(cleanName("Kobe")).toBe("Kobe");
    expect(cleanName("씨발")).toBe(HIDDEN_NAME);
    expect(cleanName("씨 1 발 놈")).toBe(HIDDEN_NAME);
    expect(cleanName("F.u.c.k")).toBe(HIDDEN_NAME);
  });
});
