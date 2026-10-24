import { LEAGUES } from "./leagues";
import type { AwardKey, LeagueKey } from "./types";

/*
 * 리그마다 다른 시즌 시상 이름. 같은 종류의 상(AwardKey)이라도 리그에 따라 실제 이름으로 불러요.
 * 예: 베스트 팀 → NBA "올-NBA 퍼스트팀", KBL "KBL 베스트5"
 */

/** 베스트 팀이 몇 팀까지 있는지. NBA는 퍼스트·세컨드·서드, KBL·대학·고교는 베스트5 하나예요. */
export const ALL_LEAGUE_TIERS: Record<LeagueKey, 1 | 2 | 3> = { nba: 3, euro: 2, gleague: 2, ncaa: 2, kbl: 1, kuniv: 1, hs: 1 };
/** 올-디펜시브 팀 수 */
export const ALL_DEF_TIERS: Record<LeagueKey, 1 | 2> = { nba: 2, euro: 1, gleague: 1, ncaa: 1, kbl: 1, kuniv: 1, hs: 1 };

const TIER = ["퍼스트팀", "세컨드팀", "서드팀"];

/** 리그별 상 이름. 없는 상은 '리그 약칭 + 기본 이름'이에요. */
const NAMES: Partial<Record<LeagueKey, Partial<Record<AwardKey, string>>>> = {
  nba: {
    mvp_nba: "NBA MVP (마이클 조던 트로피)",
    fmvp: "NBA 파이널 MVP (빌 러셀 트로피)",
    roy: "NBA 올해의 신인 (윌트 체임벌린 트로피)",
    dpoy: "NBA 올해의 수비수 (하킴 올라주원 트로피)",
    sixth: "NBA 올해의 식스맨 (존 하블리첵 트로피)",
    mip: "NBA 기량발전상 (조지 마이칸 트로피)",
    scoring: "NBA 득점왕",
    allstar: "NBA 올스타",
    allrookie: "NBA 올-루키 퍼스트팀",
  },
  kbl: {
    mvp: "KBL 정규리그 MVP",
    fmvp: "KBL 챔피언결정전 MVP",
    roy: "KBL 신인선수상",
    dpoy: "KBL 최우수수비상",
    sixth: "KBL 식스맨상",
    mip: "KBL 기량발전상",
    scoring: "KBL 득점왕",
    allleague: "KBL 베스트5",
    alldef: "KBL 수비 5걸",
  },
  euro: { mvp: "유로리그 MVP", fmvp: "유로리그 파이널 포 MVP", roy: "유로리그 라이징 스타", dpoy: "유로리그 올해의 수비수" },
  gleague: { mvp: "G리그 MVP", roy: "G리그 올해의 신인", dpoy: "G리그 올해의 수비수" },
  ncaa: { mvp: "NCAA 올해의 선수 (네이스미스 상)", fmvp: "NCAA 파이널 포 MOP", roy: "NCAA 올해의 신입생" },
  kuniv: { mvp: "U-리그 MVP", fmvp: "U-리그 챔피언결정전 MVP", allleague: "U-리그 베스트5" },
  hs: { mvp: "고교 MVP", fmvp: "고교 전국대회 MVP", allleague: "고교 베스트5" },
};

const BASE: Partial<Record<AwardKey, string>> = {
  mvp: "MVP",
  mvp_nba: "MVP",
  fmvp: "파이널 MVP",
  allstar: "올스타",
  roy: "신인왕",
  dpoy: "올해의 수비수",
  scoring: "득점왕",
  sixth: "식스맨상",
  mip: "기량발전상",
  allrookie: "올-루키 팀",
};

/** 베스트 팀 이름. tier는 1(퍼스트)부터예요. */
function allLeagueName(lg: LeagueKey, tier: number): string {
  if (ALL_LEAGUE_TIERS[lg] === 1) return NAMES[lg]?.allleague ?? `${LEAGUES[lg].short} 베스트5`;
  const team = lg === "nba" ? "올-NBA" : lg === "euro" ? "올-유로리그" : lg === "gleague" ? "올-G리그" : "올-아메리칸";
  return `${team} ${TIER[tier - 1]}`;
}

/** 올-디펜시브 팀 이름 */
function allDefName(lg: LeagueKey, tier: number): string {
  if (lg === "nba") return `NBA 올-디펜시브 ${TIER[tier - 1]}`;
  return NAMES[lg]?.alldef ?? `${LEAGUES[lg].short} 올-디펜시브 팀`;
}

/**
 * 그 리그에서 부르는 상 이름. 베스트 팀·올-디펜시브는 tier(1 퍼스트, 2 세컨드, 3 서드)로 나눠요.
 * allleague2는 세컨드·서드팀이라 tier 2 이상으로 불러요.
 */
export function awardName(lg: LeagueKey, k: AwardKey, tier = 1): string {
  if (k === "allleague" || k === "allleague2") return allLeagueName(lg, k === "allleague2" ? Math.max(2, tier) : 1);
  if (k === "alldef") return allDefName(lg, tier);
  return NAMES[lg]?.[k] ?? `${LEAGUES[lg].short} ${BASE[k] ?? k}`;
}

/** NBA 서부 컨퍼런스 구단. 나머지 15개 구단은 동부예요. */
const NBA_WEST = new Set([
  "댈러스 매버릭스",
  "덴버 너기츠",
  "골든스테이트 워리어스",
  "휴스턴 로키츠",
  "LA 클리퍼스",
  "LA 레이커스",
  "멤피스 그리즐리스",
  "미네소타 팀버울브스",
  "뉴올리언스 펠리컨스",
  "오클라호마시티 썬더",
  "피닉스 선즈",
  "포틀랜드 트레일블레이저스",
  "새크라멘토 킹스",
  "샌안토니오 스퍼스",
  "유타 재즈",
]);

export const nbaConference = (team: string): "서부" | "동부" => (NBA_WEST.has(team) ? "서부" : "동부");

/** 컨퍼런스 파이널 MVP. 서부는 매직 존슨 트로피, 동부는 래리 버드 트로피예요. */
export function conferenceFinalsMvpName(team: string): string {
  return nbaConference(team) === "서부" ? "서부 컨퍼런스 파이널 MVP (매직 존슨 트로피)" : "동부 컨퍼런스 파이널 MVP (래리 버드 트로피)";
}
