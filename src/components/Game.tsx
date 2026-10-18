"use client";

import { useState } from "react";
import { useGame } from "@/lib/game-store";
import { CreateScreen } from "./CreateScreen";
import { DraftLoading } from "./DraftLoading";
import { GameScreen, type TabKey } from "./GameScreen";
import { RetiredScreen } from "./RetiredScreen";
import { SeasonLoading } from "./SeasonLoading";
import { Toast } from "./Toast";
import { TournamentLoading } from "./TournamentLoading";

export function Game() {
  const { ready, career, draft, hall, simulating, tournament, drafting, toast } = useGame();
  // 탭은 커리어마다 홈에서 시작해요.
  const [view, setView] = useState<{ id: string | null; tab: TabKey }>({ id: null, tab: "season" });
  const tab = career && view.id === career.id ? view.tab : "season";
  const inGame = ready && career && career.stage !== "retired";

  /** 탭이 바뀌면 화면이 통째로 바뀌니 맨 위에서 시작해요. */
  const openTab = (k: TabKey) => {
    setView({ id: career?.id ?? null, tab: k });
    window.scrollTo({ top: 0 });
  };

  let body: React.ReactNode;
  if (!ready) body = <p className="boot">커리어를 불러오고 있어요…</p>;
  else if (!career) body = <CreateScreen draft={draft} hall={hall} />;
  else if (career.stage === "retired") body = <RetiredScreen career={career} hall={hall} />;
  else body = <GameScreen career={career} hall={hall} tab={tab} onTab={openTab} simulating={simulating || tournament || drafting} />;

  return (
    <>
      <header className="top">
        <div className="brand">
          <span className="ball" aria-hidden="true" />
          <span>벤치에서 반지까지</span>
        </div>
        {inGame && (
          <div className="hmeta">
            <span className="who">
              {career.p.name} · {career.year} 시즌 준비
            </span>
            <span className="saved">자동 저장</span>
            <button
              type="button"
              id="open-settings"
              className="icon-btn"
              aria-label="설정"
              aria-pressed={tab === "settings"}
              aria-controls="tabpanel"
              onClick={() => openTab(tab === "settings" ? "season" : "settings")}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M10.3 3h3.4l.5 2.4 1.6.9 2.3-.8 1.7 2.9-1.8 1.6v1.9l1.8 1.6-1.7 2.9-2.3-.8-1.6.9-.5 2.4h-3.4l-.5-2.4-1.6-.9-2.3.8-1.7-2.9L6 13.9V12l-1.8-1.6 1.7-2.9 2.3.8 1.6-.9zM12 9.2a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6z" />
              </svg>
            </button>
          </div>
        )}
      </header>
      {body}
      {simulating && career && <SeasonLoading career={career} />}
      {tournament && career && <TournamentLoading career={career} />}
      {drafting && career?.draftShow && <DraftLoading career={career} show={career.draftShow} />}
      <Toast toast={toast} />
      <p className="foot">
        비공식 팬 게임이에요. 리그·구단·대회 명칭의 권리는 각 권리자에게 있어요. 진행 내용은 이 브라우저에만 저장되니,
        중요한 커리어는 설정에서 저장 코드를 복사해 두세요.
      </p>
    </>
  );
}
