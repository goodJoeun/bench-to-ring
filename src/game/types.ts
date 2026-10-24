/*
 * 게임 엔진의 모든 타입. 대부분은 Career와 그 안에 든 값, 곧 저장 데이터의 모양이에요.
 * 저장 코드에 그대로 들어가니, 필드를 바꾸면 storage.ts의 불러오기·마이그레이션도 같이 고쳐야 해요.
 */

/* ---------- 기본 키 ---------- */

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
/** 시즌 투자: 스킬 코치, 피지컬, 회복 관리, 영양, 영상 분석 */
export type InvestKey = "coach" | "gym" | "rehab" | "diet" | "video";
/** 상점 상품 키 (shop.ts의 SHOP 목록) */
export type ShopKey = string;
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
  /** 베스트 팀 세컨드·서드팀 */
  | "allleague2"
  | "alldef"
  | "allrookie"
  /** NBA 컨퍼런스 파이널 MVP */
  | "cfmvp"
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

/* ---------- 리그 · 팀 · 국가 ---------- */

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

/* ---------- 선수 ---------- */

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

/* ---------- 시즌 · 경기 기록 ---------- */

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
  /** 이 시즌에 비용을 내고 한 투자 */
  invest?: InvestKey[];
}

/* ---------- 진행 중인 시즌 ---------- */

/** 정규시즌 한 경기 */
export interface GameLine {
  /** 몇 번째 경기 (1부터) */
  n: number;
  opp: string;
  us: number;
  them: number;
  win: boolean;
  /** 내 기록. 결장했으면 없어요. */
  me?: { min: number; pts: number; reb: number; ast: number; rating: number };
  /** 결장 사유: 부상, 휴식, 합류 전 */
  out?: string;
  /** 클러치 상황에서 내가 마지막 플레이를 맡은 경기 */
  clutch?: "win" | "loss";
}

/** 플레이오프(전국대회) 한 라운드 */
export interface PostRound {
  /** 플레이오프 1라운드, 전국대회 4강, NBA 파이널… */
  name: string;
  opp: string;
  /** 상대 팀 색 (결승 중계용) */
  color: string;
  win: boolean;
  /** 시리즈 성적 "4-2" 또는 단판 점수 "78-71" */
  score: string;
}

/** 내가 뛴 경기 기록 합계 */
export interface SeasonTotals {
  gp: number;
  min: number;
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  rating: number;
}

/**
 * 진행 중인 시즌. 시즌을 시작하면 생기고, 결산하면 사라져요.
 * 팀 성적·부상처럼 밸런스를 좌우하는 값은 시작할 때 정해 두고, 경기마다 하나씩 풀어 보여줘요.
 * 시즌 중 이벤트는 내 경기력(폼)과 결장에만 영향을 줘요.
 */
export interface SeasonRun {
  year: number;
  /** pre 프리시즌, reg 정규시즌, post 플레이오프, end 결산 대기 */
  phase: "pre" | "reg" | "post" | "end";
  /** 팀이 없는 시즌(무소속·군 복무)은 경기 대신 이 일정을 한 칸씩 진행해요. */
  plan: string[];
  /** plan에서 진행한 칸 수 */
  step: number;
  /** 시즌을 시작할 때의 오버롤(반올림 전) */
  ovr0: number;
  /** 시즌을 시작할 때 인정된 히든 스탯(키)과 평가 오버롤 보너스 */
  spec: string[];
  bonus: number;
  /** 이번 시즌에 비용을 내고 한 투자 */
  inv: InvestKey[];
  /** 정규시즌 경기 수와 치른 경기 수 */
  games: number;
  g: number;
  w: number;
  l: number;
  /** 정규시즌에 거둘 승수. 남은 승수를 남은 경기에 무작위로 나눠요. */
  wins: number;
  /** 예상 출전 시간, 기본 평점, 예상 출전 시간만큼 뛸 때의 경기당 기록, 야투율 */
  min: number;
  rating: number;
  mean: { pts: number; reb: number; ast: number; stl: number; blk: number };
  fg: number;
  /** 경기력 (-2~2). 시즌 중 이벤트로 오르내리고 기록·평점에 반영돼요. */
  form: number;
  /** 남은 결장 경기와 사유 */
  out: number;
  outWhy: string;
  /** 시즌 중 이벤트를 확인할 경기 번호 */
  checks: number[];
  /** 빅매치(뛸지 말지 고르는 경기)를 확인할 경기 번호 */
  bigs: number[];
  /** 결승 전에 출전 여부를 이미 물었는지 */
  clutch: boolean;
  /** 클러치 상황을 확인할 경기 번호 (주전 이상일 때만) */
  shots: number[];
  /** 클러치 결과로 정해진 다음 경기 결과 */
  forced: "win" | "loss" | null;
  /** 전역 후 합류하는 시즌 */
  back: boolean;
  tot: SeasonTotals;
  /** 최근 경기 (최신이 앞) */
  log: GameLine[];
  /** 정규시즌 결과로 정한 플레이오프 라운드와 공개한 수 */
  post: PostRound[];
  shown: number;
  /** 시즌 최종 성적 문구와 우승 여부. 정규시즌이 끝나면 정해져요. */
  result: string;
  champ: boolean;
  final: FinalSummary | null;
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

/* ---------- 병역 ---------- */

/** 축하 팝업 한 장: 우승, 금메달, NBA 첫 입성, NBA MVP, 파이널 MVP */
export interface Cheer {
  kind: "title" | "gold" | "nba" | "mvp" | "fmvp";
  /** 큰 글씨: "NBA 우승", "NBA 입성" */
  title: string;
  /** 작은 글씨: 팀, 시즌, 기록 */
  sub: string;
  year: number;
  /** 유니폼 색. 모르면 null */
  color: string | null;
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

/* ---------- 결정과 선택지 ---------- */

/** 신청할 수 있는 드래프트 */
export type DraftKey = "nba" | "kbl";

export type Action =
  | { k: "school"; lg: LeagueKey; team: Team; walk?: boolean }
  | { k: "stay" }
  | { k: "draft"; d: DraftKey }
  /** 계약. deal이면 협상을 마친 조건이라 바로 서명해요. */
  | { k: "sign"; lg: ProLeagueKey; team: Team; years: number; salary: number; deal?: boolean }
  /**
   * 연봉 인상 요구: 확률 p로 salary×ask에 서명해요. 실패하면 원래 조건에 서명하거나(walk 없음),
   * 구단이 협상을 끝내고 walk에 남은 다른 제안으로 돌아가요.
   */
  | { k: "nego"; lg: ProLeagueKey; team: Team; years: number; salary: number; ask: number; p: number; walk?: DecisionOption[] }
  /** 위약금을 내고 계약을 해지해 FA가 돼요. */
  | { k: "buyout"; cost: number }
  | { k: "skip" }
  | { k: "pos"; pos: PosKey }
  | ({ k: "boost" } & Boost)
  /** 확률 p로 win, 아니면 lose 효과가 나요. */
  | { k: "gamble"; p: number; win: Boost; lose: Boost }
  /** 클러치: 확률 p로 성공하면 다음 경기를 이기고 attr이 올라요. 실패하면 져요. play는 소식에 쓰는 플레이 이름 */
  | { k: "clutch"; attr: AttrKey; p: number; play: string }
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
  /** 시즌 중에만: 남은 경기의 경기력(폼) 변화 */
  form?: number;
  /** 시즌 중에만: 쉬는 경기 수. 음수면 결장 경기가 줄어요. */
  sit?: number;
  /** 시즌 중에만: 다쳐서 빠지는 경기 수 */
  injure?: number;
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

/* ---------- 소식 · 수상 · 드래프트 · 계약 ---------- */

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

/* ---------- 커리어 ---------- */

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
  /** 기부한 돈 합계 (억). 예전 기록에는 없어요. */
  donated?: number;
  /** 유소년 아카데미를 세웠는지 (예전 기록) */
  academy?: boolean;
  /** 은퇴 기록에 남는 산 것들 (아카데미, 재단 등) */
  legacyItems?: string[];
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
  /** 아직 보여주지 않은 축하 팝업 (오래된 것부터) */
  cheers: Cheer[];
  /** 한 번만 축하하는 순간을 이미 겪었는지 (예: "nba" 첫 입성) */
  milestones: string[];
  /** 가장 최근 드래프트의 지명 순서 */
  draftShow: DraftShow | null;
  /** 다음 시즌에 할 투자 (고른 순서). 시즌을 시작할 때 비용을 내요. */
  invest: InvestKey[];
  /** 투자·구입·기부로 쓴 돈 합계 (억). earnings는 지금 가진 돈이에요. */
  spent: number;
  /** 진행 중인 시즌. 시즌과 시즌 사이(오프시즌)에는 null이에요. */
  run: SeasonRun | null;
  /** 산 것들 (산 순서). 일회성 상품은 남지 않아요. */
  owned: ShopKey[];
  /** 이번 시즌 상점 진열과 이번 시즌에 산 진열 상품. 시즌이 바뀌면 새로 골라요. */
  shop: { year: number; keys: ShopKey[]; bought: ShopKey[] } | null;
  /** 기부한 돈 합계 (억) */
  donated: number;
  /** 마지막으로 이적을 요청한 오프시즌 (다음 시즌 연도) */
  moveAsked: number | null;
}

export interface NewCareerInput {
  name: string;
  num: number;
  /** 국적. 게임에서는 대한민국으로 고정이라 생략해요. 엔진 테스트에서만 다른 나라를 넣어요. */
  nat?: string;
  pos: PosKey;
  path: CareerPath;
  /** 입학할 고등학교 (TEAMS.hs의 이름). 없으면 무작위로 정해요. */
  school?: string;
}
