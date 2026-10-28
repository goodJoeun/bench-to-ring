"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { bestFive, rankHall, type CareerSummary } from "@/game";
import { boardStale, lastBoard, onBoardChange, refreshBoard } from "@/lib/leaderboard/client";
import type { Board } from "@/lib/leaderboard/types";
import { Best5, HallTable } from "./HallTable";
import { Loading, Panel } from "./ui";

/** 명예의 전당에 보여줄 순위 수 (기본값) */
const ROWS = 30;

/**
 * 명예의 전당. 늘 온라인 랭킹(역대 전체)을 먼저 보여주고, 처음 불러오는 동안에는 로딩 표시를 띄워요.
 * 한 번 불러온 순위표는 기억해 두고 바로 보여줘요. 오래됐으면 보여주면서 뒤에서 새로 불러와 바꿔요.
 * 서버가 안 되거나 응답이 없는데 기억한 순위표도 없으면, 이 브라우저에서 은퇴한 선수들로 줄을 세워 보여줘요.
 */
export function HallOfFame({ hall, rows = ROWS }: { hall: CareerSummary[]; rows?: number }) {
  // undefined: 불러오는 중, null: 불러오지 못함
  const [board, setBoard] = useState<Board | null | undefined>(() => lastBoard() ?? undefined);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    // 처음 열 때 기억한 순위표가 아직 새것이면 다시 부르지 않아요. '다시 불러오기'는 늘 불러요.
    if (attempt === 0 && !boardStale()) return;
    let live = true;
    void refreshBoard().then((b) => {
      // 새로 불러오지 못하면 보여주던 순위표를 그대로 둬요.
      if (live) setBoard((prev) => b ?? (prev || null));
    });
    return () => {
      live = false;
    };
  }, [attempt]);
  // 방금 은퇴한 기록이 서버에 올라가면 보여주던 순위표는 그대로 둔 채 새로 불러와요. 은퇴 화면에서 바로 내 순위가 보여요.
  useEffect(() => onBoardChange(() => setAttempt((n) => n + 1)), []);
  const retry = () => {
    setBoard(undefined);
    setAttempt((n) => n + 1);
  };

  return (
    <Panel title="명예의 전당">
      {board === undefined ? (
        <Loading label="온라인 랭킹을 불러오고 있어요" rows={5} />
      ) : board ? (
        <OnlineHall board={board} rows={rows} />
      ) : (
        <LocalHall hall={hall} rows={rows} onRetry={retry} />
      )}
      <div className="row">
        <Link className="btn" href="/rankings">
          랭킹 페이지에서 더 보기
        </Link>
      </div>
    </Panel>
  );
}

function OnlineHall({ board, rows }: { board: Board; rows: number }) {
  if (!board.top.length)
    return <p className="empty">온라인 랭킹에 올라온 기록이 아직 없어요. 프로 무대를 밟은 선수가 은퇴하면 첫 기록이 돼요.</p>;
  return (
    <>
      <p className="hint">
        온라인 랭킹 · 등록된 커리어 {board.stats.careers}개. NBA MVP·파이널 MVP·우승·수상과 통산 기록을 종합해 순위를 매겨요.
      </p>
      <Best5 items={board.best5} />
      <HallTable rows={board.top.slice(0, rows).map((e) => ({ key: e.id, rank: e.rank, career: e }))} />
    </>
  );
}

function LocalHall({ hall, rows, onRetry }: { hall: CareerSummary[]; rows: number; onRetry: () => void }) {
  return (
    <>
      <div className="row">
        <p className="hint">
          온라인 랭킹에 연결하지 못해 이 브라우저에서 은퇴한 선수들을 보여줘요.
        </p>
        <button type="button" className="btn" onClick={onRetry}>
          다시 불러오기
        </button>
      </div>
      {hall.length ? (
        <>
          <Best5 items={bestFive(hall)} />
          <HallTable rows={rankHall(hall).slice(0, rows).map(({ rank, career }) => ({ key: career.id, rank, career }))} />
        </>
      ) : (
        <p className="empty">이 브라우저에서 은퇴한 선수가 아직 없어요.</p>
      )}
    </>
  );
}
