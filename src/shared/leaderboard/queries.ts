import { queryOptions } from "@tanstack/react-query";
import type { PosKey } from "@/game";
import { fetchBoard, fetchBoardDays, fetchMine, fetchStatBoard } from "./client";
import { leaderboardKeys } from "./keys";
import type { BoardDay, StatKey } from "./types";

// 온라인 랭킹을 부르는 쿼리. 같은 순위표는 어느 화면(명예의 전당, 랭킹)에서 불러도 한 번만 부르고 함께 써요.

/** 순위표(역대 전체 룰셋). 날짜를 주면 그날 올라온 기록끼리, 포지션을 주면 그 포지션끼리예요. */
export const boardQuery = (day: BoardDay = null, pos: PosKey | null = null) =>
  queryOptions({ queryKey: leaderboardKeys.board(day, pos), queryFn: () => fetchBoard("all", pos, day) });

/** 스탯 랭킹(프로 통산 상위 50명) */
export const statQuery = (day: BoardDay, stat: StatKey) =>
  queryOptions({ queryKey: leaderboardKeys.stat(day, stat), queryFn: () => fetchStatBoard(stat, "all", day) });

/** 날짜별 랭킹 등록 수 */
export const boardDaysQuery = () => queryOptions({ queryKey: leaderboardKeys.days(), queryFn: fetchBoardDays });

/** 이 브라우저가 올린 기록의 지금 순위. 올린 적이 없으면 null이에요. */
export const mineQuery = () => queryOptions({ queryKey: leaderboardKeys.mine(), queryFn: fetchMine });
