import { afterEach, describe, expect, it } from "vitest";
import {
  BYE_SPOTS,
  LEAGUES,
  PLAYOFF_SPOTS,
  TEAMS,
  chooseOption,
  createCareer,
  currentDecision,
  generateCandidates,
  leagueTeams,
  resetRandom,
  seasonStandings,
  seeded,
  setRandom,
  simulateSeason,
  type Career,
  type LeagueKey,
  type SeasonRecord,
  type SeasonStandings,
} from "@/game";
import { nbaConference } from "@/game/world/awards";

afterEach(() => resetRandom());

const PLAYER = { p: { nat: "대한민국" } } as Pick<Career, "id" | "p">;
const who = (id: string) => ({ ...PLAYER, id }) as Pick<Career, "id" | "p">;

function season(lg: LeagueKey, patch: Partial<SeasonRecord>): SeasonRecord {
  const games = LEAGUES[lg].games;
  const w = patch.w ?? Math.round(games / 2);
  return {
    year: 2030, age: 25, team: TEAMS[lg][0][0], lg, pro: LEAGUES[lg].pro, role: "주전", gp: games, min: 30,
    pts: 15, reb: 5, ast: 4, stl: 1, blk: 0.5, fg: 45, rating: 6.5, w, l: games - w,
    result: "플레이오프 진출 실패", ovr0: 70, ovr1: 71, awards: [],
    ...patch,
  };
}

/** 어느 순위표든 지켜야 하는 것: 내 승패 그대로, 승수 순, 팀마다 한 번씩, 리그 전체 승패가 같음, 플레이오프 상대는 진출선 안 */
function checkTable(st: SeasonStandings, rec: SeasonRecord, nat = "대한민국") {
  const games = rec.w + rec.l;
  const rows = st.tables.flatMap((t) => t.rows);
  const teams = leagueTeams(rec.lg!, nat).map(([n]) => n);
  expect(new Set(rows.map((r) => r.team)).size).toBe(rows.length);
  expect(rows.map((r) => r.team).sort()).toEqual([...teams].sort());
  expect(rows.reduce((a, r) => a + r.w, 0)).toBe(rows.reduce((a, r) => a + r.l, 0));
  const me = st.tables[0].rows.find((r) => r.me)!;
  expect(me.team).toBe(rec.team);
  expect([me.w, me.l]).toEqual([rec.w, rec.l]);
  expect(me.rank).toBe(st.rank);
  for (const t of st.tables) {
    t.rows.forEach((r, i) => {
      expect(r.rank).toBe(i + 1);
      expect(r.w + r.l).toBe(games);
      expect(r.w).toBeGreaterThanOrEqual(0);
      if (i) expect(r.w).toBeLessThanOrEqual(t.rows[i - 1].w);
      expect(r.gb).toBe(t.rows[0].w - r.w);
    });
    if (t.cut) for (const r of t.rows) if (r.met) expect(r.rank, `${r.team} ${t.name}`).toBeLessThanOrEqual(t.cut);
  }
  for (const o of rec.opps ?? []) expect(rows.find((r) => r.team === o)?.met).toBeDefined();
}

describe("시즌 순위표", () => {
  it("같은 커리어·같은 시즌이면 언제 열어도 같은 순위표예요", () => {
    const rec = season("kbl", { w: 33, result: "6강 플레이오프", opps: [TEAMS.kbl[3][0]] });
    expect(seasonStandings(who("a"), rec)).toEqual(seasonStandings(who("a"), rec));
    expect(seasonStandings(who("a"), rec)).not.toEqual(seasonStandings(who("b"), rec));
  });

  it("팀 경기가 없는 시즌(무소속·군 복무)은 순위표가 없어요", () => {
    expect(seasonStandings(who("a"), season("kbl", { lg: null, w: 0, l: 0, result: "개인 훈련" }))).toBeNull();
    expect(seasonStandings(who("a"), season("kbl", { lg: null, mil: "sangmu", result: "D리그 우승" }))).toBeNull();
  });

  it("플레이오프 진출 여부와 KBL 4강 직행이 순위와 맞아요", () => {
    for (let i = 0; i < 300; i++) {
      const id = `pro-${i}`;
      for (const lg of ["kbl", "euro", "gleague", "nba"] as const) {
        const games = LEAGUES[lg].games;
        const cut = PLAYOFF_SPOTS[lg]!;
        // 진출 실패는 승률이 높아도, 진출은 승률이 낮아도 순위가 결과를 따라가요.
        const out = season(lg, { w: Math.round(games * (0.3 + (i % 10) * 0.03)) });
        const so = seasonStandings(who(id), out)!;
        checkTable(so, out);
        expect(so.rank).toBeGreaterThan(cut);

        const rivals = TEAMS[lg].map(([n]) => n).filter((n) => n !== out.team && (lg !== "nba" || nbaConference(n) === nbaConference(out.team)));
        const other = TEAMS[lg].map(([n]) => n).find((n) => lg === "nba" && nbaConference(n) !== nbaConference(out.team)) ?? rivals[4];
        const champ = season(lg, {
          w: Math.round(games * (0.45 + (i % 10) * 0.04)),
          result: "리그 우승",
          opps: lg === "nba" ? [rivals[0], rivals[1], rivals[2], other] : lg === "kbl" ? [rivals[0], rivals[1], rivals[2]] : [rivals[0], rivals[1], rivals[2]],
          final: { opp: lg === "nba" ? other : rivals[2], us: 90, them: 85, win: true },
        });
        const sc = seasonStandings(who(id), champ)!;
        checkTable(sc, champ);
        expect(sc.rank).toBeLessThanOrEqual(cut);
        if (lg === "kbl") expect(sc.rank).toBeGreaterThan(BYE_SPOTS.kbl!);
      }
      // KBL 4강 직행: 치른 라운드가 성적까지의 라운드보다 하나 적어요.
      const bye = season("kbl", { w: 25 + (i % 20), result: "챔피언결정전 준우승", opps: [TEAMS.kbl[4][0], TEAMS.kbl[5][0]], final: { opp: TEAMS.kbl[5][0], us: 80, them: 82, win: false } });
      const sb = seasonStandings(who(id), bye)!;
      checkTable(sb, bye);
      expect(sb.rank).toBeLessThanOrEqual(2);
      expect(sb.tables[0].rows.find((r) => r.team === TEAMS.kbl[5][0])?.met).toBe("final");
    }
  });

  it("NBA는 내 컨퍼런스 표가 먼저이고, 두 컨퍼런스에 15팀씩이에요", () => {
    const west = TEAMS.nba.map(([n]) => n).find((n) => nbaConference(n) === "서부")!;
    const st = seasonStandings(who("nba"), season("nba", { team: west, w: 50, result: "컨퍼런스 세미파이널" }))!;
    expect(st.tables.map((t) => t.name)).toEqual(["서부 컨퍼런스", "동부 컨퍼런스"]);
    for (const t of st.tables) {
      expect(t.rows).toHaveLength(15);
      expect(t.rows.every((r) => nbaConference(r.team) === t.name.slice(0, 2))).toBe(true);
    }
  });

  it("아마추어는 진출선이 없고, 국적의 고교끼리 순위를 매겨요", () => {
    const school = leagueTeams("hs", "일본")[2][0];
    const rec = season("hs", { team: school, w: 15, result: "전국대회 예선 탈락" });
    const st = seasonStandings({ id: "jp", p: { nat: "일본" } } as Pick<Career, "id" | "p">, rec)!;
    checkTable(st, rec, "일본");
    expect(st.tables[0].cut).toBe(0);
  });

  it("실제로 치른 시즌들도 순위표가 시즌 결과와 맞고, NBA 플레이오프 상대는 컨퍼런스를 따라요", () => {
    const seen = new Set<LeagueKey>();
    for (let k = 0; k < 24; k++) {
      setRandom(seeded(500 + k));
      const pickRand = seeded(900 + k);
      const pos = (["PG", "SG", "SF", "PF", "C"] as const)[k % 5];
      const c = createCareer({ name: `순위${k}`, num: k, nat: "대한민국", pos, path: k % 2 ? "abroad" : "domestic" }, generateCandidates(pos)[0], `st-${k}`);
      for (let steps = 0; c.stage !== "retired" && steps < 200; steps++) {
        const d = currentDecision(c);
        if (c.queue.length) chooseOption(c, Math.floor(pickRand() * d!.opts.length));
        else simulateSeason(c);
      }
      for (const rec of c.hist) {
        const st = seasonStandings(c, rec);
        if (!rec.lg || rec.mil) {
          expect(st).toBeNull();
          continue;
        }
        seen.add(rec.lg);
        checkTable(st!, rec, c.p.nat);
        const cut = PLAYOFF_SPOTS[rec.lg];
        if (cut) expect(st!.rank <= cut).toBe(rec.result !== "플레이오프 진출 실패");
        if (rec.lg === "nba" && rec.opps)
          rec.opps.forEach((o, i) => {
            const isFinal = rec.result === "리그 우승" || rec.result === "파이널 준우승" ? i === rec.opps!.length - 1 : false;
            expect(nbaConference(o) === nbaConference(rec.team)).toBe(!isFinal);
          });
      }
    }
    expect(seen.size).toBeGreaterThanOrEqual(3);
  });
});
