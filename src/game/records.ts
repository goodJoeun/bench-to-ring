import { sumSeasons, type CareerTotals } from "./career";
import type { Career } from "./types";

/** 실제 통산 기록과 내 선수를 나란히 세우는 기록 리더보드 */
export type RecordGroup = "nba" | "kbl" | "olympics";
export type RecordStat = "pts" | "reb" | "ast";

export interface RealRecord {
  name: string;
  v: number;
  /** 기준 시점에 현역이던 선수: 실제로는 기록이 더 늘어요. */
  active?: boolean;
  /** 국가 같은 보조 정보 */
  note?: string;
}

export interface RecordBoard {
  group: RecordGroup;
  stat: RecordStat;
  title: string;
  unit: string;
  entries: RealRecord[];
}

export const RECORD_GROUPS: ReadonlyArray<{ key: RecordGroup; name: string; asOf: string }> = [
  { key: "nba", name: "NBA", asOf: "NBA 정규리그 · 2025-26 시즌 종료 기준" },
  { key: "kbl", name: "KBL", asOf: "KBL 정규리그 · 2025-26 시즌 종료 기준" },
  { key: "olympics", name: "올림픽", asOf: "올림픽 남자 농구 · 2024 파리 올림픽까지" },
];

export const RECORD_BOARDS: RecordBoard[] = [
  {
    group: "nba",
    stat: "pts",
    title: "통산 득점",
    unit: "점",
    entries: [
      { name: "르브론 제임스", v: 43440, active: true },
      { name: "카림 압둘자바", v: 38387 },
      { name: "칼 말론", v: 36928 },
      { name: "코비 브라이언트", v: 33643 },
      { name: "케빈 듀랜트", v: 32597, active: true },
      { name: "마이클 조던", v: 32292 },
      { name: "덕 노비츠키", v: 31560 },
      { name: "윌트 체임벌린", v: 31419 },
      { name: "제임스 하든", v: 29339, active: true },
      { name: "샤킬 오닐", v: 28596 },
      { name: "카멜로 앤서니", v: 28289 },
      { name: "모제스 말론", v: 27409 },
      { name: "엘빈 헤이즈", v: 27313 },
      { name: "러셀 웨스트브룩", v: 27176 },
      { name: "하킴 올라주원", v: 26946 },
      { name: "더마 드로잔", v: 26711, active: true },
      { name: "오스카 로버트슨", v: 26710 },
      { name: "도미니크 윌킨스", v: 26668 },
      { name: "스테판 커리", v: 26528, active: true },
      { name: "팀 덩컨", v: 26496 },
    ],
  },
  {
    group: "nba",
    stat: "reb",
    title: "통산 리바운드",
    unit: "개",
    entries: [
      { name: "윌트 체임벌린", v: 23924 },
      { name: "빌 러셀", v: 21620 },
      { name: "카림 압둘자바", v: 17440 },
      { name: "엘빈 헤이즈", v: 16279 },
      { name: "모제스 말론", v: 16212 },
      { name: "팀 덩컨", v: 15091 },
      { name: "칼 말론", v: 14968 },
      { name: "로버트 패리시", v: 14715 },
      { name: "케빈 가넷", v: 14662 },
      { name: "드와이트 하워드", v: 14627 },
      { name: "네이트 서먼드", v: 14464 },
      { name: "월트 벨라미", v: 14241 },
      { name: "웨스 언셀드", v: 13769 },
      { name: "하킴 올라주원", v: 13748 },
      { name: "샤킬 오닐", v: 13099 },
      { name: "벅 윌리엄스", v: 13017 },
      { name: "제리 루카스", v: 12942 },
      { name: "밥 페티트", v: 12849 },
      { name: "찰스 바클리", v: 12546 },
      { name: "디켐베 무톰보", v: 12359 },
    ],
  },
  {
    group: "nba",
    stat: "ast",
    title: "통산 어시스트",
    unit: "개",
    entries: [
      { name: "존 스탁턴", v: 15806 },
      { name: "크리스 폴", v: 12552 },
      { name: "제이슨 키드", v: 12091 },
      { name: "르브론 제임스", v: 12016, active: true },
      { name: "러셀 웨스트브룩", v: 10351 },
      { name: "스티브 내시", v: 10335 },
      { name: "마크 잭슨", v: 10334 },
      { name: "매직 존슨", v: 10141 },
      { name: "오스카 로버트슨", v: 9887 },
      { name: "아이재아 토머스", v: 9061 },
      { name: "게리 페이튼", v: 8966 },
      { name: "제임스 하든", v: 8873, active: true },
      { name: "안드레 밀러", v: 8524 },
      { name: "로드 스트릭랜드", v: 7987 },
      { name: "라존 론도", v: 7584 },
      { name: "모리스 칙스", v: 7392 },
      { name: "레니 윌킨스", v: 7211 },
      { name: "테리 포터", v: 7160 },
      { name: "카일 라우리", v: 7110 },
      { name: "팀 하더웨이", v: 7095 },
    ],
  },
  {
    group: "kbl",
    stat: "pts",
    title: "통산 득점",
    unit: "점",
    entries: [
      { name: "서장훈", v: 13231 },
      { name: "라건아", v: 12163, active: true },
      { name: "애런 헤인즈", v: 10878 },
      { name: "김주성", v: 10288 },
      { name: "추승균", v: 10019 },
    ],
  },
  {
    group: "kbl",
    stat: "reb",
    title: "통산 리바운드",
    unit: "개",
    entries: [
      { name: "라건아", v: 7066, active: true },
      { name: "서장훈", v: 5235 },
      { name: "애런 헤인즈", v: 4442 },
      { name: "김주성", v: 4425 },
    ],
  },
  {
    group: "kbl",
    stat: "ast",
    title: "통산 어시스트",
    unit: "개",
    entries: [
      { name: "주희정", v: 5381 },
      { name: "이상민", v: 3583 },
      { name: "양동근", v: 3344 },
      { name: "신기성", v: 3267 },
      { name: "김승현", v: 3243 },
    ],
  },
  {
    group: "olympics",
    stat: "pts",
    title: "올림픽 통산 득점",
    unit: "점",
    entries: [
      { name: "오스카 슈미트", v: 1093, note: "브라질" },
      { name: "앤드루 게이즈", v: 789, note: "호주" },
      { name: "파우 가솔", v: 649, note: "스페인" },
      { name: "루이스 스콜라", v: 591, note: "아르헨티나" },
      { name: "패티 밀스", v: 567, note: "호주" },
      { name: "블라미르 마르케스", v: 534, note: "브라질" },
      { name: "마누 지노빌리", v: 523, note: "아르헨티나" },
      { name: "케빈 듀랜트", v: 518, note: "미국" },
    ],
  },
];

/** 리그별(NBA·KBL) 정규리그 통산과 올림픽 통산 */
export function careerTotals(c: Career): Record<RecordGroup, CareerTotals> {
  const league = (lg: "nba" | "kbl"): CareerTotals => sumSeasons(c.hist.filter((h) => h.lg === lg));
  // 올림픽은 경기마다 내 득점만 남아요. 실제 기록처럼 본선만 세고, 최종예선과 불참한 대회는 빼요.
  const games = c.natLog.filter((t) => t.ev === "olympics" && t.joined).flatMap((t) => t.games);
  const played = games.filter((g) => g.pts !== undefined && !g.stage.startsWith("최종예선"));
  return {
    nba: league("nba"),
    kbl: league("kbl"),
    olympics: { gp: played.length, pts: played.reduce((t, g) => t + g.pts!, 0), reb: 0, ast: 0 },
  };
}

export interface BoardRow extends RealRecord {
  /** 내 선수가 실제 순위표 밖이면 null */
  rank: number | null;
  mine?: boolean;
}

export interface BoardPlacement {
  rows: BoardRow[];
  /** 내 선수의 역대 순위. 기록이 없거나 순위표 밖이면 null */
  rank: number | null;
  /** 바로 위 실제 선수와 차이. 1위면 null */
  next: { name: string; gap: number } | null;
}

/** 실제 순위표에 내 기록을 끼워 넣어요. 같은 기록이면 공동 순위로, 실제 선수 바로 아래에 둬요. */
export function placeOnBoard(board: RecordBoard, mine: { name: string; v: number }): BoardPlacement {
  const real = board.entries.map((e, i) => ({ ...e, rank: i + 1 }));
  if (mine.v <= 0) return { rows: real, rank: null, next: null };
  const above = board.entries.filter((e) => e.v > mine.v).length;
  const ties = board.entries.filter((e) => e.v === mine.v).length;
  const at = above + ties;
  const listed = at < board.entries.length || ties > 0;
  const rank = listed ? above + 1 : null;
  const me: BoardRow = { name: mine.name, v: mine.v, rank, mine: true };
  const rows: BoardRow[] = [
    ...real.slice(0, at),
    me,
    // 내 선수보다 아래로 밀린 실제 선수는 순위가 하나씩 내려가요.
    ...real.slice(at).map((e) => ({ ...e, rank: e.rank + 1 })),
  ];
  const target = above ? board.entries[above - 1] : null;
  return { rows, rank, next: target && { name: target.name, gap: target.v - mine.v } };
}
