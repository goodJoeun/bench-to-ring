import { queryOptions } from "@tanstack/react-query";
import type { PosKey } from "@/game";
import { fetchAchievementRates, fetchAround, fetchBoard, fetchBoardDays, fetchChallenge, fetchMine, fetchMyChallenge, fetchStatBoard } from "./client";
import { leaderboardKeys } from "./keys";
import type { BoardDay, StatKey } from "./types";

// 온라인 랭킹을 부르는 쿼리. 같은 순위표는 어느 화면(명예의 전당, 랭킹)에서 불러도 한 번만 부르고 함께 써요.

/** 순위표(역대 전체 룰셋). 날짜를 주면 그날 올라온 기록끼리, 포지션을 주면 그 포지션끼리예요. */
export const boardQuery = (day: BoardDay = null, pos: PosKey | null = null) =>
  queryOptions({ queryKey: leaderboardKeys.board(day, pos), queryFn: () => fetchBoard("all", pos, day) });

/** 스탯 랭킹(프로 통산 상위 50명) */
export const statQuery = (day: BoardDay, stat: StatKey) =>
  queryOptions({ queryKey: leaderboardKeys.stat(day, stat), queryFn: () => fetchStatBoard(stat, "all", day) });

/** 업적 달성률. 기록이 올라가면 다른 순위표와 함께 낡은 것으로 쳐요. */
export const achievementRatesQuery = () => queryOptions({ queryKey: leaderboardKeys.achievements(), queryFn: fetchAchievementRates });

/** 날짜별 랭킹 등록 수 */
export const boardDaysQuery = () => queryOptions({ queryKey: leaderboardKeys.days(), queryFn: fetchBoardDays });

/** 이 브라우저가 올린 기록의 지금 순위. 올린 적이 없으면 null이에요. */
export const mineQuery = () => queryOptions({ queryKey: leaderboardKeys.mine(), queryFn: fetchMine });

/** 내 기록 하나와 바로 위아래 기록. '주변 순위'를 열었을 때만 불러요. */
export const aroundQuery = (careerId: string) =>
  queryOptions({ queryKey: leaderboardKeys.around(careerId), queryFn: () => fetchAround(careerId) });

/** 그날(한국 시간) 챌린지의 포지션별 순위표. 날짜를 아직 모르면(서버 렌더링) 부르지 않아요. */
export const challengeQuery = (day: string) =>
  queryOptions({ queryKey: leaderboardKeys.challenge(day), queryFn: () => fetchChallenge(day), enabled: !!day });

/** 이 브라우저의 그날 챌린지 성적. 올린 적이 없으면 null이에요. */
export const myChallengeQuery = (day: string) =>
  queryOptions({ queryKey: leaderboardKeys.myChallenge(day), queryFn: () => fetchMyChallenge(day), enabled: !!day });
