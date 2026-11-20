import type { DraftKey, LeagueKey, ProLeagueKey } from "../core/types";

/*
 * 국적별 농구 진로. 고교(유소년)를 마친 뒤 어느 대학 리그와 프로 리그로 이어지는지를 나라마다 실제에 가깝게 정해요.
 *
 * - 대한민국: 대학 U-리그 → KBL 신인드래프트(고졸 얼리 가능). 해외는 B.리그·호주 NBL의 아시아쿼터.
 * - 일본: 대학(관동대학리그·인칼레) → B.리그 드래프트(2026년 1월 첫 시행). 고졸 프로도 드래프트로 가요.
 * - 필리핀: 대학(UAAP) → PBA 신인드래프트. 대학을 마치고 B.리그·KBL 아시아쿼터로 나가는 선수가 많아요.
 * - 중국: 구단 청소년팀이나 대학(CUBAL) → CBA 신인드래프트. 요즘 지명 선수의 절반 넘게가 대학 출신이에요.
 * - 호주: 자국 대학 리그가 없어요. 대부분 NCAA로 가고, 일부는 NBL 육성 선수·Next Stars 계약으로 바로 프로가 돼요.
 *   아시아에서 농구를 가장 잘하는 나라라서 NBL이 아시아에서 가장 높고, 대신 호주 선수는 어릴 때 더 빨리 커요(youth).
 *
 * - 프랑스·스페인·세르비아: 대학 리그도 신인드래프트도 없어요. 구단 유소년에서 자라 18세 무렵 구단과 유스(에스푸아) 계약이나 프로 계약을 맺고,
 *   U21·2군 경기를 뛰며 1군에 올라가요. 요즘은 NCAA로 건너가는 유망주도 많아요. 자국 리그에서 잘하면 유로리그 구단이 불러요.
 *   프랑스는 LNB 엘리트, 스페인은 리가 ACB, 세르비아는 옛 유고 나라들이 함께 치르는 아드리아틱 ABA 리그예요.
 *   셋 다 농구 강국이라 자국 리그가 높고, 대신 선수는 어릴 때 더 빨리 커요(youth).
 *
 * - 미국: 고교를 마치면 NCAA로 가요. NBA 드래프트에서 지명받지 못하면 G리그에서 콜업을 노리거나,
 *   다른 나라 리그의 외국선수(KBL·B.리그·CBA·PBA·호주 NBL·유럽 리그·캐나다 CEBL)로 뛰어요. 자국 리그 자리에는 G리그를 둬요.
 * - 캐나다: 유망주는 대부분 미국 프렙 스쿨과 NCAA로 가요. 자국 대학 U 스포츠를 거쳐 여름 리그 CEBL에서 프로가 되는 길도 있어요.
 *   CEBL은 2026년부터 드래프트 대신 구단이 대학 선수와 바로 계약해요(사이닝 데이). 캐나다 선수도 다른 나라 리그의 외국선수로 나가요.
 */
export interface NationPath {
  /** 자국 대학 리그. 없으면 고교를 마치고 NCAA나 프로로 가요. */
  college: LeagueKey | null;
  /** 자국 프로 리그 */
  pro: ProLeagueKey;
  /** 자국 프로 리그의 신인드래프트. 없으면 구단과 바로 계약해요. */
  draft: Exclude<DraftKey, "nba"> | null;
  /** 미국 대학이 주된 진학로인지. 그러면 NCAA가 장학생·워크온 기준으로 열리고, 워크온은 언제나 받아 줘요. */
  ncaa: boolean;
  /** 아시아쿼터(외국선수와 따로 두는 아시아 선수 자리)로 갈 수 있는 다른 나라 리그 */
  quota: ProLeagueKey[];
  /**
   * 외국선수 자리로 갈 수 있는 다른 나라 리그. 북미 선수는 세계 어느 리그에서나 외국선수로 뛰어요.
   * 외국선수는 구단마다 두세 명뿐이라 주전급이어야 제안이 와요(decisions.ts의 IMPORT_BELOW).
   */
  imports: ProLeagueKey[];
  /**
   * 유소년·청소년 육성 환경: YOUTH_AGE세까지 성장에 곱하는 배율이에요. 보통은 1이에요.
   * 호주는 아시아에서 농구를 가장 잘하는 나라예요. 국립 센터 오브 엑설런스(CoE)와 주(州) 리그에서 어릴 때부터 성인과 부딪치며 커서
   * NBA 선수를 꾸준히 내요. 대신 자국 리그(NBL)가 아시아에서 가장 높아서, 이만큼 커야 자국에서 주전으로 뛰어요.
   * 프랑스(INSEP·구단 양성소), 스페인(칸테라), 세르비아(구단 유소년)도 10대부터 프로 구단에서 키우는 농구 강국이라 같은 식이에요.
   * 미국(AAU·프렙 스쿨)은 경쟁이 가장 치열한 농구 종주국이고, 캐나다 유망주도 그 무대에서 함께 자라요.
   */
  youth: number;
}

/** 육성 환경 배율(NationPath.youth)을 받는 마지막 나이 */
export const YOUTH_AGE = 22;

/** 북미 선수를 외국선수로 영입하는 리그 */
const IMPORT_LEAGUES: ProLeagueKey[] = ["pba", "kbl", "cba", "bleague", "aba", "lnb", "acb", "nbl"];

const KOREA: NationPath = { college: "kuniv", pro: "kbl", draft: "kbl", ncaa: false, quota: ["bleague", "nbl"], imports: [], youth: 1 };

const PATHS: Record<string, NationPath> = {
  대한민국: KOREA,
  일본: { college: "juniv", pro: "bleague", draft: "bleague", ncaa: false, quota: ["kbl", "nbl"], imports: [], youth: 1 },
  필리핀: { college: "uaap", pro: "pba", draft: "pba", ncaa: false, quota: ["bleague", "kbl"], imports: [], youth: 1 },
  중국: { college: "cubal", pro: "cba", draft: "cba", ncaa: false, quota: ["bleague", "nbl"], imports: [], youth: 1 },
  호주: { college: null, pro: "nbl", draft: null, ncaa: true, quota: [], imports: [], youth: 1.25 },
  프랑스: { college: null, pro: "lnb", draft: null, ncaa: true, quota: [], imports: [], youth: 1.2 },
  스페인: { college: null, pro: "acb", draft: null, ncaa: true, quota: [], imports: [], youth: 1.25 },
  세르비아: { college: null, pro: "aba", draft: null, ncaa: true, quota: [], imports: [], youth: 1.15 },
  // 미국 선수의 자국 리그는 NBA의 하부 리그인 G리그예요. NBA는 국적과 상관없이 실력으로 가요.
  미국: { college: null, pro: "gleague", draft: null, ncaa: true, quota: [], imports: ["cebl", ...IMPORT_LEAGUES], youth: 1.15 },
  캐나다: { college: "usports", pro: "cebl", draft: null, ncaa: true, quota: [], imports: IMPORT_LEAGUES, youth: 1.05 },
};

/** 표에 없는 국적의 진로: 대한민국 경로에서 아시아쿼터만 빼요. */
const FALLBACK: NationPath = { ...KOREA, quota: [] };

/** 그 국적 선수의 진로 */
export const pathOf = (nat: string): NationPath => PATHS[nat] ?? FALLBACK;

/** 자국 리그가 따로 있는 국적인지 (선수 생성 화면의 안내에 써요) */
export const hasOwnPath = (nat: string): boolean => nat in PATHS;

/** 드래프트 이름 */
export const DRAFT_NAMES: Record<DraftKey, string> = {
  nba: "NBA 드래프트",
  kbl: "KBL 신인드래프트",
  bleague: "B.리그 드래프트",
  pba: "PBA 신인드래프트",
  cba: "CBA 신인드래프트",
};

/** 선수 생성 화면에 보여주는 국적별 진로 한 줄 */
const PATH_HINTS: Record<string, string> = {
  대한민국: "고교 → 대학 U-리그 → KBL 신인드래프트. 실력이 되면 NCAA, 일본 B.리그·호주 NBL 아시아쿼터로도 나가요.",
  일본: "고교 → 일본 대학농구 → B.리그 드래프트. 실력이 되면 NCAA, KBL·호주 NBL 아시아쿼터로도 나가요.",
  필리핀: "고교 → UAAP → PBA 신인드래프트. 실력이 되면 NCAA, B.리그·KBL 아시아쿼터로도 나가요.",
  중국: "고교 → CUBAL → CBA 신인드래프트. 실력이 되면 NCAA, B.리그·호주 NBL 아시아쿼터로도 나가요.",
  프랑스: "농구 강국이에요. 육성 환경이 좋아 22세까지 더 빨리 크고, 자국 리그 LNB도 높아요. 대학 리그가 없어서 구단 유소년을 마치면 LNB 구단과 에스푸아(U21)·프로 계약을 맺거나 NCAA로 가요. 잘하면 유로리그 구단이 불러요.",
  스페인: "농구 강국이에요. 육성 환경이 좋아 22세까지 더 빨리 크고, 자국 리그 ACB는 유럽 자국 리그 가운데 가장 높아요. 대학 리그가 없어서 구단 유소년(칸테라)을 마치면 ACB 구단과 유스·프로 계약을 맺거나 NCAA로 가요. 잘하면 유로리그 구단이 불러요.",
  세르비아: "농구 강국이에요. 육성 환경이 좋아 22세까지 더 빨리 크고, 옛 유고 나라들이 함께 치르는 ABA 리그에서 뛰어요. 대학 리그가 없어서 구단 유소년을 마치면 ABA 구단과 유스·프로 계약을 맺거나 NCAA로 가요. 잘하면 유로리그 구단이 불러요.",
  미국: "농구 종주국이에요. 육성 환경이 좋아 22세까지 더 빨리 크지만, 경쟁이 가장 치열하고 국가대표 문턱도 가장 높아요. 고교를 마치면 NCAA로 가요. NBA 드래프트에서 지명받지 못하면 G리그에서 콜업을 노리거나 KBL·B.리그·CBA·유럽 리그의 외국선수로 뛰어요.",
  캐나다: "농구 강국이에요. 육성 환경이 좋아 22세까지 더 빨리 커요. 고교를 마치면 대부분 NCAA로 가고, 자국 대학 U 스포츠를 거쳐 여름 리그 CEBL에서 프로가 될 수도 있어요. 실력이 되면 다른 나라 리그의 외국선수로도 나가요.",
  호주: "아시아 최강이에요. 육성 환경이 좋아 22세까지 더 빨리 크고, 자국 리그 NBL은 아시아에서 가장 높아요. 대학 리그가 없어서 고교를 마치면 NCAA로 가거나 NBL 육성 선수·Next Stars 계약으로 바로 프로가 돼요.",
};

export const pathHint = (nat: string): string => PATH_HINTS[nat] ?? "";
