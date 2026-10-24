import type { AttrKey, Attrs, AwardKey, FocusKey, PosKey, Role } from "./types";

/* 여러 도메인이 같이 쓰는 기본 상수: 능력치, 포지션, 훈련 초점, 역할, 수상 */

export const START_YEAR = 2027;

/**
 * 밸런스 버전. 리그 평균·진출 기준처럼 같은 플레이라도 결과가 달라지는 값을 바꾸면 올려요.
 * 은퇴 기록에 남고, 온라인 랭킹은 같은 버전끼리 줄을 세워요.
 */
export const RULESET_VERSION = 1;

export const ATTRS: ReadonlyArray<readonly [AttrKey, string]> = [
  ["sht", "슛"],
  ["hdl", "볼 핸들링"],
  ["pas", "패스"],
  ["def", "수비"],
  ["iq", "BQ"],
  ["ath", "운동능력"],
];

export const ATTR_KEYS: AttrKey[] = ATTRS.map(([k]) => k);

export const SHORT: Record<AttrKey, string> = {
  sht: "슛",
  hdl: "볼 핸들링",
  pas: "패스",
  def: "수비",
  iq: "BQ",
  ath: "운동능력",
};

export const POS_KEYS: PosKey[] = ["PG", "SG", "SF", "PF", "C"];

/** 포지션별 오버롤 가중치(합 1.0)와 성인 키 범위(cm). 리바운드는 따로 없고 키·수비·운동능력에서 나와요. */
export const POS: Record<PosKey, { name: string; w: Attrs; h: [number, number] }> = {
  PG: { name: "포인트가드", w: { sht: 0.22, hdl: 0.18, pas: 0.18, def: 0.14, iq: 0.14, ath: 0.14 }, h: [178, 191] },
  SG: { name: "슈팅가드", w: { sht: 0.34, hdl: 0.14, pas: 0.08, def: 0.17, iq: 0.12, ath: 0.15 }, h: [185, 198] },
  SF: { name: "스몰포워드", w: { sht: 0.24, hdl: 0.1, pas: 0.08, def: 0.24, iq: 0.12, ath: 0.22 }, h: [193, 204] },
  PF: { name: "파워포워드", w: { sht: 0.16, hdl: 0.06, pas: 0.08, def: 0.3, iq: 0.16, ath: 0.24 }, h: [199, 208] },
  C: { name: "센터", w: { sht: 0.1, hdl: 0.04, pas: 0.08, def: 0.34, iq: 0.16, ath: 0.28 }, h: [203, 216] },
};

/** 다음 포지션과 전환을 제안하는 키 */
export const POS_GROWTH: Partial<Record<PosKey, [PosKey, number]>> = {
  PG: ["SG", 195],
  SG: ["SF", 201],
  SF: ["PF", 207],
  PF: ["C", 211],
};

export const FOCUS: ReadonlyArray<readonly [FocusKey, string]> = [
  ["bal", "균형"],
  ["sht", "슛"],
  ["hdl", "볼 핸들링"],
  ["pas", "패스"],
  ["def", "수비"],
  ["iq", "BQ"],
  ["ath", "운동능력"],
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
  ["cfmvp", "컨퍼런스 파이널 MVP"],
  ["mvp", "리그 MVP (NBA 외)"],
  ["allleague", "베스트 팀 (퍼스트팀·베스트5)"],
  ["allleague2", "베스트 팀 (세컨드·서드)"],
  ["alldef", "올-디펜시브 팀"],
  ["allstar", "올스타"],
  ["roy", "신인왕"],
  ["allrookie", "올-루키 팀"],
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
  "cfmvp",
  "allleague",
  "allleague2",
  "alldef",
  "allstar",
  "roy",
  "allrookie",
  "dpoy",
  "scoring",
  "sixth",
  "mip",
];
