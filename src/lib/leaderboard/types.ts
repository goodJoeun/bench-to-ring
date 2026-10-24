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

export interface ApiError {
  error: string;
}
