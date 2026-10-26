import { POS_KEYS } from "./data";
import { LEAGUES, findTeam } from "./leagues";
import type { AwardKey, CareerSummary, LeagueKey, LeagueShare, PosKey } from "./types";

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

/**
 * 리그마다 상과 기록을 치는 비중. NBA를 1로 두고 리그 수준(평균 오버롤)에 맞춰 줄여요. 국가대표 메달은 리그와 상관없이 그대로예요.
 * 리그별 몫(leagues)이 없는 예전 기록은 NBA 밖을 모두 SCORE_OTHER로 쳐요.
 */
export const LEAGUE_WEIGHT: Record<LeagueKey, number> = { nba: 1, euro: 0.45, gleague: 0.4, kbl: 0.35, ncaa: 0.25, kuniv: 0.12, hs: 0.08 };

/** NBA 밖(다른 프로 리그·아마추어)에서 받은 상과 쌓은 기록을 리그를 모를 때 치는 비중이에요. */
export const SCORE_OTHER = 0.3;

/** 국가대표 출전 경기마다 더하는 점수. 100경기면 8점이에요. */
export const SCORE_CAP = 0.08;

/** NBA 팀에서 한 번이라도 뛰었으면 더하는 점수. NBA 시즌마다 1점씩 더 붙어요. */
export const SCORE_NBA = 10;

/** NBA에서만 받는 상. NBA 몫이 없는 예전 기록에서도 NBA 상으로 쳐요. */
const NBA_ONLY: AwardKey[] = ["mvp_nba", "cfmvp", "allrookie"];
const NO_LEAGUE: AwardKey[] = ["nat_gold", "nat_silver", "nat_bronze"];

/** NBA 팀에서 뛰어 본 커리어인지 */
export const playedNba = (s: Pick<CareerSummary, "teams">): boolean => s.teams.some((t) => findTeam(t)?.lg === "nba");

type Scored = Pick<CareerSummary, "awards" | "pts" | "reb" | "ast" | "peak" | "teams" | "nba" | "caps" | "leagues">;

export interface ScoreParts {
  /** 리그에서 받은 상 (MVP·우승·파이널 MVP·개인상) */
  awards: number;
  /** 프로 통산 기록: NBA에서 득점 400·리바운드 800·어시스트 560·스틸 200·블록 200·3점슛 250마다 1점 */
  stats: number;
  /** 국가대표: 메달과 출전 경기 */
  nat: number;
  /** 최고 오버롤이 60을 넘는 만큼 */
  peak: number;
  /** NBA 진출과 NBA 시즌 수 */
  nba: number;
}

const LEAGUE_AWARDS = (Object.entries(SCORE_AWARDS) as [AwardKey, number][]).filter(([k]) => !NO_LEAGUE.includes(k));
const MEDALS = (Object.entries(SCORE_AWARDS) as [AwardKey, number][]).filter(([k]) => NO_LEAGUE.includes(k));
type Line = Partial<Pick<LeagueShare, "pts" | "reb" | "ast" | "stl" | "blk" | "tpm">>;
const line = (l: Line) => (l.pts ?? 0) / 400 + (l.reb ?? 0) / 800 + (l.ast ?? 0) / 560 + (l.stl ?? 0) / 200 + (l.blk ?? 0) / 200 + (l.tpm ?? 0) / 250;

/** 리그별 몫이 있으면: 상과 프로 기록을 리그마다 LEAGUE_WEIGHT로 쳐요. 리그를 모르는 상(군 복무 시즌 등)은 SCORE_OTHER로 쳐요. */
function byLeague(s: Scored, leagues: Partial<Record<LeagueKey, LeagueShare>>): { awards: number; stats: number } {
  let awards = 0;
  let stats = 0;
  const counted: Partial<Record<AwardKey, number>> = {};
  for (const [lg, share] of Object.entries(leagues) as [LeagueKey, LeagueShare][]) {
    const w = LEAGUE_WEIGHT[lg];
    for (const [k, pts] of LEAGUE_AWARDS) {
      const n = share.awards[k] ?? 0;
      awards += n * pts * w;
      counted[k] = (counted[k] ?? 0) + n;
    }
    if (LEAGUES[lg].pro) stats += line(share) * w;
  }
  for (const [k, pts] of LEAGUE_AWARDS) awards += Math.max(0, (s.awards[k] ?? 0) - (counted[k] ?? 0)) * pts * SCORE_OTHER;
  return { awards, stats };
}

/** 예전 기록: NBA 몫(nba)만 나눠 알고, NBA 밖은 모두 SCORE_OTHER로 쳐요. */
function nbaOrOther(s: Scored): { awards: number; stats: number } {
  const nbaAwards = s.nba?.awards ?? {};
  let awards = 0;
  for (const [k, w] of LEAGUE_AWARDS) {
    const total = s.awards[k] ?? 0;
    const inNba = NBA_ONLY.includes(k) ? total : Math.min(total, nbaAwards[k] ?? 0);
    awards += (inNba + (total - inNba) * SCORE_OTHER) * w;
  }
  const inNba = line(s.nba ?? {});
  return { awards, stats: inNba + (line(s) - inNba) * SCORE_OTHER };
}

export function scoreParts(s: Scored): ScoreParts {
  const { awards, stats } = s.leagues ? byLeague(s, s.leagues) : nbaOrOther(s);
  const medals = MEDALS.reduce((t, [k, w]) => t + (s.awards[k] ?? 0) * w, 0);
  return {
    awards,
    stats,
    nat: medals + (s.caps ?? 0) * SCORE_CAP,
    peak: Math.max(0, s.peak - 60),
    nba: playedNba(s) ? SCORE_NBA + (s.nba?.seasons ?? 0) : 0,
  };
}

/**
 * 랭킹 점수 (소수 첫째 자리). 명예의 전당과 온라인 랭킹이 모두 이 점수로 줄을 세워요.
 * 리그별 MVP·우승·파이널 MVP·개인상, 국가대표 메달과 출전, 프로 통산 기록, 최고 오버롤, NBA 진출을 더해요.
 */
export function rankScore(s: Scored): number {
  const p = scoreParts(s);
  return Math.round((p.awards + p.stats + p.nat + p.peak + p.nba) * 10) / 10;
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
