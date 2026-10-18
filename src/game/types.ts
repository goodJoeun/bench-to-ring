export type AttrKey = "sht" | "hdl" | "pas" | "def" | "iq" | "ath";
export type Attrs = Record<AttrKey, number>;

export type PosKey = "PG" | "SG" | "SF" | "PF" | "C";
/** hs 고교, kuniv 국내 대학(U-리그), ncaa 미국 대학, kbl, gleague NBA G리그, euro 유로리그, nba */
export type LeagueKey = "hs" | "kuniv" | "ncaa" | "kbl" | "gleague" | "euro" | "nba";
export type ProLeagueKey = "kbl" | "gleague" | "euro" | "nba";
export type Region = "asia" | "europe" | "americas";
export type CareerPath = "abroad" | "domestic";
/** military: 상무 또는 현역으로 군 복무 중 */
export type Stage = "hs" | "college" | "pro" | "free" | "military" | "retired";
export type MilitaryKind = "sangmu" | "army";
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
  /** 어울리는 성인 키(cm)와 윙스팬(키 대비 cm) 범위 */
  body?: { h?: [number, number]; wsd?: [number, number] };
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
  /** 군 복무 시즌이면 복무 형태 */
  mil?: MilitaryKind;
  /** 챔피언결정전(결승)에 올랐으면 그 결과 */
  final?: FinalSummary;
}

export interface FinalSummary {
  opp: string;
  us: number;
  them: number;
  win: boolean;
  /** 7전 4선승제 시리즈 성적 (예: "4-2"). 단판이면 없음 */
  series?: string;
}

/** 빠르게 돌려 보는 결승전 한 경기의 문자 중계 */
export interface LiveGame {
  /** 어떤 경기인지: "2034 NBA 파이널 6차전", "2030 아시안게임 결승" */
  title: string;
  /** 같은 해 같은 종류의 경기를 구분해요. 시즌 결승은 league-연도, 국가대표 결승은 nat-연도 */
  key: string;
  us: string;
  them: string;
  usColor: string;
  themColor: string;
  periods: number;
  /** 쿼터 길이(분). FIBA 10분, NBA 12분 */
  periodMin: number;
  plays: LivePlay[];
  win: boolean;
  /** 이 경기 내 선수 기록 */
  mine: { pts: number; reb: number; ast: number };
}

export interface LivePlay {
  q: number;
  /** 쿼터 남은 시간 "7:32" */
  clock: string;
  us: number;
  them: number;
  text: string;
  /** 내 선수의 플레이 */
  mine?: boolean;
  /** 쿼터 종료·경기 종료 */
  mark?: boolean;
}

export interface NatGame {
  /** 조별리그 1차전, 8강, 결승… */
  stage: string;
  opp: string;
  us: number;
  them: number;
  win: boolean;
  /** 대표팀에 합류했을 때 이 경기 내 득점 */
  pts?: number;
}

/** 국가대표 대회 한 번의 기록 */
export interface NatTournament {
  year: number;
  ev: NatEventKey;
  name: string;
  joined: boolean;
  label: string;
  medal: "금" | "은" | "동" | null;
  story: string;
  games: NatGame[];
}

/** 병역. none: 아직, serving: 복무 중, served: 전역, exempt: 병역 특례 */
export interface Military {
  s: "none" | "serving" | "served" | "exempt";
  kind?: MilitaryKind;
  /** 입대 전 상태. 전역하면 되돌려요. */
  prev?: { stage: Stage; team: CurrentTeam | null; contract: Contract | null };
  /** 다음에 입대 결정을 물어볼 나이 */
  ask?: number;
  /** 전역 후 첫 시즌: 시즌 중반에 합류해요. */
  back?: boolean;
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
  /** 병역: 상무 지원, 현역 입대, 입대 연기 */
  | { k: "military"; choice: MilitaryKind | "defer" }
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

/** 드래프트 진행 화면에 보여줄 지명 순서. 결과는 이미 정해져 있어요. */
export interface DraftShow {
  /** 2030 NBA 드래프트 */
  name: string;
  /** 내 선수가 뽑힌 순위. 미지명이면 null */
  mine: number | null;
  /** 스카우트 예상: 1라운드 상위… */
  proj: string;
  /** 스카우트가 예상한 지명 범위. 이 구간에서는 지명을 천천히 보여줘요. */
  range: [number, number];
  /** 한 라운드 지명 수 */
  roundSize: number;
  picks: DraftPick[];
}

export interface DraftPick {
  no: number;
  team: string;
  color: string;
  /** 뽑힌 선수: "C · 듀크대". 내 선수는 이름 */
  who: string;
  mine?: boolean;
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
  /** 대한민국 선수의 병역 */
  mil: Military;
  /** 국가대표 대회 기록 (최근 순 아님, 치른 순서) */
  natLog: NatTournament[];
  /** 아직 보지 않은 결승전 중계. 보여준 뒤에도 다음 결승 전까지 남아 있어요. */
  live: LiveGame | null;
  /** 가장 최근 드래프트의 지명 순서 */
  draftShow: DraftShow | null;
}

export interface NewCareerInput {
  name: string;
  num: number;
  nat: string;
  pos: PosKey;
  path: CareerPath;
  /** 입학할 고등학교 (TEAMS.hs의 이름). 없으면 무작위로 정해요. */
  school?: string;
}
