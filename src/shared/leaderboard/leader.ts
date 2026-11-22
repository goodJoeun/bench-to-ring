import type { ChallengePosBoard } from "./types";

/** 그날 한 포지션의 챌린지 1위. others는 기록이 모두 같아 함께 1위인 나머지 사람 수예요. */
export interface ChallengeLeader {
  name: string;
  others: number;
}

/** 순위표 맨 위가 1위예요. 기록이 아직 없으면 null이에요. */
export function challengeLeader(board: ChallengePosBoard): ChallengeLeader | null {
  const first = board.top[0];
  if (!first) return null;
  return { name: first.name, others: board.top.filter((e) => e.rank === first.rank).length - 1 };
}
