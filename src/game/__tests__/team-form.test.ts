import { afterEach, describe, expect, it } from "vitest";
import { joinTeam, makeTeam } from "../career/log";
import type { Career, LeagueKey, SeasonRecord } from "../core/types";
import { resetRandom, seeded, setRandom } from "../core/random";
import { chooseOption, createCareer, currentDecision, formFloor, formLines, generateCandidate, scoutTeam, seasonStandings, startSeason, stepSeason, teamForm } from "../index";
import { nbaConference } from "../world/awards";
import { LEAGUES, TEAMS } from "../world/leagues";
import { PLAYOFF_SPOTS } from "../world/standings";
import { weakTeamLift } from "../world/team-form";

afterEach(() => resetRandom());

function pro(id: string, year = 2031): Career {
  setRandom(seeded(7));
  const cand = generateCandidate("PG", 0);
  const c = createCareer({ name: "t", num: 1, nat: "미국", pos: "PG", path: "abroad" }, cand, id);
  c.queue = [];
  c.year = year;
  c.age = 26;
  c.hist = [];
  c.stage = "pro";
  c.contract = { years: 2, salary: 10 } as Career["contract"];
  return c;
}

const played = (over: Partial<SeasonRecord>) => ({ year: 2030, lg: "nba", gp: 82, w: 55, l: 27, result: "", ...over }) as SeasonRecord;
const formsOf = (c: Career, lg: LeagueKey) => TEAMS[lg].map(([name]) => ({ name, f: teamForm(c, lg, name)! }));
const exitOf = (c: Career, lg: LeagueKey, name: string) => teamForm(c, lg, name)!.exit;

/** 시즌을 끝까지 돌려요. 결정은 첫 번째 선택지를 골라요. */
function playSeason(c: Career): SeasonRecord {
  startSeason(c);
  while (c.run) {
    if (currentDecision(c)) chooseOption(c, 0);
    else stepSeason(c);
  }
  return c.hist.at(-1)!;
}

describe("팀의 직전 시즌 성적", () => {
  const proLeagues = (Object.keys(PLAYOFF_SPOTS) as LeagueKey[]).filter((lg) => LEAGUES[lg].pro);

  it("리그마다 라운드별로 떨어진 팀 수가 맞아요", () => {
    for (const lg of proLeagues)
      for (let i = 0; i < 12; i++) {
        const forms = formsOf(pro(`count-${lg}-${i}`), lg).map((x) => x.f);
        const n = (e: number) => forms.filter((f) => f.exit === e).length;
        const spots = lg === "nba" ? 16 : PLAYOFF_SPOTS[lg]!;
        const final = lg === "nba" ? 4 : 3;
        expect(n(-1), lg).toBe(forms.length - spots);
        expect(n(final), `${lg} 우승`).toBe(1);
        expect(n(final - 1), `${lg} 준우승`).toBe(1);
        expect(n(final - 2), `${lg} 4강`).toBe(2);
        if (lg === "kbl") expect(n(0)).toBe(2);
        else if (lg === "nba") expect([n(0), n(1)]).toEqual([8, 4]);
        else expect(n(0)).toBe(4);
        // 플레이오프에 오른 팀은 진출선 안, 못 오른 팀은 밖이에요.
        const cut = PLAYOFF_SPOTS[lg]!;
        for (const f of forms) expect(f.exit >= 0, `${lg} ${f.rank}위`).toBe(f.rank <= cut);
      }
  });

  it("같은 커리어와 연도면 늘 같고, 게임 난수를 쓰지 않아요", () => {
    const c = pro("same");
    const first = teamForm(c, "nba", TEAMS.nba[3][0]);
    setRandom(() => {
      throw new Error("게임 난수를 쓰면 안 돼요");
    });
    expect(teamForm(c, "nba", TEAMS.nba[3][0])).toEqual(first);
  });

  it("내가 뛴 시즌의 플레이오프와 어긋나지 않아요", () => {
    const west = TEAMS.nba.map(([n]) => n).filter((n) => nbaConference(n) === "서부");
    const east = TEAMS.nba.map(([n]) => n).filter((n) => nbaConference(n) === "동부");
    const [me, a, b, d] = west;
    const champ = pro("champ");
    champ.hist = [played({ team: me, result: "리그 우승", opps: [a, b, d, east[0]] })];
    expect([me, a, b, d, east[0]].map((t) => exitOf(champ, "nba", t))).toEqual([4, 0, 1, 2, 3]);

    const lost = pro("lost");
    lost.hist = [played({ team: me, result: "컨퍼런스 세미파이널", opps: [a, b] })];
    expect(exitOf(lost, "nba", me)).toBe(1);
    expect(exitOf(lost, "nba", a)).toBe(0);
    expect(exitOf(lost, "nba", b)).toBeGreaterThanOrEqual(2);

    const runnerUp = pro("runner");
    runnerUp.hist = [played({ team: me, result: "파이널 준우승", opps: [a, b, d, east[0]] })];
    expect(exitOf(runnerUp, "nba", east[0])).toBe(4);
    const row = seasonStandings(runnerUp, runnerUp.hist[0])!.tables[0].rows.find((r) => r.team === me)!;
    expect(teamForm(runnerUp, "nba", me)).toMatchObject({ rank: row.rank, w: row.w, l: row.l, result: "파이널 준우승" });
  });

  it("KBL 4강 직행 팀은 6강에서 떨어지지 않아요", () => {
    for (let i = 0; i < 30; i++) {
      const forms = formsOf(pro(`kbl-${i}`), "kbl").map((x) => x.f);
      for (const f of forms) if (f.rank <= 2) expect(f.exit).toBeGreaterThanOrEqual(1);
    }
  });

  it("정규시즌과 플레이오프를 한 줄씩 보여줘요", () => {
    const f = { year: 2030, group: "서부 컨퍼런스", rank: 2, w: 58, l: 24, result: "플레이오프 1라운드", exit: 0 };
    expect(formLines(f)).toEqual({ regular: "서부 2위 · 58승 24패", playoff: "1라운드" });
    expect(formLines({ ...f, group: "KBL", result: "6강 플레이오프" })).toEqual({ regular: "2위 · 58승 24패", playoff: "6강" });
    expect(formLines({ ...f, result: "리그 우승" }).playoff).toBe("우승");
    expect(formLines({ ...f, result: "파이널 준우승" }).playoff).toBe("준우승");
    expect(formLines({ ...f, result: "플레이오프 진출 실패" }).playoff).toBe("진출 실패");
  });
});

describe("이적 첫 시즌", () => {
  const find = (c: Career, want: (exit: number) => boolean) => TEAMS.nba.find(([n]) => want(exitOf(c, "nba", n)))!;

  it("전력은 직전 성적을 따라가요", () => {
    const c = pro("quality");
    const q = (exit: number) => scoutTeam(c, "nba", makeTeam(find(c, (e) => e === exit))).q;
    expect(q(4)).toBeGreaterThan(q(-1));
  });

  it("우승 팀으로 옮기면 적어도 결승까지 가요", () => {
    for (let i = 0; i < 25; i++) {
      const c = pro(`repeat-${i}`);
      joinTeam(c, "nba", scoutTeam(c, "nba", makeTeam(find(c, (e) => e === 4))));
      setRandom(seeded(500 + i));
      const h = playSeason(c);
      expect(["리그 우승", "파이널 준우승"]).toContain(h.result);
      expect(seasonStandings(c, h)!.rank).toBeLessThanOrEqual(8);
    }
  });

  it("옮긴 첫 시즌 기록에 그 팀의 직전 성적이 남고, 묶음마다 최하위는 한 팀이에요", () => {
    const c = pro("joined");
    const forms = formsOf(c, "nba");
    expect(forms.filter((x) => x.f.last).length).toBe(2);
    expect(formsOf(c, "kbl").filter((x) => x.f.last).length).toBe(1);
    const worst = forms.find((x) => x.f.last)!;
    joinTeam(c, "nba", scoutTeam(c, "nba", makeTeam(TEAMS.nba.find(([n]) => n === worst.name)!)));
    setRandom(seeded(21));
    expect(playSeason(c).joined).toEqual({ exit: -1, last: true });
  });

  it("하한은 옮긴 첫 시즌에만 있고, 재계약에는 없어요", () => {
    const c = pro("once");
    const champion = find(c, (e) => e === 4);
    const t = scoutTeam(c, "nba", makeTeam(champion));
    joinTeam(c, "nba", t);
    expect(formFloor(c.team!, c.year).rounds).toBe(4);
    expect(formFloor(c.team!, c.year + 1).rounds).toBe(0);

    const q = c.team!.q;
    const again = scoutTeam(c, "nba", { ...t, q });
    expect(again.q).toBe(q);
    joinTeam(c, "nba", again);
    expect(c.team!.form).toBeUndefined();
  });
});

describe("약팀 에이스", () => {
  it("팀이 약할수록, 선수 기여가 클수록 더 끌어올려요", () => {
    expect(weakTeamLift(0.4, 0.1)).toBeGreaterThan(0);
    expect(weakTeamLift(0.3, 0.1)).toBeGreaterThan(weakTeamLift(0.4, 0.1));
    expect(weakTeamLift(0.3, 0.1)).toBeGreaterThan(weakTeamLift(0.3, 0.05));
  });

  it("평균 이상 팀과 평균 이하 선수에게는 보정이 없어요", () => {
    expect(weakTeamLift(0.5, 0.1)).toBe(0);
    expect(weakTeamLift(0.7, 0.1)).toBe(0);
    expect(weakTeamLift(0.2, 0)).toBe(0);
    expect(weakTeamLift(0.2, -0.05)).toBe(0);
  });

  it("보정에는 상한이 있어요", () => {
    expect(weakTeamLift(0.2, 0.4)).toBeCloseTo(weakTeamLift(0.2, 0.15));
    expect(weakTeamLift(0.2, 0.15)).toBeCloseTo(weakTeamLift(0.25, 0.15));
  });

  it("약팀에서 뛰는 시즌에만 보정이 남아요", () => {
    const liftAt = (worst: boolean) => {
      const c = pro("lift-run");
      for (const k of Object.keys(c.p.attrs) as (keyof typeof c.p.attrs)[]) c.p.attrs[k] = 99;
      const rows = TEAMS.nba.map((t) => ({ t, f: teamForm(c, "nba", t[0])! })).sort((a, b) => a.f.w - b.f.w);
      joinTeam(c, "nba", scoutTeam(c, "nba", makeTeam((worst ? rows[0] : rows.at(-1)!).t)));
      setRandom(seeded(11));
      startSeason(c);
      return c.run!.lift;
    };
    expect(liftAt(true)).toBeGreaterThan(0);
    expect(liftAt(false)).toBe(0);
  });

  it("최약체로 간 슈퍼스타는 평균 선수보다 훨씬 많이 이겨요", () => {
    const winsAt = (gap: number) => {
      let total = 0;
      for (let i = 0; i < 40; i++) {
        const c = pro(`carry-${gap}-${i}`);
        for (const k of Object.keys(c.p.attrs) as (keyof typeof c.p.attrs)[]) c.p.attrs[k] = LEAGUES.nba.avg + gap;
        const worst = TEAMS.nba.map((t) => ({ t, f: teamForm(c, "nba", t[0])! })).sort((a, b) => a.f.w - b.f.w)[0];
        joinTeam(c, "nba", scoutTeam(c, "nba", makeTeam(worst.t)));
        setRandom(seeded(800 + i));
        total += playSeason(c).w;
      }
      return total / 40;
    };
    expect(winsAt(12) - winsAt(0)).toBeGreaterThan(14);
  });
});
