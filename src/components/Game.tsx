"use client";

import { useState } from "react";
import { gameActions, useGame } from "@/lib/game-store";
import { CreateScreen } from "@/components/create/CreateScreen";
import { CheerPopup } from "@/components/progress/CheerPopup";
import { DraftLoading } from "@/components/progress/DraftLoading";
import { FarewellLoading } from "@/components/progress/FarewellLoading";
import { GameScreen, type TabKey } from "@/components/career/GameScreen";
import { GuideDialog } from "@/components/guide/GuideDialog";
import { RetiredScreen } from "@/components/retired/RetiredScreen";
import { SettingsDialog } from "@/components/settings/SettingsDialog";
import { LiveGameView } from "@/components/progress/LiveGameView";
import { Popup } from "@/components/progress/Popup";
import { Toast } from "@/components/common/Toast";
import { TournamentLoading } from "@/components/progress/TournamentLoading";

export function Game() {
  const { ready, career, draft, hall, playing, speed, final, farewell, tournament, drafting, toast } = useGame();
  // 탭은 커리어마다 홈에서 시작해요.
  const [view, setView] = useState<{ id: string | null; tab: TabKey }>({ id: null, tab: "season" });
  const tab = career && view.id === career.id ? view.tab : "season";
  const inGame = ready && career && career.stage !== "retired";
  const [guideOpen, setGuideOpen] = useState(false);
  // 축하 팝업은 다른 진행 화면(시즌 진행·결승 중계·대회·드래프트·회고)이 다 끝난 뒤에 한 장씩 띄워요.
  const cheer = inGame && !playing && !final && !tournament && !drafting && !farewell ? career.cheers[0] : undefined;
  const [settingsOpen, setSettingsOpen] = useState(false);

  /** 탭이 바뀌면 화면이 통째로 바뀌니 맨 위에서 시작해요. */
  const openTab = (k: TabKey) => {
    setView({ id: career?.id ?? null, tab: k });
    window.scrollTo({ top: 0 });
  };

  let body: React.ReactNode;
  if (!ready) body = <p className="boot">커리어를 불러오고 있어요…</p>;
  else if (!career) body = <CreateScreen draft={draft} hall={hall} />;
  // 은퇴 직후에는 회고 팝업 뒤에 엔딩이 미리 보이지 않게 비워 둬요.
  else if (career.stage === "retired") body = farewell ? null : <RetiredScreen career={career} hall={hall} />;
  else
    body = (
      <GameScreen career={career} hall={hall} tab={tab} onTab={openTab} playing={playing} speed={speed} busy={final || tournament || drafting} />
    );

  return (
    <>
      <header className="top">
        <div className="brand">
          <span className="ball" aria-hidden="true" />
          <span>벤치에서 반지까지</span>
        </div>
        <div className="hright">
          {inGame && (
            <div className="hmeta">
              <span className="who">
                {career.p.name} · {career.year} 시즌 {career.run ? "진행 중" : "준비"}
              </span>
              <span className="saved">자동 저장</span>
            </div>
          )}
          <button
            type="button"
            className="guide-btn"
            aria-label="플레이 가이드"
            aria-haspopup="dialog"
            aria-expanded={guideOpen}
            onClick={() => setGuideOpen(true)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v16H6.5a1 1 0 0 0 0 2H20v2H6.5A2.5 2.5 0 0 1 4 19.5zM8 6v2h8V6zm0 4v2h6v-2z" />
            </svg>
            <span>가이드</span>
          </button>
          <button
            type="button"
            id="open-settings"
            className="icon-btn"
            aria-label="설정"
            aria-haspopup="dialog"
            aria-expanded={settingsOpen}
            onClick={() => setSettingsOpen(true)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M10.3 3h3.4l.5 2.4 1.6.9 2.3-.8 1.7 2.9-1.8 1.6v1.9l1.8 1.6-1.7 2.9-2.3-.8-1.6.9-.5 2.4h-3.4l-.5-2.4-1.6-.9-2.3.8-1.7-2.9L6 13.9V12l-1.8-1.6 1.7-2.9 2.3.8 1.6-.9zM12 9.2a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6z" />
            </svg>
          </button>
        </div>
      </header>
      {body}
      {final && career?.live && (
        <Popup label={career.live.title}>
          <LiveGameView game={career.live} onDone={() => gameActions.finishFinal()} />
        </Popup>
      )}
      {tournament && career && <TournamentLoading career={career} />}
      {drafting && career?.draftShow && <DraftLoading career={career} show={career.draftShow} />}
      {farewell && career?.stage === "retired" && <FarewellLoading career={career} />}
      {cheer && career && <CheerPopup career={career} cheer={cheer} />}
      {guideOpen && <GuideDialog onClose={() => setGuideOpen(false)} />}
      {settingsOpen && (
        <SettingsDialog
          onClose={() => setSettingsOpen(false)}
          onCareerSettings={
            inGame
              ? () => {
                  setSettingsOpen(false);
                  openTab("settings");
                }
              : undefined
          }
        />
      )}
      <Toast toast={toast} />
      <p className="foot">
        비공식 팬 게임이에요. 리그·구단·대회 명칭과 로고의 권리는 각 권리자에게 있어요. 진행 내용은 이 브라우저에만 저장되니,
        중요한 커리어는 설정에서 저장 코드를 복사해 두세요.
      </p>
    </>
  );
}
