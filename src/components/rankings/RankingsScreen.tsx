"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { POS_KEYS, fmtNum, type PosKey } from "@/game";
import { useGame } from "@/lib/game-store";
import { fetchBoard, fetchMine, pendingIds } from "@/lib/leaderboard/client";
import type { Board, MyRanks } from "@/lib/leaderboard/types";
import { BestFiveCourt } from "./BestFiveCourt";
import { MyRecords } from "./MyRecords";
import { RankingList } from "./RankingList";

const TABS = [
  ["best5", "베스트 5"],
  ["ranking", "랭킹 100"],
  ["mine", "나의 기록"],
] as const;
type Tab = (typeof TABS)[number][0];
type PosFilter = PosKey | "all";

// 탭은 주소의 #best5 · #ranking · #mine을 따라가요. 링크로 바로 열 수 있고 뒤로 가기도 돼요.
const subscribeHash = (cb: () => void) => {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
};
const readTab = (): Tab => {
  const h = window.location.hash.slice(1);
  return TABS.some(([k]) => k === h) ? (h as Tab) : "best5";
};

/** 한 번 불러온 순위표는 이 화면에 있는 동안 다시 부르지 않아요. null은 불러오지 못한 것이에요. */
function useBoard(pos: PosFilter) {
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
  return { board: boards[pos], loaded, retry };
}

function useMine() {
  const [mine, setMine] = useState<MyRanks | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    void fetchMine().then((m) => {
      if (live) setMine(m);
    });
    return () => {
      live = false;
    };
  }, []);
  return mine;
}

export function RankingsScreen() {
  const tab = useSyncExternalStore(subscribeHash, readTab, () => "best5" as Tab);
  const [pos, setPos] = useState<PosFilter>("all");
  const { hall } = useGame();
  const mine = useMine();
  const pending = useSyncExternalStore(
    () => () => {},
    () => pendingKey(),
    () => "",
  );
  const all = useBoard("all");
  const filtered = useBoard(pos);
  const myIds = new Set((mine?.careers ?? []).map((c) => c.id));

  // 베스트 5는 전체 순위표에, 랭킹 탭은 고른 포지션 순위표에 들어 있어요.
  const shown = tab === "ranking" ? filtered : all;
  const failed = shown.loaded && !shown.board;

  return (
    <>
      <header className="top">
        <Link className="brand" href="/">
          <span className="ball" aria-hidden="true" />
          <span>농구 선수 키우기</span>
        </Link>
        <Link className="rk-back" href="/">
          <span aria-hidden="true">←</span>
          <span>게임으로</span>
        </Link>
      </header>
      <main className="rk">
        <div className="rk-head">
          <h1>랭킹</h1>
          <p className="hint">
            랭킹 점수 순 · NBA MVP·파이널 MVP·리그 MVP·우승 반지·수상과 통산 기록, 최고 오버롤을 더해요. NBA 밖에서 쌓은 상과 기록은 30%만
            쳐요.
          </p>
        </div>
        <div className="rk-tabs" role="tablist">
          {TABS.map(([k, name]) => (
            <a key={k} href={`#${k}`} role="tab" id={`rk-tab-${k}`} aria-selected={tab === k} aria-controls="rk-panel">
              {name}
            </a>
          ))}
        </div>
        <section className="rk-panel" role="tabpanel" id="rk-panel" aria-labelledby={`rk-tab-${tab}`}>
          {tab === "mine" ? (
            <MyRecords hall={hall} mine={mine} pending={new Set(pending ? pending.split("\n") : [])} />
          ) : (
            <>
              {tab === "ranking" && (
                <div className="rk-filter">
                  <div className="rk-chips" role="group" aria-label="포지션 고르기">
                    {(["all", ...POS_KEYS] as const).map((p) => (
                      <button key={p} type="button" aria-pressed={pos === p} onClick={() => setPos(p)}>
                        {p === "all" ? "전체" : p}
                      </button>
                    ))}
                  </div>
                  {shown.board && <span className="hint">{fmtNum(shown.board.stats.careers)}명</span>}
                </div>
              )}
              {!shown.loaded ? (
                <p className="empty" role="status">
                  순위표를 불러오고 있어요.
                </p>
              ) : failed ? (
                <div className="row">
                  <p className="empty" role="status">
                    온라인 랭킹을 불러오지 못했어요. 잠시 뒤에 다시 해 주세요.
                  </p>
                  <button type="button" className="btn" onClick={shown.retry}>
                    다시 불러오기
                  </button>
                </div>
              ) : !shown.board!.top.length ? (
                <div className="rk-empty">
                  <b>{pos !== "all" && tab === "ranking" ? `${pos}로 올라온 기록이 아직 없어요` : "아직 올라온 기록이 없어요"}</b>
                  <span>프로 무대를 밟은 선수가 은퇴하면 첫 기록이 돼요.</span>
                </div>
              ) : tab === "best5" ? (
                <>
                  <BestFiveCourt best5={shown.board!.best5} mine={myIds} />
                  <p className="hint">
                    포지션마다 랭킹 점수 1위가 뽑혀요. 같은 점수면 NBA MVP → 최고 오버롤 → 통산 득점 순이고, 그래도 같으면 먼저 올린 선수가 자리를
                    지켜요. 등록된 커리어 {fmtNum(shown.board!.stats.careers)}명 · NBA 진출 {fmtNum(shown.board!.stats.nba)}명 · NBA MVP{" "}
                    {fmtNum(shown.board!.stats.nbaMvp)}명
                  </p>
                </>
              ) : (
                <RankingList rows={shown.board!.top} byPos={pos !== "all"} mine={myIds} />
              )}
            </>
          )}
        </section>
      </main>
    </>
  );
}

/** 대기 중인 커리어 id를 한 줄씩 이은 문자열 (useSyncExternalStore가 같은 값이면 다시 그리지 않게요) */
function pendingKey(): string {
  return [...pendingIds()].join("\n");
}
