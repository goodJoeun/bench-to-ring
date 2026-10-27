import { afterEach, describe, expect, it } from "vitest";
import {
  ARCHETYPES,
  POS_KEYS,
  chooseOption,
  createCareer,
  currentDecision,
  generateCandidate,
  resetRandom,
  seeded,
  setRandom,
  simulateSeason,
  titleHistory,
  type Career,
} from "@/game";
import { cardData } from "@/components/retired/careerCard";

afterEach(() => resetRandom());

function retired(n: number): Career[] {
  const rand = seeded(77);
  setRandom(rand);
  const out: Career[] = [];
  for (let i = 0; i < n; i++) {
    const pos = POS_KEYS[i % POS_KEYS.length];
    const c = createCareer({ name: `선수${i}`, num: i, nat: "대한민국", pos, path: "domestic" }, generateCandidate(pos, i % ARCHETYPES[pos].length), `c${i}`);
    for (let s = 0; c.stage !== "retired" && s < 300; s++) {
      if (c.queue.length) chooseOption(c, Math.floor(rand() * currentDecision(c)!.opts.length));
      else simulateSeason(c);
    }
    out.push(c);
  }
  return out;
}

describe("기록 카드", () => {
  const careers = retired(30);

  it("트로피·상·팀은 정한 수까지만 넣고, 넘친 트로피 수를 세어요", () => {
    for (const c of careers) {
      const d = cardData(c);
      expect(d.trophies.length + d.moreTrophies).toBe(titleHistory(c).length);
      expect(d.trophies.length).toBeLessThanOrEqual(12);
      expect(d.pills.length).toBeLessThanOrEqual(4);
      expect(d.teams.length).toBeLessThanOrEqual(5);
      // 팀은 처음 뛴 순서대로, 군 팀은 빼요.
      const order = c.hist.map((h) => h.team);
      expect(d.teams.map((t) => order.indexOf(t.name))).toEqual([...d.teams.map((t) => order.indexOf(t.name))].sort((a, b) => a - b));
      expect(d.teams.some((t) => c.hist.some((h) => h.team === t.name && h.mil))).toBe(false);
    }
  });

  it("NBA 우승은 금 트로피로 맨 앞에 와요", () => {
    const c = careers.find((x) => titleHistory(x).some((t) => t.name.startsWith("NBA")));
    if (!c) return;
    const d = cardData(c);
    const nba = titleHistory(c).filter((t) => t.name.startsWith("NBA")).length;
    expect(d.trophies.slice(0, Math.min(nba, 12))).toEqual(Array(Math.min(nba, 12)).fill("nba"));
  });
});
