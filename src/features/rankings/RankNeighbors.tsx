"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { aroundQuery } from "@/shared/leaderboard/queries";
import type { BoardEntry } from "@/shared/leaderboard/types";
import { loadState } from "@/shared/query/load-state";
import { CareerCardSheet } from "@/shared/ui/CareerCardSheet";
import { Loading } from "@/shared/ui/ui";
import { RankRow, defaultRankText } from "./RankingList";

/** 내 기록의 바로 위아래 순위. 열었을 때만 불러오고, 줄을 누르면 커리어 카드가 열려요. */
export function RankNeighbors({ careerId }: { careerId: string }) {
  const { data, loading, retry } = loadState(useQuery(aroundQuery(careerId)));
  const [open, setOpen] = useState<BoardEntry | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const ready = !!data;

  // 불러온 뒤 목록이 화면 밖에 있으면 보이는 곳까지 옮겨요.
  useEffect(() => {
    if (!ready) return;
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    ref.current?.scrollIntoView({ behavior: calm ? "auto" : "smooth", block: "nearest" });
  }, [ready]);

  return (
    <div className="rk-near" ref={ref}>
      {loading ? (
        <Loading label="주변 순위를 불러오고 있어요" />
      ) : !data ? (
        <div className="row">
          <p className="empty" role="status">
            주변 순위를 불러오지 못했어요.
          </p>
          <button type="button" className="btn" onClick={retry}>
            다시 불러오기
          </button>
        </div>
      ) : (
        <ol className="rk-list rk-rows" aria-label="내 순위 주변">
          {data.rows.map((e) => (
            <RankRow key={e.id} e={e} rank={e.rank} mine={e.id === data.id} onOpen={setOpen} />
          ))}
        </ol>
      )}
      {open && data && <CareerCardSheet career={open} ranks={`올타임 ${defaultRankText(open)}`} mine={open.id === data.id} onClose={() => setOpen(null)} />}
    </div>
  );
}
