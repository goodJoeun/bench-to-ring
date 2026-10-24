import type { PosKey } from "@/game";

// 화면과 API가 주고받는 모양

/** POST /api/players */
export interface PlayerCreated {
  token: string;
}

/** POST /api/careers: 같은 룰셋 안의 순위 */
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
  mvp: number;
  peak: number;
  personal: number;
  pts: number;
  reb: number;
  ast: number;
  rings: number;
  seasons: number;
  legacy: string;
  ruleset: number;
  /** 서버 재생 검증 통과 (2단계). 1단계 기록은 모두 false예요. */
  verified: boolean;
}

/** GET /api/boards */
export interface Board {
  scope: BoardScope;
  /** 포지션을 골랐으면 그 포지션 순위표예요. */
  pos: PosKey | null;
  /** 전체 Top 50, 포지션을 골랐으면 그 포지션 Top 20 */
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

export interface ApiError {
  error: string;
}
