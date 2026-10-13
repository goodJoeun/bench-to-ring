import type {
  AttrKey,
  Attrs,
  AwardKey,
  FocusKey,
  League,
  LeagueKey,
  Nation,
  PosKey,
  Role,
  Trait,
} from "./types";

export const START_YEAR = 2027;

export const ATTRS: ReadonlyArray<readonly [AttrKey, string]> = [
  ["sht", "슈팅"],
  ["hdl", "핸들링·패스"],
  ["def", "수비"],
  ["reb", "리바운드"],
  ["ath", "운동능력"],
  ["iq", "BQ"],
];
export const ATTR_KEYS: AttrKey[] = ATTRS.map(([k]) => k);
export const SHORT: Record<AttrKey, string> = {
  sht: "슈팅",
  hdl: "핸들링",
  def: "수비",
  reb: "리바운드",
  ath: "운동능력",
  iq: "BQ",
};

export const POS_KEYS: PosKey[] = ["PG", "SG", "SF", "PF", "C"];

/** 포지션별 오버롤 가중치(합 1.0)와 성인 키 범위(cm) */
export const POS: Record<PosKey, { name: string; w: Attrs; h: [number, number] }> = {
  PG: { name: "포인트가드", w: { sht: 0.22, hdl: 0.32, def: 0.14, reb: 0.04, ath: 0.14, iq: 0.14 }, h: [178, 191] },
  SG: { name: "슈팅가드", w: { sht: 0.34, hdl: 0.18, def: 0.16, reb: 0.05, ath: 0.15, iq: 0.12 }, h: [185, 198] },
  SF: { name: "스몰포워드", w: { sht: 0.24, hdl: 0.14, def: 0.2, reb: 0.12, ath: 0.18, iq: 0.12 }, h: [193, 204] },
  PF: { name: "파워포워드", w: { sht: 0.14, hdl: 0.08, def: 0.22, reb: 0.26, ath: 0.18, iq: 0.12 }, h: [199, 208] },
  C: { name: "센터", w: { sht: 0.06, hdl: 0.06, def: 0.26, reb: 0.32, ath: 0.18, iq: 0.12 }, h: [203, 216] },
};

/** 다음 포지션과 전환을 제안하는 키 */
export const POS_GROWTH: Partial<Record<PosKey, [PosKey, number]>> = {
  PG: ["SG", 195],
  SG: ["SF", 201],
  SF: ["PF", 207],
  PF: ["C", 211],
};

export const ARCHETYPES: Record<PosKey, { name: string; e: Partial<Attrs> }[]> = {
  PG: [
    { name: "플로어 제너럴", e: { hdl: 1.35, iq: 1.3 } },
    { name: "스코어링 가드", e: { sht: 1.35, ath: 1.2 } },
    { name: "락다운 가드", e: { def: 1.45, ath: 1.2 } },
  ],
  SG: [
    { name: "퓨어 슈터", e: { sht: 1.45, iq: 1.1 } },
    { name: "슬래셔", e: { ath: 1.45, hdl: 1.15 } },
    { name: "3&D 윙", e: { sht: 1.2, def: 1.35 } },
  ],
  SF: [
    { name: "투웨이 포워드", e: { def: 1.3, sht: 1.2 } },
    { name: "포인트 포워드", e: { hdl: 1.4, iq: 1.2 } },
    { name: "하이플라이어", e: { ath: 1.5, reb: 1.1 } },
  ],
  PF: [
    { name: "스트레치 빅", e: { sht: 1.5, iq: 1.1 } },
    { name: "파워 포워드", e: { reb: 1.25, ath: 1.25 } },
    { name: "수비형 빅", e: { def: 1.4, reb: 1.15 } },
  ],
  C: [
    { name: "림 프로텍터", e: { def: 1.4, ath: 1.15 } },
    { name: "포스트 스코어러", e: { sht: 1.4, reb: 1.1 } },
    { name: "패싱 센터", e: { hdl: 1.5, iq: 1.35 } },
  ],
};

export const TRAITS: Record<Trait, string> = {
  조기성장: "어릴 때 빠르게 크지만 20대 중반부터 성장이 둔해져요.",
  대기만성: "10대에는 더디지만 20대에 크게 성장하고 노화도 늦어요.",
  꾸준함: "시즌마다 기복이 적고 성장이 조금 더 안정적이에요.",
  강철몸: "부상이 적고 30대에도 능력치가 천천히 떨어져요.",
  유리몸: "부상이 잦아요. 회복 훈련을 자주 챙기세요.",
  승부사: "큰 경기에 강해요. 우승과 파이널 MVP 확률이 올라가요.",
};
export const TRAIT_KEYS = Object.keys(TRAITS) as Trait[];

export const NATIONS: Nation[] = [
  { name: "대한민국", str: 2, threshold: 64, continentalBonus: 3 },
  { name: "일본", str: 2, threshold: 64, continentalBonus: 3 },
  { name: "필리핀", str: 2, threshold: 63, continentalBonus: 3 },
  { name: "중국", str: 3, threshold: 66, continentalBonus: 3 },
  { name: "호주", str: 5, threshold: 72, continentalBonus: 1 },
  { name: "캐나다", str: 7, threshold: 79, continentalBonus: 1 },
  { name: "미국", str: 10, threshold: 86, continentalBonus: 0 },
  { name: "프랑스", str: 7, threshold: 79, continentalBonus: 1 },
  { name: "스페인", str: 6, threshold: 77, continentalBonus: 1 },
  { name: "세르비아", str: 6, threshold: 77, continentalBonus: 1 },
];

export const LEAGUES: Record<LeagueKey, League> = {
  hs: { name: "고교리그", short: "고교", avg: 50, games: 24, pro: false },
  kcol: { name: "국내 대학리그", short: "국내대학", avg: 56, games: 20, pro: false },
  ucol: { name: "해외 대학리그", short: "해외대학", avg: 61, games: 32, pro: false },
  court: { name: "코트리그", short: "코트리그", avg: 65, games: 54, pro: true },
  dev: { name: "GBL 디벨럽먼트", short: "디벨럽", avg: 67, games: 48, pro: true },
  cont: { name: "콘티넨탈리그", short: "콘티넨탈", avg: 70, games: 38, pro: true },
  gbl: { name: "그랜드리그", short: "GBL", avg: 75, games: 82, pro: true },
};

/** 모든 리그와 구단은 가상이에요. [이름, 대표색] */
export const TEAMS: Record<LeagueKey, ReadonlyArray<readonly [string, string]>> = {
  hs: [
    ["한빛고", "#2453A6"],
    ["청솔고", "#1D7A4F"],
    ["백송고", "#8A2236"],
    ["해오름고", "#C9620F"],
    ["가람고", "#4E3D91"],
    ["새벽고", "#0E6F80"],
  ],
  kcol: [
    ["한강대", "#2453A6"],
    ["동해대", "#0F6B7A"],
    ["서해대", "#A8321F"],
    ["백두대", "#3A3F48"],
    ["남산대", "#6B4BB0"],
  ],
  ucol: [
    ["노스리지대", "#21447A"],
    ["써던파인스대", "#1D6B3C"],
    ["레이크사이드 주립대", "#8A1C2B"],
    ["웨스트필드대", "#C46A00"],
    ["코스탈벨대", "#00739A"],
    ["하이플레인스대", "#5B3A8C"],
  ],
  court: [
    ["서울 블루윙스", "#2453A6"],
    ["부산 하버스톰", "#0B6D8A"],
    ["인천 시호크스", "#2A2A6E"],
    ["대구 파이어볼", "#C0392B"],
    ["광주 라이트닝", "#C99A00"],
    ["울산 아이언웨일", "#3C4A5C"],
    ["원주 마운틴베어", "#6B4423"],
    ["안양 레드폭스", "#B5401C"],
    ["전주 그린바이퍼", "#2F7D32"],
    ["창원 블레이즈", "#D9561A"],
  ],
  dev: [
    ["리버포트 러너스", "#4A5AA8"],
    ["파인크릭 레인저스", "#2F6F4F"],
    ["아이언데일 스파크", "#B0451C"],
    ["미스트밸리 오터스", "#2D6E8A"],
  ],
  cont: [
    ["리스본 아틀란티코", "#0B5D8A"],
    ["밀라노 노르드", "#8A1C2B"],
    ["아테네 올림포스", "#1D3D8A"],
    ["이스탄불 보스포루스", "#C0392B"],
    ["빌뉴스 앰버", "#B07A00"],
    ["리옹 루미에르", "#5A2D82"],
  ],
  gbl: [
    ["뉴하버 타이탄즈", "#1F3A8A"],
    ["골드코스트 써지", "#D08000"],
    ["레이크뷰 코메츠", "#0B7A8A"],
    ["시에라 울브스", "#4B4F58"],
    ["메트로 펄스", "#C0262D"],
    ["썬밸리 플레어", "#E0561A"],
    ["그레이락 가디언스", "#2F5D3A"],
    ["베이시티 노바", "#5B2B8C"],
    ["프레리 스톰", "#3A4F8A"],
    ["아이언포트 해머스", "#8A3A1C"],
    ["코럴베이 돌핀스", "#0A8A7A"],
    ["노던 라이츠", "#264A6E"],
  ],
};

export const SKINS = ["#F2D0B1", "#E3B58F", "#C68E63", "#8D5A3B", "#5E3A24"];
export const HAIRS = ["#1B1B1B", "#3B2A1E", "#6B4A2E", "#B8914F", "#2B2B44"];

export const FOCUS: ReadonlyArray<readonly [FocusKey, string]> = [
  ["bal", "균형"],
  ["sht", "슈팅"],
  ["hdl", "핸들링·패스"],
  ["def", "수비"],
  ["reb", "리바운드"],
  ["ath", "운동능력"],
  ["iq", "BQ"],
  ["rest", "회복"],
];

export const ROLE_RANK: Record<Role, number> = {
  "엔드 오브 벤치": 0,
  벤치: 1,
  로테이션: 2,
  식스맨: 3,
  주전: 4,
  에이스: 5,
};

export const AWARDS: ReadonlyArray<readonly [AwardKey, string]> = [
  ["mvp_gbl", "GBL MVP"],
  ["ring", "프로 우승 반지"],
  ["fmvp", "파이널 MVP"],
  ["mvp", "리그 MVP (GBL 외)"],
  ["allleague", "베스트 팀 선정"],
  ["allstar", "올스타"],
  ["roy", "신인왕"],
  ["dpoy", "올해의 수비수"],
  ["scoring", "득점왕"],
  ["sixth", "식스맨상"],
  ["mip", "기량발전상"],
  ["title", "아마추어 우승"],
  ["nat_gold", "국가대표 금메달"],
  ["nat_silver", "국가대표 은메달"],
  ["nat_bronze", "국가대표 동메달"],
];

export const PERSONAL_AWARDS: AwardKey[] = [
  "mvp_gbl",
  "mvp",
  "fmvp",
  "allleague",
  "allstar",
  "roy",
  "dpoy",
  "scoring",
  "sixth",
  "mip",
];

/** 득점왕 후보가 되는 경기당 득점 */
export const SCORING_TITLE: Record<LeagueKey, number> = {
  hs: 24,
  kcol: 22,
  ucol: 21,
  court: 23,
  dev: 23,
  cont: 20,
  gbl: 28,
};

/** 16x24 도트 캐릭터. H 머리, S 피부, E 눈, J 유니폼, j 목선, n 등번호, W 반바지, K 신발, k 밑창, B/b 공 */
export const SPRITE = [
  "......HHHH......",
  ".....HHHHHH.....",
  ".....HSSSSH.....",
  ".....SESSES.....",
  ".....SSSSSS.....",
  "......SSSS......",
  ".......SS.......",
  "....JJJjjJJJ....",
  "...JJJJJJJJJJ...",
  "...SJJJJJJJJS...",
  "...SJJJnnJJJS...",
  "...SJJJnnJJJS...",
  "...SJJJJJJJJSBB.",
  "....JJJJJJJJBbBB",
  "....WWWWWWWWBBbB",
  "....WWWWWWWW.BB.",
  "....WWW..WWW....",
  ".....SS..SS.....",
  ".....SS..SS.....",
  ".....SS..SS.....",
  ".....SS..SS.....",
  ".....SS..SS.....",
  "....KKK..KKK....",
  "....kkk..kkk....",
];
