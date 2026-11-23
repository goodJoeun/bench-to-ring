import type { Career, LeagueKey, SeasonRecord, Team, TeamForm } from "../core/types";
import { seededPick } from "../core/random";
import { clamp } from "../core/util";
import { LEAGUES, leagueTeams } from "./leagues";
import { playoffRounds } from "./playoffs";
import { BYE_SPOTS, seasonStandings, type SeasonStandings } from "./standings";

/*
 * 이적 시장에서 보여주는 팀의 직전 시즌 성적.
 * 다른 팀 성적은 저장하지 않고, 커리어 id와 연도로 정하는 난수로 그때마다 똑같이 만들어요(게임 난수 흐름은 건드리지 않아요).
 * 내가 뛴 리그는 시즌 결산의 순위표(seasonStandings)와 내가 치른 플레이오프에 맞춰요.
 */

const MISSED = "플레이오프 진출 실패";
const CHAMPION = "리그 우승";
/** 직전 승률이 다음 시즌 전력으로 이어지는 비율. 나머지는 평균(0.5)으로 돌아가요. 전력의 퍼짐은 예전 무작위 제안(0.32~0.68)과 비슷해요. */
const FORM_CARRY = 0.7;
/** 플레이오프 2라운드 이상 간 팀은 이적 첫 시즌 승률이 직전 시즌보다 이만큼 넘게 떨어지지 않아요. */
const FORM_DROP = 0.08;
/** 시드가 낮을수록(숫자가 클수록) 플레이오프에서 먼저 떨어지기 쉬운 정도 */
const UPSET = 1.5;
/** 약팀 에이스: 팀 전력이 평균(0.5)보다 이만큼 낮으면 보정이 가득 차요. */
const CARRY_RANGE = 0.2;
/** 약팀 에이스: 보정이 가득 찼을 때 선수 기여에 더하는 비율 */
const CARRY_RATE = 0.8;
/** 약팀 에이스: 보정을 계산할 때 쓰는 선수 기여의 상한. 평균이 낮은 리그에서 승률이 치솟지 않게 막아요. */
const CARRY_CONTRIB = 0.15;

type TeamRow = SeasonStandings["tables"][number]["rows"][number];

/** 내가 뛰지 않은 리그의 순위표: 기준 팀 하나를 뽑아 결산 순위표와 같은 방법으로 만들어요. */
function otherLeague(c: Pick<Career, "id" | "p">, lg: LeagueKey, year: number): SeasonStandings | null {
  const rand = seededPick(`${c.id}:${year}:${lg}:form`);
  const list = leagueTeams(lg, c.p.nat);
  const games = LEAGUES[lg].games;
  const w = Math.round(games * clamp(0.5 + (rand() + rand() + rand() - 1.5) * 0.3, 0.1, 0.9));
  const rec = { year, lg, team: list[Math.floor(rand() * list.length)][0], w, l: games - w, result: w * 2 >= games ? "" : MISSED } as SeasonRecord;
  return seasonStandings({ id: `${c.id}:${lg}`, p: c.p }, rec);
}

/** 내가 치른 플레이오프에서 알 수 있는 것: 떨어진 라운드가 정해진 팀과, 어느 라운드까지는 살아남은 팀 */
function knownExits(rec: SeasonRecord | null, total: number, lose: readonly string[]) {
  const fixed = new Map<string, number>();
  const atLeast = new Map<string, number>();
  if (!rec) return { fixed, atLeast };
  if (rec.result === MISSED) fixed.set(rec.team, -1);
  const mine = rec.result === CHAMPION ? total : lose.indexOf(rec.result);
  if (mine < 0) return { fixed, atLeast };
  fixed.set(rec.team, mine);
  const opps = rec.opps ?? (rec.final ? [rec.final.opp] : []);
  // KBL 4강 직행은 첫 라운드를 치르지 않아서 만난 팀 수가 라운드 수보다 적어요.
  const skipped = Math.min(mine + 1, total) - opps.length;
  opps.forEach((opp, i) => {
    const round = i + skipped;
    if (mine > round) fixed.set(opp, round);
    else if (round === total - 1) fixed.set(opp, total);
    else atLeast.set(opp, round + 1);
  });
  return { fixed, atLeast };
}

/** 리그 전체의 플레이오프 결과: 팀마다 떨어진 라운드. 라운드마다 정해진 수만큼 떨어지고, 시드가 낮은 팀이 먼저 떨어지기 쉬워요. */
function playoffExits(st: SeasonStandings, rec: SeasonRecord | null, rand: () => number): Map<string, number> {
  const lg = st.lg;
  const { lose } = playoffRounds(lg);
  const total = lose.length;
  const bye = BYE_SPOTS[lg] ?? 0;
  const { fixed, atLeast } = knownExits(rec, total, lose);
  const exits = new Map<string, number>();
  const finalists: TeamRow[] = [];
  // NBA는 컨퍼런스 우승 팀끼리, 나머지 리그는 한 표에서 두 팀이 결승에 올라요.
  const perGroup = lg === "nba" ? 1 : 2;
  const rounds = total - 1;

  for (const table of st.tables) {
    const cut = table.cut || table.rows.length;
    let alive = table.rows.filter((r) => {
      const f = fixed.get(r.team);
      return f === undefined ? r.rank <= cut || atLeast.has(r.team) : f >= 0;
    });
    for (const r of table.rows) if (!alive.includes(r)) exits.set(r.team, -1);
    for (let round = 0; round < rounds; round++) {
      const next = perGroup * 2 ** (rounds - 1 - round);
      const direct = (r: TeamRow) => round === 0 && r.rank <= bye;
      // 4강 직행 팀은 첫 라운드에 떨어지지 않아요. 내가 첫 라운드에 이긴 팀이 직행 시드면 다음 라운드에 떨어진 것으로 쳐요.
      const out = alive.filter((r) => {
        const f = fixed.get(r.team);
        return (f === round && !direct(r)) || (round === 1 && f === 0 && r.rank <= bye);
      });
      const pool = alive.filter((r) => !fixed.has(r.team) && (atLeast.get(r.team) ?? 0) <= round && !direct(r));
      while (alive.length - out.length > next && pool.length) {
        const weights = pool.map((r) => r.rank ** UPSET);
        let roll = rand() * weights.reduce((a, b) => a + b, 0);
        let i = 0;
        while (i < pool.length - 1 && (roll -= weights[i]) > 0) i++;
        out.push(pool.splice(i, 1)[0]);
      }
      for (const r of out) exits.set(r.team, round);
      alive = alive.filter((r) => !out.includes(r));
    }
    finalists.push(...alive);
  }

  // 결승: 내가 치렀으면 그 결과대로, 아니면 승수가 많은 팀이 이기기 쉬워요.
  const champ =
    finalists.find((r) => fixed.get(r.team) === total) ??
    finalists.find((r) => !fixed.has(r.team) && finalists.some((o) => fixed.get(o.team) === total - 1)) ??
    (finalists.length > 1 && rand() * (finalists[0].w + finalists[1].w) >= finalists[0].w ? finalists[1] : finalists[0]);
  for (const r of finalists) exits.set(r.team, r === champ ? total : total - 1);
  return exits;
}

/** 그 팀의 직전 시즌 성적. 프로 리그가 아니거나 시즌 기록을 만들 수 없으면 null이에요. */
export function teamForm(c: Career, lg: LeagueKey, name: string): TeamForm | null {
  if (!LEAGUES[lg].pro) return null;
  const year = c.year - 1;
  const rec = c.hist.find((h) => h.year === year && h.lg === lg && !h.mil && h.w + h.l > 0) ?? null;
  const st = rec ? seasonStandings(c, rec) : otherLeague(c, lg, year);
  if (!st) return null;
  const table = st.tables.find((t) => t.rows.some((r) => r.team === name));
  const row = table?.rows.find((r) => r.team === name);
  if (!table || !row) return null;
  const exit = playoffExits(st, rec, seededPick(`${c.id}:${year}:${lg}:playoffs`)).get(name) ?? -1;
  const { lose } = playoffRounds(lg);
  const result = exit < 0 ? MISSED : exit >= lose.length ? CHAMPION : lose[exit];
  return { year, group: table.name, rank: row.rank, w: row.w, l: row.l, result, exit, ...(row.rank === table.rows.length ? { last: true } : {}) };
}

/** 제안한 팀에 직전 시즌 성적을 붙이고, 전력을 그 성적에 맞춰요. 지금 팀과의 재계약은 전력을 그대로 둬요. */
export function scoutTeam(c: Career, lg: LeagueKey, t: Team): Team {
  const form = teamForm(c, lg, t.name);
  if (!form) return t;
  if (c.team?.lg === lg && c.team.name === t.name) return { ...t, form };
  const wp = form.w / (form.w + form.l);
  return { ...t, q: Math.round(clamp(0.5 + (wp - 0.5) * FORM_CARRY, 0.2, 0.8) * 100) / 100, form };
}

/**
 * 이적 첫 시즌의 하한. 전력을 유지한 팀이 갑자기 무너지지 않게, 직전 시즌보다 한 라운드 앞까지는 올라가요.
 * 우승 팀은 결승까지, 준우승 팀은 그 앞 라운드까지예요. rounds는 치러야 하는 라운드 수, wp는 최소 승률이에요.
 */
export function formFloor(t: Pick<Team, "form">, year: number): { rounds: number; wp: number } {
  const f = t.form;
  if (!f || f.year !== year - 1 || f.exit < 1) return { rounds: 0, wp: 0 };
  return { rounds: f.exit, wp: f.w / (f.w + f.l) - FORM_DROP };
}

/** 평균 이상 선수가 약팀에서 더 끌어올리는 승률. 팀이 약할수록, 선수 기여가 클수록 커져요. */
export function weakTeamLift(q: number, contrib: number): number {
  if (contrib <= 0) return 0;
  return Math.min(contrib, CARRY_CONTRIB) * CARRY_RATE * clamp((0.5 - q) / CARRY_RANGE, 0, 1);
}

/** 화면에 보여주는 직전 시즌 성적: 정규시즌과 플레이오프 한 줄씩 */
export function formLines(f: TeamForm): { regular: string; playoff: string } {
  const conf = f.group.endsWith("컨퍼런스") ? `${f.group.split(" ")[0]} ` : "";
  const playoff =
    f.result === CHAMPION ? "우승" : f.result.endsWith("준우승") ? "준우승" : f.result === MISSED ? "진출 실패" : f.result.replace(/^플레이오프 /, "").replace(/ 플레이오프$/, "");
  return { regular: `${conf}${f.rank}위 · ${f.w}승 ${f.l}패`, playoff };
}
