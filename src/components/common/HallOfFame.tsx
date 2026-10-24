"use client";

import { useState } from "react";
import { bestFive, fmtNum, rankHall, type CareerSummary } from "@/game";
import { Best5, HallTable } from "./HallTable";
import { OnlineBoard } from "./OnlineBoard";
import { Panel, Segmented } from "./ui";

type View = "mine" | "online";

export function HallOfFame({ hall }: { hall: CareerSummary[] }) {
  const [view, setView] = useState<View>("mine");
  return (
    <Panel title="명예의 전당">
      <Segmented
        label="명예의 전당 고르기"
        options={[
          { key: "mine", big: "내 기록", sm: hall.length ? `${fmtNum(hall.length)}명` : "기록 없음" },
          { key: "online", big: "온라인 랭킹", sm: "모든 플레이어" },
        ]}
        value={view}
        onChange={setView}
      />
      {view === "online" ? <OnlineBoard hall={hall} /> : <MyHall hall={hall} />}
    </Panel>
  );
}

function MyHall({ hall }: { hall: CareerSummary[] }) {
  if (!hall.length)
    return <p className="empty">은퇴한 선수가 아직 없어요. 프로 무대를 밟은 선수가 은퇴하면 이 브라우저의 기록에 올라가요.</p>;
  const ranked = rankHall(hall).slice(0, 30);
  return (
    <>
      <p className="hint">
        이 브라우저에서 은퇴한 선수들이에요. NBA MVP 횟수 → 최고 오버롤 → 개인상 → 통산 득점 순으로 줄을 세워요.
      </p>
      <Best5 items={bestFive(hall)} />
      <HallTable rows={ranked.map(({ rank, career }) => ({ key: career.id, rank, career }))} />
    </>
  );
}
