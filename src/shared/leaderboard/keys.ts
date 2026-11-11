import type { PosKey } from "@/game";
import type { BoardDay, StatKey } from "./types";

// 온라인 랭킹 쿼리 키. 모두 LEADERBOARD로 시작해서, 기록이 올라가면 한 번에 낡은 것으로 칠 수 있어요.

export const LEADERBOARD = ["leaderboard"] as const;

export const leaderboardKeys = {
  /** 순위표: 날짜(null은 올타임)와 포지션(null은 전체)마다 */
  board: (day: BoardDay, pos: PosKey | null) => [...LEADERBOARD, "board", day ?? "all", pos ?? "all"] as const,
  /** 스탯 랭킹: 날짜와 스탯마다 */
  stat: (day: BoardDay, stat: StatKey) => [...LEADERBOARD, "stat", day ?? "all", stat] as const,
  /** 날짜별 등록 수 */
  days: () => [...LEADERBOARD, "days"] as const,
  /** 이 브라우저가 올린 기록의 순위 */
  mine: () => [...LEADERBOARD, "mine"] as const,
};
