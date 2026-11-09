import type { Career, PosKey } from "../core/types";

/**
 * 한 브라우저에서 플레이한 모든 커리어를 더한 누적 기록. '누적 기록' 업적을 판정해요.
 * 커리어마다 몫(fromCareer)을 구해 더하고(addLifetime), 브라우저 저장은 storage.ts가 맡아요.
 * 누적 기록을 세기 시작한 뒤로 쌓은 것만 쳐요. 예전 은퇴 기록과, 그때 진행 중이던 커리어가 이미 쌓은 기록은 빼요.
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
  /** 한 커리어에서 NBA 우승·NBA MVP·NBA 파이널 MVP를 모두 받은 포지션 (올-어라운드 플레이어) */
  allround: PosKey[];
}

export const EMPTY_LIFETIME: Lifetime = { careers: 0, seasons: 0, gp: 0, pts: 0, rings: 0, mvp: 0, earn: 0, nba: 0, clutch: 0, pos: [], nats: [], allround: [] };

/** 누적 기록 업적 id의 머리. 누적 기록을 새로 세기 시작할 때 이 업적들을 지워요. */
export const LIFETIME_PREFIX = "life_";

/** 예전에 저장한 누적 기록에는 없는 목록(allround)도 있어서 빈 목록으로 쳐요. */
const union = <T>(a: T[] | undefined, b: T[] | undefined): T[] => [...new Set([...(a ?? []), ...(b ?? [])])];

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
    allround: union(a.allround, b.allround),
  };
}

/**
 * a에서 b만큼 뺀 기록: 누적 기록을 세기 시작한 뒤로 쌓은 몫. 포지션과 국적은 그 뒤로 프로 시즌을 더 뛰었으면 쳐요.
 * 올-어라운드 포지션은 그 뒤에 세 상을 마저 채웠으면 쳐요.
 */
export function subLifetime(a: Lifetime, b: Lifetime): Lifetime {
  const minus = (k: Exclude<keyof Lifetime, "pos" | "nats" | "allround">) => Math.max(0, a[k] - b[k]);
  const more = a.seasons > b.seasons;
  return {
    careers: minus("careers"),
    seasons: minus("seasons"),
    gp: minus("gp"),
    pts: minus("pts"),
    rings: minus("rings"),
    mvp: minus("mvp"),
    earn: minus("earn"),
    nba: minus("nba"),
    clutch: minus("clutch"),
    pos: more ? a.pos : [],
    nats: more ? a.nats : [],
    allround: (a.allround ?? []).filter((p) => !(b.allround ?? []).includes(p)),
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
    allround: nbaTriple(c) ? [c.p.pos] : [],
  };
}

/** 한 커리어에서 NBA 우승, NBA MVP, NBA 파이널 MVP를 모두 받았는지 */
export function nbaTriple(c: Pick<Career, "hist" | "awardLog">): boolean {
  const nba = c.hist.filter((h) => h.lg === "nba" && h.pro && !h.mil);
  const years = new Set(nba.map((h) => h.year));
  const won = (k: string) => c.awardLog.some((a) => a.k === k && years.has(a.y));
  return nba.some((h) => h.result === "리그 우승") && won("mvp_nba") && won("fmvp");
}
