export type AttrKey = "sht" | "hdl" | "def" | "reb" | "ath" | "iq";
export type Attrs = Record<AttrKey, number>;

export type PosKey = "PG" | "SG" | "SF" | "PF" | "C";
/** hs 고교, kuniv 국내 대학(U-리그), ncaa 미국 대학, kbl, gleague NBA G리그, euro 유로리그, nba */
export type LeagueKey = "hs" | "kuniv" | "ncaa" | "kbl" | "gleague" | "euro" | "nba";
export type ProLeagueKey = "kbl" | "gleague" | "euro" | "nba";
export type Region = "asia" | "europe" | "americas";
export type CareerPath = "abroad" | "domestic";
export type Stage = "hs" | "college" | "pro" | "free" | "retired";
export type FocusKey = "bal" | AttrKey | "rest";
export type Trait = "조기성장" | "대기만성" | "꾸준함" | "강철몸" | "유리몸" | "승부사";
export type Grade = "S" | "A" | "B" | "C" | "D";
export type Role = "에이스" | "주전" | "식스맨" | "로테이션" | "벤치" | "엔드 오브 벤치";
export type NewsType = "info" | "good" | "bad" | "award" | "big" | "move";

export type AwardKey =
  | "mvp_nba"
  | "ring"
  | "fmvp"
  | "mvp"
  | "allleague"
  | "allstar"
  | "roy"
  | "dpoy"
  | "scoring"
  | "sixth"
  | "mip"
  | "title"
  | "nat_gold"
  | "nat_silver"
  | "nat_bronze";

export interface Team {
  name: string;
  color: string;
  /** 팀 전력 (0.2~0.8). 높을수록 승률이 높아요. */
  q: number;
}

export interface CurrentTeam extends Team {
  lg: LeagueKey;
}

export interface League {
  name: string;
  short: string;
  /** 리그 평균 오버롤. 출전 시간과 스탯 계산의 기준이에요. */
  avg: number;
  games: number;
  pro: boolean;
}

export interface Nation {
  name: string;
  /** 선수를 뺀 대표팀 전력 (대략 FIBA 랭킹 순, 미국 95 ~ 약체 55) */
  power: number;
  /** 국가대표 발탁 기준 오버롤 */
  threshold: number;
  /** FIBA 대륙컵 지역 (호주는 아시아컵에 나가요) */
  region: Region;
}

export type NatEventKey = "olympics" | "worldcup" | "wcq" | "asiacup" | "eurobasket" | "americup" | "asiangames";

/** 선수 생성 때 고르는 플레이 유형 */
export interface Archetype {
  name: string;
  /** 후보 능력치에 곱하는 배수 */
  e: Partial<Attrs>;
  /** 한두 문장 설명 */
  desc: string;
  /** 이 유형으로 유명했던 선수 */
  kbl: string[];
  nba: string[];
}

export interface Candidate {
  arch: string;
  attrs: Attrs;
  h: number;
  hFinal: number;
  /** 윙스팬 - 키 */
  wsd: number;
  pot: number;
  grade: Grade;
  trait: Trait;
  skin: string;
  hair: string;
}

export interface Player extends Candidate {
  name: string;
  num: number;
  nat: string;
  pos: PosKey;
  path: CareerPath;
  traitKnown: boolean;
}

export interface SeasonRecord {
  year: number;
  age: number;
  team: string;
  lg: LeagueKey | null;
  pro: boolean;
  role: Role | "-";
  gp: number;
  min: number;
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  fg: number;
  rating: number;
  w: number;
  l: number;
  result: string;
  ovr0: number;
  ovr1: number;
  awards: string[];
}

export type Action =
  | { k: "school"; lg: LeagueKey; team: Team; walk?: boolean }
  | { k: "stay" }
  | { k: "draft"; d: "nba" | "kbl" }
  | { k: "sign"; lg: ProLeagueKey; team: Team; years: number; salary: number }
  | { k: "skip" }
  | { k: "pos"; pos: PosKey }
  | ({ k: "boost" } & Boost)
  /** 확률 p로 win, 아니면 lose 효과가 나요. */
  | { k: "gamble"; p: number; win: Boost; lose: Boost }
  | { k: "retire" }
  /** 국가대표 대회 합류(join) 또는 불참 */
  | { k: "national"; ev: NatEventKey; year: number; join: boolean }
  | { k: "none" };

/** 이벤트 선택지가 주는 효과. 모든 값은 선택이에요. */
export interface Boost {
  attrs?: Partial<Attrs>;
  /** 무작위 능력치 rand개를 amt만큼 */
  rand?: number;
  amt?: number;
  health?: number;
  /** 수입(+) 또는 비용(-), 억 단위 */
  money?: number;
  trust?: number;
  /** 대형 에이전시와 계약: 이후 연봉 제안이 올라요. */
  agency?: boolean;
  /** 전담 트레이너: 이 능력치가 매 시즌 조금 더 잘 커요. */
  trainer?: AttrKey;
  msg?: string;
  /** 소식 종류. 기본은 good */
  t?: NewsType;
}

/** 이벤트로 얻은 지속 효과 */
export interface Perks {
  agency?: boolean;
  trainer?: AttrKey;
}

export interface DecisionOption {
  label: string;
  sub?: string;
  tag?: string;
  act: Action;
}

export interface Decision {
  title: string;
  body: string;
  opts: DecisionOption[];
}

/** 차례가 왔을 때 그 시점의 능력치로 만들어지는 결정 */
export interface LazyDecision {
  lazy: "hsgrad" | "college" | "fa" | "faFree";
}

export type QueueItem = Decision | LazyDecision;

export interface NewsItem {
  w: string;
  t: NewsType;
  m: string;
}

export interface AwardEntry {
  y: number;
  k: AwardKey;
  n: string;
}

export interface DraftInfo {
  lg: string;
  pick: number;
  round: number;
  inRound: number;
  team: string;
  year: number;
}

export interface Contract {
  years: number;
  salary: number;
}

export interface CareerSummary {
  id: string;
  name: string;
  num: number;
  pos: PosKey;
  nat: string;
  mvp: number;
  rings: number;
  personal: number;
  peak: number;
  pts: number;
  reb: number;
  ast: number;
  gp: number;
  seasons: number;
  retAge: number;
  retYear: number;
  teams: string[];
  earn: number;
  caps: number;
  awards: Partial<Record<AwardKey, number>>;
  draft: DraftInfo | null;
  legacy: string;
}

export interface Career {
  v: 2;
  id: string;
  p: Player;
  age: number;
  /** 다음에 진행할 시즌 연도 */
  year: number;
  health: number;
  /** 코치 신뢰 (-3~4). 출전 시간에 더해져요. */
  trust: number;
  focus: FocusKey;
  team: CurrentTeam | null;
  contract: Contract | null;
  stage: Stage;
  schoolYear: number;
  collegeYears: number;
  proSeasons: number;
  hist: SeasonRecord[];
  awards: Partial<Record<AwardKey, number>>;
  awardLog: AwardEntry[];
  nat: {
    caps: number;
    /** 월드컵 예선 결과: y년 월드컵 본선 진출 여부 */
    wcq?: { y: number; ok: boolean };
  };
  earnings: number;
  peakOvr: number;
  queue: QueueItem[];
  news: NewsItem[];
  last: SeasonRecord | null;
  lastDelta: Partial<Record<AttrKey, number>>;
  potOff: number;
  posAsked: Partial<Record<PosKey, 1>>;
  draft: DraftInfo | null;
  summary: CareerSummary | null;
  /** 생활 이벤트 id → 마지막으로 겪은 시즌 연도 */
  events: Record<string, number>;
  perks: Perks;
}

export interface NewCareerInput {
  name: string;
  num: number;
  nat: string;
  pos: PosKey;
  path: CareerPath;
}
