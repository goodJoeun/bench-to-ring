import type { Career, CareerSummary, LeagueKey, PosKey } from "../core/types";

/**
 * 한 브라우저에서 플레이한 모든 커리어를 더한 누적 기록. '누적 기록' 업적을 판정해요.
 * 커리어마다 몫(fromCareer)을 구해 더하고(addLifetime), 브라우저 저장은 storage.ts가 맡아요.
 * 은퇴하지 않고 새로 시작한 커리어도 그때까지 쌓은 몫은 남아요.
 */
export interface Lifetime {
  /** 은퇴한 커리어 수 */
  careers: number;
  /** 프로 시즌 */
  seasons: number;
  /** 프로 통산 경기·득점 */
  gp: number;
  pts: number;
  /** 프로 우승 */
  rings: number;
  /** 프로 정규시즌 MVP (NBA MVP 포함) */
  mvp: number;
  /** 벌어들인 돈 (억) */
  earn: number;
  /** NBA를 밟은 커리어 수 */
  nba: number;
  /** 클러치 성공 */
  clutch: number;
  /** 프로 무대를 밟은 포지션과 국적 */
  pos: PosKey[];
  nats: string[];
}

export const EMPTY_LIFETIME: Lifetime = { careers: 0, seasons: 0, gp: 0, pts: 0, rings: 0, mvp: 0, earn: 0, nba: 0, clutch: 0, pos: [], nats: [] };

const PRO_LEAGUES: LeagueKey[] = ["nba", "euro", "gleague", "kbl"];
const union = <T>(a: T[], b: T[]): T[] => [...new Set([...a, ...b])];

/** 두 누적 기록을 더해요. 포지션과 국적은 합쳐요. */
export function addLifetime(a: Lifetime, b: Lifetime): Lifetime {
  return {
    careers: a.careers + b.careers,
    seasons: a.seasons + b.seasons,
    gp: a.gp + b.gp,
    pts: a.pts + b.pts,
    rings: a.rings + b.rings,
    mvp: a.mvp + b.mvp,
    earn: a.earn + b.earn,
    nba: a.nba + b.nba,
    clutch: a.clutch + b.clutch,
    pos: union(a.pos, b.pos),
    nats: union(a.nats, b.nats),
  };
}

/** 커리어 하나의 몫. 진행 중인 커리어도 지금까지 쌓은 만큼 쳐요. */
export function fromCareer(c: Career): Lifetime {
  const pro = c.hist.filter((h) => h.pro && h.lg && !h.mil);
  const proYears = new Set(pro.map((h) => h.year));
  const played = c.proSeasons > 0;
  return {
    careers: c.stage === "retired" ? 1 : 0,
    seasons: c.proSeasons,
    gp: pro.reduce((t, h) => t + h.gp, 0),
    pts: Math.round(pro.reduce((t, h) => t + h.pts * h.gp, 0)),
    rings: c.awards.ring ?? 0,
    mvp: c.awardLog.filter((a) => (a.k === "mvp" || a.k === "mvp_nba") && proYears.has(a.y)).length,
    earn: Math.round(c.earnings + (c.spent ?? 0)),
    nba: c.hist.some((h) => h.lg === "nba") ? 1 : 0,
    clutch: c.clutchWins ?? 0,
    pos: played ? [c.p.pos] : [],
    nats: played ? [c.p.nat ?? "대한민국"] : [],
  };
}

/** 은퇴 요약으로 구한 몫. 누적 기록이 생기기 전의 명예의 전당을 옮길 때 써요. 클러치 성공은 요약에 없어 0으로 쳐요. */
export function fromSummary(s: CareerSummary): Lifetime {
  const leagues = s.leagues ? PRO_LEAGUES.map((lg) => s.leagues?.[lg]?.awards) : [];
  const mvp = s.leagues ? leagues.reduce((t, a) => t + (a?.mvp ?? 0) + (a?.mvp_nba ?? 0), 0) : (s.awards.mvp_nba ?? 0);
  const played = s.seasons > 0;
  return {
    careers: 1,
    seasons: s.seasons,
    gp: s.gp,
    pts: s.pts,
    rings: s.rings,
    mvp,
    earn: s.earn,
    nba: s.leagues?.nba || s.nba?.seasons ? 1 : 0,
    clutch: 0,
    pos: played ? [s.pos] : [],
    nats: played ? [s.nat || "대한민국"] : [],
  };
}
