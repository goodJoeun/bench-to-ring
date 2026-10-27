import type { PosKey } from "@/game";

// 화면과 API가 주고받는 모양

/** POST /api/players */
export interface PlayerCreated {
  token: string;
}

/** POST /api/careers: 역대 전체 순위 */
export interface SubmitResult {
  pos: PosKey;
  rank: number;
  total: number;
  posRank: number;
  posTotal: number;
}

/** GET /api/boards의 범위: 한 룰셋 안 또는 역대 전체 */
export type BoardScope = { ruleset: number } | "all";

/** 순위표의 한 줄. 플레이어 정보는 내보내지 않아요. */
export interface BoardEntry {
  /** 서버의 기록 id (careers.id) */
  id: string;
  /** 같은 범위 안의 전체 순위. 네 값이 모두 같으면 공동 순위예요. */
  rank: number;
  /** 같은 범위·포지션 안의 순위 */
  posRank: number;
  name: string;
  num: number;
  pos: PosKey;
  /** 랭킹 점수 (rankScore) */
  score: number;
  /** NBA MVP */
  mvp: number;
  /** 파이널 MVP (리그를 가리지 않아요) */
  fmvp: number;
  /** NBA 밖 리그의 MVP */
  leagueMvp: number;
  peak: number;
  personal: number;
  pts: number;
  reb: number;
  ast: number;
  rings: number;
  seasons: number;
  legacy: string;
  /** 마지막 소속팀 (유니폼 색) */
  team: string | null;
  /** 도트 캐릭터 색. 예전 기록에는 없어요. */
  look: { skin: string; hair: string } | null;
  ruleset: number;
  /** 서버 재생 검증 통과 (2단계). 1단계 기록은 모두 false예요. */
  verified: boolean;
}

/** GET /api/careers/mine: 이 플레이어가 올린 기록의 지금 순위 (역대 전체) */
export interface MyRanks {
  /** 올라온 전체 기록 수 (역대 전체) */
  total: number;
  careers: {
    /** 브라우저의 커리어 id (CareerSummary.id) */
    careerId: string;
    /** 서버의 기록 id */
    id: string;
    rank: number;
    posRank: number;
    score: number;
  }[];
}

/** GET /api/boards */
export interface Board {
  scope: BoardScope;
  /** 포지션을 골랐으면 그 포지션 순위표예요. */
  pos: PosKey | null;
  /** 전체 Top 100, 포지션을 골랐으면 그 포지션 Top 50 */
  top: BoardEntry[];
  /** 포지션마다 1위 (역대 Best 5). 기록이 없는 포지션은 null이에요. */
  best5: { pos: PosKey; career: BoardEntry | null }[];
  stats: {
    /** 제출된 커리어 수 */
    careers: number;
    /** NBA 팀에서 뛰어 본 커리어 수 */
    nba: number;
    /** NBA MVP를 한 번이라도 받은 커리어 수 */
    nbaMvp: number;
  };
}

/** 스탯 랭킹 종류: 프로 통산 득점·리바운드·어시스트·스틸·블록·3점슛 */
export const STAT_KEYS = ["pts", "reb", "ast", "stl", "blk", "tpm"] as const;
export type StatKey = (typeof STAT_KEYS)[number];

/** 스탯 랭킹의 한 줄 */
export interface StatEntry {
  id: string;
  /** 같은 범위 안의 순위. 값이 같으면 공동 순위예요. */
  rank: number;
  name: string;
  num: number;
  pos: PosKey;
  /** 프로 통산 값 */
  value: number;
  /** 프로 통산 경기 수 */
  gp: number;
  team: string | null;
  look: { skin: string; hair: string } | null;
}

/** GET /api/stats */
export interface StatBoard {
  scope: BoardScope;
  stat: StatKey;
  /** 상위 50명. 스틸·블록·3점슛은 그 기록이 남은 커리어만 세요. */
  top: StatEntry[];
}

export interface ApiError {
  error: string;
}
