import { describe, expect, it } from "vitest";
import { LEAGUES, createCareer, generateCandidates, romanizeName, seasonCommunity, seasonReport, type CareerSummary, type LeagueKey, type SeasonRecord } from "../index";

const fresh = (id: string, nat = "대한민국") =>
  createCareer({ name: "리포트", num: 7, nat, pos: "SG", path: "domestic" }, generateCandidates("SG")[0], id);
const season = (year: number, team: string, lg: LeagueKey, extra: Partial<SeasonRecord> = {}): SeasonRecord => ({
  year, age: year - 2011, team, lg, pro: LEAGUES[lg].pro, role: "주전", gp: 54, min: 30, pts: 15, reb: 5, ast: 4, stl: 1, blk: 0,
  fg: 45, rating: 7, w: 30, l: 24, result: "플레이오프 1라운드", ovr0: 70, ovr1: 70, awards: [], ...extra,
});
const hallOf = (id: string, name: string, pts: number): CareerSummary =>
  ({ id, name, pts, reb: 0, ast: 0, retYear: 2040 }) as CareerSummary;

describe("시즌 결산 리포트", () => {
  it("커리어 하이, 통산 이정표, 실제 역대 순위표와 명예의 전당에서 넘은 선수를 찾아요", () => {
    const c = fresh("rp1");
    // KBL 통산 9,600점에서 시즌 32점 × 54경기(1,728점)로 1만 점과 KBL 역대 득점 순위표 하위권을 넘어요.
    c.hist = [season(2030, "서울 SK 나이츠", "kbl", { pts: 9600 / 72, gp: 72 })];
    const rec = season(2032, "서울 SK 나이츠", "kbl", { pts: 32, gp: 54 });
    c.hist.push(rec);
    c.awardLog.push({ y: 2032, k: "mvp", n: "KBL MVP" }, { y: 2031, k: "allstar", n: "KBL 올스타" });
    const rp = seasonReport(c, { ...rec }, [hallOf("other", "선배", 10500), hallOf(c.id, "나 자신", 10400)]);
    expect(rp.totals?.pts).toBe(9600 + 1728);
    expect(rp.added.pts).toBe(1728);
    expect(rp.milestones).toContainEqual({ stat: "pts", at: 10000 });
    expect(rp.passedReal.some((p) => p.group === "kbl" && p.stat === "pts")).toBe(true);
    // 같은 커리어의 명예의 전당 기록은 빼요.
    expect(rp.passedHall.map((h) => h.name)).toEqual(["선배"]);
    // 이 시즌의 수상만 모아요.
    expect(rp.awards.map((a) => a.n)).toEqual(["KBL MVP"]);
  });

  it("10경기 넘게 뛴 같은 무대 시즌보다 높아야 커리어 하이예요", () => {
    const c = fresh("rp2");
    c.hist = [season(2030, "서울 SK 나이츠", "kbl", { pts: 18, reb: 9 }), season(2031, "서울 SK 나이츠", "kbl", { pts: 40, gp: 5 })];
    const rec = season(2032, "서울 SK 나이츠", "kbl", { pts: 20, reb: 6 });
    c.hist.push(rec);
    expect(seasonReport(c, rec).highs).toEqual(["pts"]);
    // 첫 시즌은 비교할 시즌이 없어서 커리어 하이를 붙이지 않아요.
    const d = fresh("rp3");
    d.hist = [rec];
    expect(seasonReport(d, rec).highs).toEqual([]);
  });

  it("아마추어 시즌은 프로 통산과 이정표를 따지지 않아요", () => {
    const c = fresh("rp4");
    const rec = season(2028, "휘문고", "hs", { pts: 30 });
    c.hist = [rec];
    const rp = seasonReport(c, rec);
    expect(rp.totals).toBeNull();
    expect(rp.milestones).toEqual([]);
    expect(rp.next).toBeNull();
  });
});

describe("커뮤니티 반응", () => {
  it("같은 시즌은 늘 같은 댓글이고, 추천 수 순서예요", () => {
    const c = fresh("cm1");
    const rec = season(2032, "보스턴 셀틱스", "nba", { pts: 24, rating: 7.8 });
    c.hist = [rec];
    const a = seasonCommunity(c, rec)!;
    const b = seasonCommunity(c, rec)!;
    expect(a).toEqual(b);
    expect(a.domestic.comments).toHaveLength(6);
    expect(a.overseas?.comments).toHaveLength(5);
    const likes = a.domestic.comments.map((x) => x.likes);
    expect([...likes].sort((p, q) => q - p)).toEqual(likes);
    for (const x of [...a.domestic.comments, ...a.overseas!.comments]) expect(x.text).not.toMatch(/[{}]/);
    // NBA 시즌은 국내 커뮤니티 한 곳과 레딧 r/nba에 올라와요. 레딧 닉네임은 u/로 시작해요.
    expect(["디시인사이드 NBA 갤러리", "에펨코리아 농구 게시판", "MLBPARK 불펜"]).toContain(a.domestic.site);
    expect(a.overseas?.site).toBe("레딧 r/nba");
    for (const x of a.overseas!.comments) expect(x.nick).toMatch(/^u\//);
  });

  it("우승·수상 같은 시즌의 일이 댓글에 나와요", () => {
    const c = fresh("cm2");
    const rec = season(2032, "보스턴 셀틱스", "nba", { pts: 30, rating: 8.6, result: "리그 우승" });
    c.hist = [rec];
    c.awardLog.push({ y: 2032, k: "mvp_nba", n: "NBA MVP" });
    const cm = seasonCommunity(c, rec)!;
    expect(cm.domestic.title).toContain("우승");
    expect(cm.domestic.comments.some((x) => /우승|반지|퍼레이드|MVP/.test(x.text))).toBe(true);
  });

  it("국내 리그의 평범한 시즌은 해외 포럼 반응이 없고, 훌륭한 시즌이면 스카우트 반응이 달려요", () => {
    const c = fresh("cm3");
    const meh = season(2032, "서울 SK 나이츠", "kbl", { rating: 6.2 });
    c.hist = [meh];
    expect(seasonCommunity(c, meh)!.overseas).toBeNull();
    const great = season(2033, "서울 SK 나이츠", "kbl", { rating: 8.4, pts: 28 });
    c.hist.push(great);
    expect(seasonCommunity(c, great)!.overseas?.site).toBe("RealGM 국제 농구 포럼");
  });

  it("해외 포럼은 영어 원문이고, 선수 이름은 영어식으로 써요", () => {
    expect(romanizeName("김농구")).toBe("Nong-gu Kim");
    expect(romanizeName("남궁민수")).toBe("Min-su Namgoong");
    expect(romanizeName("Kevin")).toBe("Kevin");
    const c = fresh("cm5");
    c.p.name = "박벤치";
    for (const [i, lg] of (["nba", "euro", "ncaa", "kbl"] as const).entries()) {
      const rec = season(2032 + i, lg === "kbl" ? "서울 SK 나이츠" : "보스턴 셀틱스", lg, { rating: 8.5, pts: 26 });
      c.hist.push(rec);
      const en = seasonCommunity(c, rec)!.overseas!;
      for (const s of [en.title, ...en.comments.map((x) => x.text)]) expect(s).not.toMatch(/[가-힣]/);
      expect(en.title + en.comments.map((x) => x.text).join(" ")).not.toContain("박벤치");
    }
  });

  it("비슷한 시즌이 이어져도 직전 시즌에 나온 제목과 댓글은 다시 쓰지 않아요", () => {
    const c = fresh("cm6");
    const texts = (b: { title: string; comments: { text: string }[] } | null) => (b ? [b.title, ...b.comments.map((x) => x.text)] : []);
    let prev: string[] = [];
    for (let y = 2032; y < 2040; y++) {
      const rec = season(y, "보스턴 셀틱스", "nba", { pts: 24, rating: 7.8 });
      c.hist.push(rec);
      const cm = seasonCommunity(c, rec)!;
      const now = [...texts(cm.domestic), ...texts(cm.overseas)];
      // 국내 커뮤니티가 시즌마다 바뀌어서 겹칠 일이 드물지만, 같은 곳이 이어져도 댓글은 겹치지 않아요.
      for (const t of now) expect(prev).not.toContain(t);
      prev = now;
    }
  });

  it("뛰지 않은 시즌에는 반응이 없어요", () => {
    const c = fresh("cm4");
    const rec = season(2032, "서울 SK 나이츠", "kbl", { gp: 0 });
    c.hist = [rec];
    expect(seasonCommunity(c, rec)).toBeNull();
  });
});
