import type { Career, LeagueKey, SeasonRecord } from "../core/types";
import { seededPick } from "../core/random";
import { clamp } from "../core/util";
import { nbaConference } from "./awards";
import { LEAGUES, leagueTeams } from "./leagues";

/* 시즌 순위표: 시즌이 끝난 뒤 보여주는 리그(NBA는 컨퍼런스) 정규시즌 순위 */

/**
 * 플레이오프에 오르는 팀 수 (NBA는 컨퍼런스마다). 플레이오프 라운드 수(season.ts의 playoffRounds)와 맞춰요:
 * 3라운드는 8팀, NBA 4라운드는 컨퍼런스마다 8팀, KBL은 6강이에요.
 * 아마추어는 정규시즌과 전국대회 출전이 따로라 진출선이 없어요.
 */
export const PLAYOFF_SPOTS: Partial<Record<LeagueKey, number>> = { nba: 8, kbl: 6, euro: 8, gleague: 8 };
/** 4강에 직행하는 팀 수. KBL은 정규리그 1·2위예요. */
export const BYE_SPOTS: Partial<Record<LeagueKey, number>> = { kbl: 2 };
/** 다른 팀 승률이 퍼지는 정도(표준편차). NBA 82경기면 대개 20승대부터 60승대까지 벌어져요. */
const SPREAD = 0.15;
/** KBL 플레이오프 성적이 몇 번째 라운드(6강 1, 4강 2, 결승 3)까지 갔는지 */
const KBL_STAGE: Record<string, number> = { "6강 플레이오프": 1, "4강 플레이오프": 2, "챔피언결정전 준우승": 3, "리그 우승": 3 };

export interface StandingRow {
  rank: number;
  team: string;
  color: string;
  w: number;
  l: number;
  /** 1위와의 승차 */
  gb: number;
  /** 내 팀 */
  me?: true;
  /** 이번 시즌 플레이오프(전국대회)에서 만난 팀. 결승 상대면 final이에요. */
  met?: "final" | "post";
}

export interface StandingsTable {
  /** 서부 컨퍼런스, KBL… */
  name: string;
  rows: StandingRow[];
  /** 플레이오프 진출 팀 수. 0이면 진출선이 없어요. */
  cut: number;
  /** 4강 직행 팀 수. 0이면 없어요. */
  bye: number;
}

export interface SeasonStandings {
  year: number;
  lg: LeagueKey;
  /** NBA는 동부·서부 두 표, 나머지는 한 표예요. 첫 표가 내 팀이 있는 표예요. */
  tables: StandingsTable[];
  /** 내 팀 순위 (그 표 안에서) */
  rank: number;
}

/**
 * 지난 시즌의 정규시즌 순위표. 다른 팀 성적은 기록에 없어서, 커리어 id와 연도로 정하는 난수로 그때마다 똑같이 만들어요.
 * 게임 난수 흐름은 건드리지 않고 저장하지도 않아요.
 *
 * 순위표는 시즌 결과와 어긋나지 않아요.
 * - 내 팀 승패는 기록 그대로예요.
 * - 플레이오프에 오르지 못했으면 진출선 밖, 올랐으면 안이에요. KBL 4강 직행은 1·2위, 6강부터 치렀으면 3~6위예요.
 * - 플레이오프에서 만난 팀은 (그 팀 컨퍼런스의) 진출선 안에 있어요.
 * - 리그 전체의 승수와 패수가 같아요.
 *
 * 팀 경기가 없는 시즌(무소속·군 복무)이면 null이에요.
 */
export function seasonStandings(c: Pick<Career, "id" | "p">, rec: SeasonRecord): SeasonStandings | null {
  const lg = rec.lg;
  const games = rec.w + rec.l;
  if (!lg || rec.mil || games <= 0) return null;
  const rand = seededPick(`${c.id}:${rec.year}:standings`);
  const list = [...leagueTeams(lg, c.p.nat)];
  if (!list.some(([n]) => n === rec.team)) list.push([rec.team, "#3a3f48"]);
  const colorOf = new Map(list);

  const nba = lg === "nba";
  const groupOf = (team: string) => (nba ? `${nbaConference(team)} 컨퍼런스` : LEAGUES[lg].name);
  const myGroup = groupOf(rec.team);
  const groups = nba ? [myGroup, myGroup.startsWith("서부") ? "동부 컨퍼런스" : "서부 컨퍼런스"] : [myGroup];
  const members = groups.map((g) => list.map(([n]) => n).filter((n) => groupOf(n) === g && n !== rec.team));
  const cut = PLAYOFF_SPOTS[lg] ?? 0;
  const bye = BYE_SPOTS[lg] ?? 0;
  const myW = rec.w;

  // 1. 다른 팀 승수를 정규분포 비슷하게 뽑아요 (균등 난수 셋의 합).
  const gauss = () => (rand() + rand() + rand() - 1.5) * 2;
  const wins = members.map((m) => m.map(() => Math.round(games * clamp(0.5 + gauss() * SPREAD, 0.1, 0.9))));

  // 2. 리그 전체 승수가 패수와 같도록 한꺼번에 옮겨요. 남는 몇 승은 4에서 맞춰요.
  const teams = list.length;
  const target = Math.round((teams * games) / 2) - myW;
  const others = wins.flat();
  const shift = Math.round((target - others.reduce((a, b) => a + b, 0)) / Math.max(1, others.length));
  for (const ws of wins) for (let i = 0; i < ws.length; i++) ws[i] = clamp(ws[i] + shift, 0, games);

  // 3. 내 순위를 시즌 결과에 맞춰요. 그 순위 위의 팀은 나보다 승수가 같거나 많고, 아래 팀은 같거나 적어요.
  const mine = wins[0].sort((a, b) => b - a);
  const n = mine.length + 1;
  let [lo, hi] = [1, n];
  if (cut && n > cut) {
    if (rec.result === "플레이오프 진출 실패") lo = cut + 1;
    else {
      hi = cut;
      const stage = KBL_STAGE[rec.result];
      if (bye && stage) {
        // 6강에서 졌거나, 치른 라운드 수가 그 성적까지의 라운드 수와 같으면 6강부터 치렀어요.
        if (stage === 1 || (rec.opps && rec.opps.length >= stage)) lo = bye + 1;
        else if (rec.opps) hi = bye;
      }
    }
  }
  const above = mine.filter((w) => w > myW).length;
  const ties = mine.filter((w) => w === myW).length;
  const rank = clamp(1 + above + Math.floor((ties + 1) * rand()), lo, hi);
  for (let i = 0; i < mine.length; i++) {
    // 옮기는 팀은 나와 1~3승 차이로 둬요. 같은 승수로만 맞추면 동률이 너무 많아져요.
    if (i < rank - 1 && mine[i] < myW) mine[i] = Math.min(games, myW + 1 + Math.floor(rand() * 3));
    if (i >= rank - 1 && mine[i] > myW) mine[i] = Math.max(0, myW - 1 - Math.floor(rand() * 3));
  }

  // 4. 남은 차이를 한 승씩 나눠요. 내 순위 위·아래 경계는 넘지 않아요.
  const slots = wins.flatMap((ws, g) =>
    ws.map((_, i) => ({ g, i, min: g === 0 && i >= rank - 1 ? 0 : g === 0 ? myW : 0, max: g === 0 && i >= rank - 1 ? myW : games })),
  );
  let diff = target - wins.flat().reduce((a, b) => a + b, 0);
  for (let guard = 0; diff !== 0 && guard < slots.length * games; guard++) {
    const s = slots[Math.floor(rand() * slots.length)];
    const v = wins[s.g][s.i] + Math.sign(diff);
    if (v < s.min || v > s.max) continue;
    wins[s.g][s.i] = v;
    diff -= Math.sign(diff);
  }

  // 5. 승수 순으로 줄 세우고, 팀 이름을 자리에 앉혀요. 플레이오프에서 만난 팀은 진출선 안 자리에 먼저 앉아요.
  const met = rec.opps ?? (rec.final ? [rec.final.opp] : []);
  const finalOpp = rec.final?.opp;
  const tables = groups.map((name, g): StandingsTable => {
    const ws = wins[g];
    const top = g === 0 ? ws.slice(0, rank - 1).sort((a, b) => b - a) : [...ws].sort((a, b) => b - a);
    const order: (number | null)[] = g === 0 ? [...top, null, ...ws.slice(rank - 1).sort((a, b) => b - a)] : top;
    const names: (string | null)[] = order.map((w) => (w === null ? rec.team : null));
    // 진출선이 없는 아마추어는 위쪽 절반에 앉혀요.
    const line = cut || Math.ceil(order.length / 2);
    const seats = (from: number, to: number) => shuffled(range(from, to).filter((i) => names[i] === null), rand);
    const goodSeats = seats(0, Math.min(line, order.length));
    const pool = members[g].filter((t) => met.includes(t));
    for (const t of pool) {
      const i = goodSeats.shift() ?? seats(0, order.length)[0];
      names[i] = t;
    }
    const rest = shuffled(members[g].filter((t) => !pool.includes(t)), rand);
    for (let i = 0; i < names.length; i++) if (names[i] === null) names[i] = rest.shift()!;
    const rows = names.map((team, i): StandingRow => {
      const w = order[i] ?? myW;
      const row: StandingRow = { rank: i + 1, team: team!, color: colorOf.get(team!) ?? "#3a3f48", w, l: games - w, gb: 0 };
      if (team === rec.team) row.me = true;
      else if (met.includes(team!)) row.met = team === finalOpp ? "final" : "post";
      return row;
    });
    const lead = rows[0];
    for (const r of rows) r.gb = (lead.w - r.w + (r.l - lead.l)) / 2;
    return { name, rows, cut: cut < rows.length ? cut : 0, bye };
  });
  return { year: rec.year, lg, tables, rank };
}

const range = (from: number, to: number) => Array.from({ length: Math.max(0, to - from) }, (_, i) => from + i);

function shuffled<T>(arr: readonly T[], rand: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
