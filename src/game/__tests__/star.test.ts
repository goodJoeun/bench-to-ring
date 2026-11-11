import { afterEach, describe, expect, it } from "vitest";
import { STAR_UNLOCKS, applyAction, createCareer, generateCandidates, resetRandom, seeded, setRandom, starTier, type Career, type SeasonRecord } from "@/game";
import { checkAchievements } from "@/game/legacy/achievements";
import { randomGrowable } from "@/game/player/condition";
import { buy } from "@/game/economy/shop";
import { describeBoost, lifeEvent } from "@/game/season/events";
import { giveAward } from "@/game/career/log";
import { parseCareer } from "@/game/career/storage";
import { START_STAR, addStar, estimateStar, seasonStar, starNeed } from "@/game/player/star";

afterEach(() => resetRandom());

function pro(id: string, star: number): Career {
  const c = createCareer({ name: "스타", num: 23, nat: "대한민국", pos: "SF", path: "domestic" }, generateCandidates("SF")[0], id);
  c.stage = "pro";
  c.team = { name: "서울 SK 나이츠", color: "#E4002B", q: 0.5, lg: "kbl" };
  c.contract = { years: 3, salary: 3 };
  c.age = 26;
  c.star = star;
  return c;
}

/** 오프시즌 생활 이벤트를 여러 해 뽑아 제목을 모아요. */
function titles(c: Career, years: number): string[] {
  const out: string[] = [];
  for (let y = 0; y < years; y++) {
    const d = lifeEvent(c);
    if (d) out.push(d.title);
    c.year++;
  }
  return out;
}

const season = (o: Partial<SeasonRecord>): SeasonRecord => ({
  year: 2030, age: 25, team: "서울 SK 나이츠", lg: "kbl", pro: true, role: "주전", gp: 54, min: 32,
  pts: 20, reb: 5, ast: 5, stl: 1, blk: 0.5, fg: 47, rating: 7.5, w: 30, l: 24, result: "4강", ovr0: 75, ovr1: 76, awards: [], ...o,
});

describe("스타성", () => {
  it("새 선수는 무명에서 시작해요", () => {
    const c = createCareer({ name: "새내기", num: 1, nat: "대한민국", pos: "PG", path: "domestic" }, generateCandidates("PG")[0], "new");
    expect(c.star).toBe(START_STAR);
    expect(starTier(c.star)).toBe("무명");
  });

  it("상을 받으면 리그의 관심만큼 오르고, NBA 상이 더 크게 올라요", () => {
    const kbl = pro("a1", 10);
    giveAward(kbl, "mvp", "KBL MVP", season({}));
    const nba = pro("a2", 10);
    nba.team = { name: "보스턴 셀틱스", color: "#007A33", q: 0.5, lg: "nba" };
    giveAward(nba, "mvp_nba", "NBA MVP", season({ lg: "nba" }));
    expect(kbl.star).toBeGreaterThan(10);
    expect(nba.star - 10).toBeGreaterThan(kbl.star - 10);
  });

  it("시즌마다 조금씩 식고, 잘 뛴 시즌은 그보다 더 올라요", () => {
    expect(seasonStar(50, season({ gp: 0, lg: null }))).toBeLessThan(0);
    expect(seasonStar(50, season({ rating: 5.8 }))).toBeLessThan(0);
    expect(seasonStar(10, season({ rating: 8.2, min: 34 }))).toBeGreaterThan(0);
    // 같은 활약이면 NBA에서 더 많이 올라요.
    expect(seasonStar(10, season({ lg: "nba", rating: 8 }))).toBeGreaterThan(seasonStar(10, season({ lg: "kbl", rating: 8 })));
  });

  it("단계에 오르거나 제안이 열리면 알려줘요. 0~100을 넘지 않아요", () => {
    const c = pro("u", 38);
    c.p.trait = "꾸준함";
    expect(addStar(c, 1)).toBeNull();
    expect(addStar(c, 2)).toMatch(/광고 모델/);
    expect(addStar(c, 500)).toMatch(/아이콘/);
    expect(c.star).toBe(100);
    addStar(c, -500);
    expect(c.star).toBe(0);
  });

  it("특성 '스타성'을 타고나면 스타성이 30% 더 빨리 올라요. 내려갈 때는 같아요", () => {
    const plain = pro("t1", 20);
    plain.p.trait = "꾸준함";
    const born = pro("t2", 20);
    born.p.trait = "스타성";
    addStar(plain, 10);
    addStar(born, 10);
    expect(born.star - 20).toBeCloseTo((plain.star - 20) * 1.3);
    addStar(plain, -5);
    addStar(born, -5);
    expect(born.star).toBeCloseTo(33 - 5);
  });

  it("선택지 효과로 스타성과 시그니처 세리머니가 보여요", () => {
    expect(describeBoost({ star: 5, celebration: "활시위 당기기" })).toBe("스타성 +5 · 시그니처 세리머니 '활시위 당기기'");
    const c = pro("b", 20);
    c.p.trait = "꾸준함";
    applyAction(c, { k: "boost", star: 5, celebration: "활시위 당기기", msg: "세리머니가 생겼어요." });
    expect(c.star).toBe(25);
    expect(c.perks.celebration).toBe("활시위 당기기");
  });

  it("광고·유니폼 수익·시그니처 농구화 제안은 스타성이 모자라면 오지 않아요", () => {
    setRandom(seeded(11));
    const low = titles(pro("low", starNeed("ad") - 1), 300);
    expect(low).not.toContain("광고 모델 제안");
    expect(low).not.toContain("유니폼 판매 수익 배분");
    expect(low).not.toContain("시그니처 농구화 제안");
    expect(low).toContain("예능 출연 제안");

    setRandom(seeded(12));
    const high = titles(pro("high", 80), 300);
    for (const t of ["예능 출연 제안", "광고 모델 제안", "유니폼 판매 수익 배분", "시그니처 농구화 제안"]) expect(high).toContain(t);
  });

  it("스타성을 키우는 이벤트(인터뷰, 미담, 팬 사인회)는 스타성이 낮아도 와요", () => {
    setRandom(seeded(13));
    const got = titles(pro("fan", 0), 300);
    for (const t of ["시즌 전 인터뷰", "팬들에게 들려온 미담", "팬 사인회"]) expect(got).toContain(t);
  });

  it("제안이 열리는 수치는 낮은 것부터 차례로 올라가요", () => {
    const mins = STAR_UNLOCKS.map((u) => u.min);
    expect([...mins].sort((a, b) => a - b)).toEqual(mins);
  });

  it("스타성이 생기기 전의 저장은 상과 기록으로 어림해요", () => {
    const c = pro("old", 0);
    c.hist = [season({ year: 2029, rating: 7.8 }), season({ year: 2030, rating: 8.4, awards: ["KBL MVP"] })];
    c.awardLog = [{ y: 2030, k: "mvp", n: "KBL MVP" }];
    const raw = JSON.parse(JSON.stringify(c)) as Record<string, unknown>;
    delete raw.star;
    const loaded = parseCareer(JSON.stringify(raw))!;
    expect(loaded.star).toBe(estimateStar(c));
    expect(loaded.star).toBeGreaterThan(START_STAR);
  });

  it("스타성 업적: 문턱에 닿으면 떠오르는 별·슈퍼스타·아이콘을, 세리머니와 농구화로도 따요", () => {
    const c = pro("achv", 29);
    checkAchievements(c);
    expect(c.achv).not.toContain("star_rising");
    c.star = 76;
    checkAchievements(c);
    expect(c.achv).toEqual(expect.arrayContaining(["star_rising", "superstar"]));
    expect(c.achv).not.toContain("star_icon");
    c.star = 90;
    c.perks.celebration = "쉿! 손가락";
    c.milestones.push("shoe");
    checkAchievements(c);
    expect(c.achv).toEqual(expect.arrayContaining(["star_icon", "signature_cele", "signature_shoe"]));
  });

  it("시그니처 농구화 제안은 어느 쪽을 골라도 농구화가 나와요", () => {
    setRandom(seeded(21));
    const c = pro("shoe", 80);
    let d = lifeEvent(c);
    for (let i = 0; i < 300 && d?.title !== "시그니처 농구화 제안"; i++) {
      c.events = {};
      d = lifeEvent(c);
    }
    expect(d?.title).toBe("시그니처 농구화 제안");
    for (const o of d!.opts) expect(o.act.k === "boost" && o.act.mark).toBe("shoe");
  });
});

describe("무작위 능력치 +1", () => {
  it("이미 99인 능력치는 고르지 않아요", () => {
    setRandom(seeded(3));
    const c = pro("max", 10);
    c.p.attrs = { sht: 99, hdl: 99, pas: 99, def: 99, iq: 70, ath: 98.6 };
    for (let i = 0; i < 30; i++) expect(randomGrowable(c.p.attrs, 2)).toEqual(["iq"]);
    applyAction(c, { k: "boost", rand: 2, amt: 1, msg: "캠프를 마쳤어요." });
    expect(c.p.attrs).toMatchObject({ sht: 99, hdl: 99, pas: 99, def: 99, iq: 71 });
    expect(c.news[0].m).toBe("캠프를 마쳤어요. BQ +1");
  });

  it("모든 능력치가 99면 무작위 능력치 상품은 살 수 없어요", () => {
    const c = pro("shop", 10);
    c.p.attrs = { sht: 99, hdl: 99, pas: 99, def: 99, iq: 99, ath: 99 };
    c.earnings = 100;
    c.shop = { year: c.year, keys: ["bootcamp"], bought: [] };
    expect(buy(c, "bootcamp")).toBe(false);
    c.p.attrs.iq = 80;
    expect(buy(c, "bootcamp")).toBe(true);
    expect(c.p.attrs.iq).toBe(81);
  });
});
