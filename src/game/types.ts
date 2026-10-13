export type AttrKey = "sht" | "hdl" | "def" | "reb" | "ath" | "iq";
export type Attrs = Record<AttrKey, number>;

export type PosKey = "PG" | "SG" | "SF" | "PF" | "C";
export type LeagueKey = "hs" | "kcol" | "ucol" | "court" | "dev" | "cont" | "gbl";
export type ProLeagueKey = "court" | "dev" | "cont" | "gbl";
export type CareerPath = "abroad" | "domestic";
export type Stage = "hs" | "college" | "pro" | "free" | "retired";
export type FocusKey = "bal" | AttrKey | "rest";
export type Trait = "조기성장" | "대기만성" | "꾸준함" | "강철몸" | "유리몸" | "승부사";
export type Grade = "S" | "A" | "B" | "C" | "D";
export type Role = "에이스" | "주전" | "식스맨" | "로테이션" | "벤치" | "엔드 오브 벤치";
export type NewsType = "info" | "good" | "bad" | "award" | "big" | "move";

export type AwardKey =
  | "mvp_gbl"
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
  /** 국가 전력 (1~10) */
  str: number;
  /** 국가대표 발탁 기준 오버롤 */
  threshold: number;
  /** 대륙선수권 보너스 */
  continentalBonus: number;
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
  | { k: "draft"; d: "gbl" | "court" }
  | { k: "sign"; lg: ProLeagueKey; team: Team; years: number; salary: number }
  | { k: "skip" }
  | { k: "pos"; pos: PosKey }
  | {
      k: "boost";
      attrs?: Partial<Attrs>;
      rand?: number;
      amt?: number;
      health?: number;
      money?: number;
      trust?: number;
      msg?: string;
    }
  | { k: "retire" }
  | { k: "none" };

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
  v: 1;
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
  nat: { caps: number };
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
}

export interface NewCareerInput {
  name: string;
  num: number;
  nat: string;
  pos: PosKey;
  path: CareerPath;
}
