import type {
  AttrKey,
  Attrs,
  AwardKey,
  FocusKey,
  League,
  LeagueKey,
  Nation,
  PosKey,
  Region,
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
  { name: "대한민국", str: 2, threshold: 64, region: "asia", continentalBonus: 3 },
  { name: "일본", str: 2, threshold: 64, region: "asia", continentalBonus: 3 },
  { name: "필리핀", str: 2, threshold: 63, region: "asia", continentalBonus: 3 },
  { name: "중국", str: 3, threshold: 66, region: "asia", continentalBonus: 3 },
  { name: "호주", str: 5, threshold: 72, region: "asia", continentalBonus: 3 },
  { name: "캐나다", str: 7, threshold: 79, region: "americas", continentalBonus: 2 },
  { name: "미국", str: 10, threshold: 86, region: "americas", continentalBonus: 1 },
  { name: "프랑스", str: 7, threshold: 79, region: "europe", continentalBonus: 1 },
  { name: "스페인", str: 6, threshold: 77, region: "europe", continentalBonus: 1 },
  { name: "세르비아", str: 6, threshold: 77, region: "europe", continentalBonus: 1 },
];

export const CONTINENTAL_CUP: Record<Region, string> = {
  asia: "FIBA 아시아컵",
  europe: "유로바스켓",
  americas: "FIBA 아메리컵",
};

export const LEAGUES: Record<LeagueKey, League> = {
  hs: { name: "고교농구", short: "고교", avg: 50, games: 24, pro: false },
  kuniv: { name: "대학농구 U-리그", short: "U-리그", avg: 56, games: 16, pro: false },
  ncaa: { name: "NCAA 디비전 I", short: "NCAA", avg: 61, games: 32, pro: false },
  kbl: { name: "KBL", short: "KBL", avg: 65, games: 54, pro: true },
  gleague: { name: "NBA G리그", short: "G리그", avg: 67, games: 50, pro: true },
  euro: { name: "유로리그", short: "유로리그", avg: 70, games: 38, pro: true },
  nba: { name: "NBA", short: "NBA", avg: 75, games: 82, pro: true },
};

/**
 * 실제 리그와 구단이에요. [한국어 이름, 대표색]
 * 명칭의 권리는 각 권리자에게 있어요. 로고는 쓰지 않아요.
 * 2026-27 시즌 기준이고, 구단 변동이 생기면 여기만 고치면 돼요.
 */
export const TEAMS: Record<LeagueKey, ReadonlyArray<readonly [string, string]>> = {
  hs: [
    ["용산고", "#1C4E9C"],
    ["경복고", "#2E7D32"],
    ["휘문고", "#6B2C91"],
    ["삼일상고", "#C8102E"],
    ["낙생고", "#0E6F80"],
    ["홍대부고", "#8B0029"],
    ["안양고", "#1D3D8A"],
    ["송도고", "#00603E"],
    ["제물포고", "#B5401C"],
    ["군산고", "#3A3F48"],
  ],
  kuniv: [
    ["고려대", "#8B0029"],
    ["연세대", "#00205B"],
    ["중앙대", "#1C4E9C"],
    ["경희대", "#A6192E"],
    ["성균관대", "#2E7D32"],
    ["한양대", "#0E4A84"],
    ["동국대", "#E06A10"],
    ["단국대", "#1D3D8A"],
    ["건국대", "#00603E"],
    ["명지대", "#0E2A6B"],
  ],
  ncaa: [
    ["듀크대", "#003087"],
    ["켄터키대", "#0033A0"],
    ["노스캐롤라이나대", "#4B9CD3"],
    ["캔자스대", "#0051BA"],
    ["코네티컷대", "#0E1A3F"],
    ["곤자가대", "#041E42"],
    ["빌라노바대", "#00205B"],
    ["미시간주립대", "#18453B"],
    ["UCLA", "#2D68C4"],
    ["휴스턴대", "#C8102E"],
  ],
  kbl: [
    ["서울 SK 나이츠", "#D7141A"],
    ["서울 삼성 썬더스", "#0047A0"],
    ["창원 LG 세이커스", "#A50034"],
    ["울산 현대모비스 피버스", "#E0561A"],
    ["수원 KT 소닉붐", "#B0141C"],
    ["안양 정관장 레드부스터스", "#C8102E"],
    ["원주 DB 프로미", "#00804A"],
    ["부산 KCC 이지스", "#003A70"],
    ["고양 소노 스카이거너스", "#2E6DB4"],
    ["대구 한국가스공사 페가수스", "#1C4E9C"],
  ],
  gleague: [
    ["산타크루즈 워리어스", "#1D428A"],
    ["사우스베이 레이커스", "#552583"],
    ["웨스트체스터 닉스", "#006BB6"],
    ["메인 셀틱스", "#007A33"],
    ["수폴스 스카이포스", "#D9531A"],
    ["오스틴 스퍼스", "#3A3F48"],
    ["랩터스 905", "#CE1141"],
    ["아이오와 울브스", "#0C2340"],
    ["윈디시티 불스", "#CE1141"],
    ["롱아일랜드 네츠", "#2B2B2B"],
    ["오클라호마시티 블루", "#007AC1"],
    ["스톡턴 킹스", "#5A2D81"],
  ],
  euro: [
    ["레알 마드리드", "#5B3A8C"],
    ["FC 바르셀로나", "#A50044"],
    ["올림피아코스", "#E30613"],
    ["파나티나이코스", "#007A3D"],
    ["페네르바흐체", "#002D72"],
    ["아나돌루 에페스", "#002B5C"],
    ["잘기리스 카우나스", "#006633"],
    ["파르티잔", "#2B2B2B"],
    ["츠르베나 즈베즈다", "#D22630"],
    ["마카비 텔아비브", "#D4A300"],
    ["하포엘 텔아비브", "#E30613"],
    ["바이에른 뮌헨", "#DC052D"],
    ["비르투스 볼로냐", "#2B2B2B"],
    ["올림피아 밀라노", "#C8102E"],
    ["발렌시아 바스켓", "#E07000"],
    ["바스코니아", "#A6192E"],
    ["ASVEL", "#2B2B2B"],
    ["파리 바스켓볼", "#2B2B2B"],
    ["두바이 바스켓볼", "#00843D"],
    ["베식타스", "#2B2B2B"],
  ],
  nba: [
    ["애틀랜타 호크스", "#C8102E"],
    ["보스턴 셀틱스", "#007A33"],
    ["브루클린 네츠", "#2B2B2B"],
    ["샬럿 호네츠", "#1D1160"],
    ["시카고 불스", "#CE1141"],
    ["클리블랜드 캐벌리어스", "#860038"],
    ["댈러스 매버릭스", "#00538C"],
    ["덴버 너기츠", "#0E2240"],
    ["디트로이트 피스톤스", "#C8102E"],
    ["골든스테이트 워리어스", "#1D428A"],
    ["휴스턴 로키츠", "#CE1141"],
    ["인디애나 페이서스", "#002D62"],
    ["LA 클리퍼스", "#C8102E"],
    ["LA 레이커스", "#552583"],
    ["멤피스 그리즐리스", "#5D76A9"],
    ["마이애미 히트", "#98002E"],
    ["밀워키 벅스", "#00471B"],
    ["미네소타 팀버울브스", "#0C2340"],
    ["뉴올리언스 펠리컨스", "#0C2340"],
    ["뉴욕 닉스", "#006BB6"],
    ["오클라호마시티 썬더", "#007AC1"],
    ["올랜도 매직", "#0077C0"],
    ["필라델피아 76ers", "#006BB6"],
    ["피닉스 선즈", "#1D1160"],
    ["포틀랜드 트레일블레이저스", "#E03A3E"],
    ["새크라멘토 킹스", "#5A2D81"],
    ["샌안토니오 스퍼스", "#3A3F48"],
    ["토론토 랩터스", "#CE1141"],
    ["유타 재즈", "#4B2A85"],
    ["워싱턴 위저즈", "#002B5C"],
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
  ["mvp_nba", "NBA MVP"],
  ["ring", "프로 우승 반지"],
  ["fmvp", "파이널 MVP"],
  ["mvp", "리그 MVP (NBA 외)"],
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
  "mvp_nba",
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
  kuniv: 22,
  ncaa: 21,
  kbl: 23,
  gleague: 23,
  euro: 20,
  nba: 28,
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
