import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ARCHETYPES,
  NATIONS,
  POS_KEYS,
  START_OVR,
  chooseOption,
  createCareer,
  currentDecision,
  dailyChallenge,
  hsSchools,
  ovrOf,
  resetRandom,
  seeded,
  setRandom,
  simulateSeason,
} from "@/game";
import { random } from "../core/random";

afterEach(() => resetRandom());

const DAYS = Array.from({ length: 30 }, (_, i) => `2026-11-${String(i + 1).padStart(2, "0")}`);

describe("챌린지 선수", () => {
  it("날짜와 포지션이 같으면 새로 불러와도 같은 선수예요", async () => {
    const before = POS_KEYS.map((p) => structuredClone(dailyChallenge("2026-11-20", p)));
    // 모듈을 새로 불러와(기억해 둔 값 없이) 다른 난수 상태에서 다시 뽑아도 같아야 해요.
    vi.resetModules();
    const fresh = await import("@/game");
    fresh.setRandom(fresh.seeded(99));
    expect(POS_KEYS.map((p) => fresh.dailyChallenge("2026-11-20", p))).toEqual(before);
    fresh.resetRandom();
  });

  it("게임 난수 흐름을 건드리지 않아요", () => {
    setRandom(seeded(7));
    const plain = [random(), random(), random()];
    setRandom(seeded(7));
    const first = random();
    dailyChallenge("2031-01-02", "C");
    expect([first, random(), random()]).toEqual(plain);
  });

  it("오버롤 45에 그 포지션의 플레이 유형, 국적에 맞는 학교로 나와요", () => {
    for (const day of DAYS)
      for (const pos of POS_KEYS) {
        const c = dailyChallenge(day, pos);
        expect(c).toMatchObject({ day, pos });
        expect(Math.round(ovrOf(c.cand.attrs, pos))).toBe(START_OVR);
        expect(ARCHETYPES[pos].map((a) => a.name)).toContain(c.cand.arch);
        expect(NATIONS.map((n) => n.name)).toContain(c.nat);
        expect(hsSchools(c.nat).map(([name]) => name)).toContain(c.school);
      }
  });

  it("날짜와 포지션에 따라 선수가 달라져요", () => {
    const pg = DAYS.map((d) => dailyChallenge(d, "PG"));
    expect(new Set(pg.map((c) => JSON.stringify(c.cand))).size).toBe(DAYS.length);
    expect(new Set(pg.map((c) => c.cand.arch)).size).toBeGreaterThan(1);
    expect(new Set(pg.map((c) => c.nat)).size).toBeGreaterThan(1);
    // 한 달이면 대한민국과 다른 나라가 모두 나와요.
    const all = DAYS.flatMap((d) => POS_KEYS.map((p) => dailyChallenge(d, p).nat));
    const home = all.filter((n) => n === "대한민국").length;
    expect(home).toBeGreaterThan(all.length * 0.3);
    expect(home).toBeLessThan(all.length * 0.7);
  });

  it("챌린지로 시작한 커리어는 은퇴 요약까지 날짜와 시작 포지션이 남아요", () => {
    const rand = seeded(11);
    setRandom(rand);
    const spec = dailyChallenge("2026-11-20", "SF");
    const c = createCareer(
      { name: "챌린저", num: 7, nat: spec.nat, pos: spec.pos, path: "domestic", school: spec.school, challenge: { day: spec.day, pos: spec.pos } },
      spec.cand,
      "ch1",
    );
    expect(c.challenge).toEqual({ day: "2026-11-20", pos: "SF" });
    expect(c.p.nat).toBe(spec.nat);
    expect(c.team?.name).toBe(spec.school);
    // 커리어가 능력치를 키워도 함께 쓰는 챌린지 선수는 그대로예요.
    const attrs = { ...spec.cand.attrs };
    for (let s = 0; c.stage !== "retired" && s < 300; s++) {
      if (c.queue.length) chooseOption(c, Math.floor(rand() * currentDecision(c)!.opts.length));
      else simulateSeason(c);
    }
    expect(c.summary?.challenge).toEqual({ day: "2026-11-20", pos: "SF" });
    expect(dailyChallenge("2026-11-20", "SF").cand.attrs).toEqual(attrs);
    // 일반 커리어에는 표시가 없어요.
    const plain = createCareer({ name: "일반", num: 1, pos: "SF", path: "domestic" }, spec.cand, "n1");
    expect(plain.challenge).toBeUndefined();
  });
});
