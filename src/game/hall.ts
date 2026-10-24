import { POS_KEYS } from "./data";
import { findTeam } from "./leagues";
import type { AwardKey, CareerSummary, PosKey } from "./types";

/**
 * 랭킹 점수에 더하는 상 하나의 점수 (NBA에서 받았을 때). NBA MVP와 파이널 MVP가 가장 커요.
 * `mvp`는 NBA 밖 리그의 MVP라 늘 SCORE_OTHER를 곱해요.
 */
export const SCORE_AWARDS: Partial<Record<AwardKey, number>> = {
  mvp_nba: 30,
  fmvp: 20,
  mvp: 20,
  ring: 12,
  allleague: 8,
  dpoy: 8,
  cfmvp: 6,
  nat_gold: 6,
  allleague2: 5,
  roy: 5,
  scoring: 5,
  alldef: 3,
  allstar: 3,
  sixth: 3,
  mip: 3,
  nat_silver: 3,
  allrookie: 2,
  nat_bronze: 2,
  title: 2,
};

/** NBA 밖(다른 프로 리그·아마추어)에서 받은 상과 쌓은 기록은 이만큼만 쳐요. 국가대표 메달은 그대로예요. */
export const SCORE_OTHER = 0.3;

/** NBA 팀에서 한 번이라도 뛰었으면 더하는 점수. NBA 시즌마다 1점씩 더 붙어요. */
export const SCORE_NBA = 10;

/** NBA에서만 받는 상. NBA 몫이 없는 예전 기록에서도 NBA 상으로 쳐요. */
const NBA_ONLY: AwardKey[] = ["mvp_nba", "cfmvp", "allrookie"];
const NO_LEAGUE: AwardKey[] = ["nat_gold", "nat_silver", "nat_bronze"];

/** NBA 팀에서 뛰어 본 커리어인지 */
export const playedNba = (s: Pick<CareerSummary, "teams">): boolean => s.teams.some((t) => findTeam(t)?.lg === "nba");

type Scored = Pick<CareerSummary, "awards" | "pts" | "reb" | "ast" | "peak" | "teams" | "nba">;

export interface ScoreParts {
  /** 수상 */
  awards: number;
  /** 프로 통산 기록: NBA에서 득점 400·리바운드 800·어시스트 560마다 1점 */
  stats: number;
  /** 최고 오버롤이 60을 넘는 만큼 */
  peak: number;
  /** NBA 진출과 NBA 시즌 수 */
  nba: number;
}

export function scoreParts(s: Scored): ScoreParts {
  const nbaAwards = s.nba?.awards ?? {};
  let awards = 0;
  for (const [k, w] of Object.entries(SCORE_AWARDS) as [AwardKey, number][]) {
    const total = s.awards[k] ?? 0;
    const inNba = NO_LEAGUE.includes(k) || NBA_ONLY.includes(k) ? total : Math.min(total, nbaAwards[k] ?? 0);
    awards += (inNba + (total - inNba) * SCORE_OTHER) * w;
  }
  const line = (pts: number, reb: number, ast: number) => pts / 400 + reb / 800 + ast / 560;
  const n = s.nba ?? { pts: 0, reb: 0, ast: 0, seasons: 0 };
  const inNba = line(n.pts, n.reb, n.ast);
  return {
    awards,
    stats: inNba + (line(s.pts, s.reb, s.ast) - inNba) * SCORE_OTHER,
    peak: Math.max(0, s.peak - 60),
    nba: playedNba(s) ? SCORE_NBA + n.seasons : 0,
  };
}

/** 랭킹 점수 (소수 첫째 자리). 명예의 전당과 온라인 랭킹이 모두 이 점수로 줄을 세워요. */
export function rankScore(s: Scored): number {
  const p = scoreParts(s);
  return Math.round((p.awards + p.stats + p.peak + p.nba) * 10) / 10;
}

/** 랭킹 점수 → NBA MVP 횟수 → 최고 오버롤 → 통산 득점 */
export function compareCareers(a: CareerSummary, b: CareerSummary): number {
  return rankScore(b) - rankScore(a) || b.mvp - a.mvp || b.peak - a.peak || b.pts - a.pts;
}

export interface RankedCareer {
  rank: number;
  career: CareerSummary;
}

/** 네 항목이 모두 같으면 공동 순위예요. */
export function rankHall(hall: CareerSummary[]): RankedCareer[] {
  const sorted = [...hall].sort(compareCareers);
  let rank = 0;
  return sorted.map((career, i) => {
    if (i === 0 || compareCareers(sorted[i - 1], career) !== 0) rank = i + 1;
    return { rank, career };
  });
}

export function bestFive(hall: CareerSummary[]): { pos: PosKey; career: CareerSummary | null }[] {
  const sorted = [...hall].sort(compareCareers);
  return POS_KEYS.map((pos) => ({ pos, career: sorted.find((h) => h.pos === pos) ?? null }));
}
