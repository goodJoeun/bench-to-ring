"use client";

import { useEffect, useState } from "react";
import { POS, POS_KEYS, fmtNum, type CareerSummary, type PosKey } from "@/game";
import { fetchBoard } from "@/lib/leaderboard/client";
import type { Board, BoardEntry } from "@/lib/leaderboard/types";
import { Best5, HallTable } from "./HallTable";
import { Segmented, StatTiles } from "./ui";

type PosFilter = PosKey | "all";

const POS_OPTIONS = [
  { key: "all", big: "전체", sm: "Top 50" },
  ...POS_KEYS.map((p) => ({ key: p, big: p, sm: POS[p].name })),
] as const;

const pct = (n: number, total: number) => (total ? `${((n / total) * 100).toFixed(1)}%` : "–");

/**
 * 서버 기록에는 브라우저의 커리어 id가 없어서, 순위에 쓰는 값이 모두 같으면 내 기록으로 봐요.
 * 욕설 필터로 이름이 바뀐 기록은 못 찾아요.
 */
function isMine(e: BoardEntry, hall: CareerSummary[]): boolean {
  return hall.some(
    (h) =>
      h.name === e.name &&
      h.num === e.num &&
      h.pos === e.pos &&
      h.mvp === e.mvp &&
      h.peak === e.peak &&
      h.personal === e.personal &&
      h.pts === e.pts,
  );
}

/** 명예의 전당의 온라인 랭킹: 모든 플레이어가 은퇴하며 올린 기록 (현재 룰셋) */
export function OnlineBoard({ hall }: { hall: CareerSummary[] }) {
  const [pos, setPos] = useState<PosFilter>("all");
  // 한 번 불러온 순위표는 이 화면에 있는 동안 다시 부르지 않아요. null은 불러오지 못한 것이에요.
  const [boards, setBoards] = useState<Partial<Record<PosFilter, Board | null>>>({});
  const loaded = pos in boards;

  useEffect(() => {
    if (loaded) return;
    let live = true;
    void fetchBoard(undefined, pos === "all" ? null : pos).then((b) => {
      if (live) setBoards((m) => ({ ...m, [pos]: b }));
    });
    return () => {
      live = false;
    };
  }, [pos, loaded]);

  const retry = () =>
    setBoards((m) => {
      const next = { ...m };
      delete next[pos];
      return next;
    });

  const board = boards[pos];
  const rows = (board?.top ?? []).map((e) => ({
    key: e.id,
    rank: pos === "all" ? e.rank : e.posRank,
    career: e,
    mine: isMine(e, hall),
  }));
  const best = rows.find((r) => r.mine);

  return (
    <>
      <Segmented label="포지션 고르기" options={POS_OPTIONS} value={pos} onChange={setPos} />
      {!loaded ? (
        <p className="empty" role="status">
          순위표를 불러오고 있어요.
        </p>
      ) : !board ? (
        <div className="row">
          <p className="empty" role="status">
            온라인 랭킹을 불러오지 못했어요. 잠시 뒤에 다시 해 주세요.
          </p>
          <button type="button" className="btn" onClick={retry}>
            다시 불러오기
          </button>
        </div>
      ) : !board.stats.careers ? (
        <p className="empty">아직 올라온 기록이 없어요. 프로 무대를 밟은 선수가 은퇴하면 첫 기록이 돼요.</p>
      ) : (
        <>
          <StatTiles
            items={[
              ["등록된 커리어", fmtNum(board.stats.careers)],
              [`NBA 진출 · ${fmtNum(board.stats.nba)}명`, pct(board.stats.nba, board.stats.careers)],
              [`NBA MVP · ${fmtNum(board.stats.nbaMvp)}명`, pct(board.stats.nbaMvp, board.stats.careers)],
            ]}
          />
          <Best5 items={board.best5.map(({ pos: p, career }) => ({ pos: p, career, note: career ? `전체 ${career.rank}위` : undefined }))} />
          {rows.length ? (
            <HallTable rows={rows} />
          ) : (
            <p className="empty">{pos}로 올라온 기록이 아직 없어요.</p>
          )}
          {best && (
            <p className="hint">
              내 기록 중 가장 높은 순위는 {pos === "all" ? "전체" : pos} {best.rank}위 ({best.career.name})예요.
            </p>
          )}
        </>
      )}
      <p className="hint">
        모든 플레이어가 은퇴하며 올린 기록이에요. 내 기록과 같은 순서로 줄을 세우고, 기록 검증은 아직 준비 중이에요.
      </p>
    </>
  );
}
