"use client";

import Link from "next/link";
import { useState } from "react";
import { gameActions, useGame } from "@/lib/game-store";
import { CreateScreen } from "@/components/create/CreateScreen";
import { CheerPopup } from "@/components/progress/CheerPopup";
import { DraftLoading } from "@/components/progress/DraftLoading";
import { FarewellLoading } from "@/components/progress/FarewellLoading";
import { GameScreen, type TabKey } from "@/components/career/GameScreen";
import { FeedbackDialog } from "@/components/feedback/FeedbackDialog";
import { GuideDialog } from "@/components/guide/GuideDialog";
import { NoticeDialog } from "@/components/notice/NoticeDialog";
import { NOTICES, useReadNotices } from "@/lib/notices";
import { SUPPORT_ACCOUNT } from "@/lib/site";
import { CoffeeDialog } from "@/components/support/CoffeeDialog";
import { RetiredScreen } from "@/components/retired/RetiredScreen";
import { SettingsDialog } from "@/components/settings/SettingsDialog";
import { LiveGameView } from "@/components/progress/LiveGameView";
import { Popup } from "@/components/progress/Popup";
import { Toast } from "@/components/common/Toast";
import { TournamentLoading } from "@/components/progress/TournamentLoading";

export function Game() {
  const { ready, career, draft, hall, endings, ending, playing, speed, final, farewell, farewellReplay, tournament, drafting, toast, outcome } = useGame();
  // 탭은 커리어마다 홈에서 시작해요.
  const [view, setView] = useState<{ id: string | null; tab: TabKey }>({ id: null, tab: "season" });
  const tab = career && view.id === career.id ? view.tab : "season";
  // 지난 엔딩을 보는 동안에는 진행 중인 커리어를 뒤로 물려요.
  const inGame = ready && !ending && career && career.stage !== "retired";
  /** 엔딩을 보여주는 커리어: 다시 연 지난 엔딩, 아니면 방금 은퇴한 지금 커리어 */
  const retiredShown = ending ?? (career?.stage === "retired" ? career : null);
  const [guideOpen, setGuideOpen] = useState(false);
  // 축하 팝업은 다른 진행 화면(시즌 진행·결승 중계·대회·드래프트·회고)이 다 끝난 뒤에 한 장씩 띄워요.
  const cheer = inGame && !playing && !final && !tournament && !drafting && !farewell ? career.cheers[0] : undefined;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [coffeeOpen, setCoffeeOpen] = useState(false);
  const readNotices = useReadNotices();
  const unread = NOTICES.some((n) => !readNotices.has(n.id));

  /** 탭이 바뀌면 화면이 통째로 바뀌니 맨 위에서 시작해요. */
  const openTab = (k: TabKey) => {
    setView({ id: career?.id ?? null, tab: k });
    window.scrollTo({ top: 0 });
  };

  let body: React.ReactNode;
  if (!ready) body = <p className="boot">커리어를 불러오고 있어요…</p>;
  else if (ending) body = <RetiredScreen career={ending} hall={hall} past />;
  else if (!career) body = <CreateScreen draft={draft} hall={hall} endings={endings} />;
  // 은퇴 직후에는 회고 팝업 뒤에 엔딩이 미리 보이지 않게 비워 둬요. 은퇴 화면에서 다시 연 회고 뒤에는 엔딩을 그대로 둬요.
  else if (career.stage === "retired")
    body = farewell && !farewellReplay ? null : <RetiredScreen career={career} hall={hall} />;
  else
    body = (
      <GameScreen
        career={career}
        hall={hall}
        tab={tab}
        onTab={openTab}
        playing={playing}
        speed={speed}
        // 축하 팝업을 다 닫아야 오프시즌 결정 시트가 올라와요.
        busy={final || tournament || drafting || !!cheer}
        outcome={outcome}
      />
    );

  return (
    <>
      <header className="top">
        <div className="brand">
          <span className="ball" aria-hidden="true" />
          <span className="brand-text">
            <span>농구 선수 키우기</span>
            <span className="brand-sub">벤치 뎁혀 반지 굽기</span>
          </span>
        </div>
        <div className="hright">
          {SUPPORT_ACCOUNT.number && (
            <button
              type="button"
              className="guide-btn coffee-btn"
              aria-label="개발자에게 커피 후원"
              aria-haspopup="dialog"
              aria-expanded={coffeeOpen}
              onClick={() => setCoffeeOpen(true)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 8h13v5a6 6 0 0 1-6 6H10a6 6 0 0 1-6-6zm13 1h1.5a3 3 0 0 1 0 6H17v-2h1.5a1 1 0 0 0 0-2H17zM8 2c1 1.2 1 2.3 0 3.5S7 7.8 8 9H6.4c-.9-1.2-.9-2.3 0-3.5s.9-2.3 0-3.5zm4 0c1 1.2 1 2.3 0 3.5s-1 2.3 0 3.5h-1.6c-.9-1.2-.9-2.3 0-3.5s.9-2.3 0-3.5zM3 20h16v2H3z" />
              </svg>
              <span>커피</span>
            </button>
          )}
          <Link className="guide-btn" href="/rankings" aria-label="랭킹">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M7 4h10v2h3v3a4 4 0 0 1-4 4h-.4A5 5 0 0 1 13 15.9V18h3v2H8v-2h3v-2.1A5 5 0 0 1 8.4 13H8a4 4 0 0 1-4-4V6h3zm0 4H6v1a2 2 0 0 0 1 1.7zm10 0v2.7A2 2 0 0 0 18 9V8z" />
            </svg>
            <span>랭킹</span>
          </Link>
          <button
            type="button"
            className="guide-btn"
            aria-label={unread ? "공지 (새 글 있음)" : "공지"}
            aria-haspopup="dialog"
            aria-expanded={noticeOpen}
            onClick={() => setNoticeOpen(true)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M18 3v18l-6-4H7l1 4H5.5l-1.3-4.3A3 3 0 0 1 2 13.8V10a3 3 0 0 1 3-3h7zm2 6.5a3 3 0 0 1 0 5z" />
            </svg>
            <span>공지</span>
            {unread && <i className="nt-dot" aria-hidden="true" />}
          </button>
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
            className="guide-btn"
            aria-label="의견 보내기"
            aria-haspopup="dialog"
            aria-expanded={feedbackOpen}
            onClick={() => setFeedbackOpen(true)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 3h16a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H9l-5 4v-4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm3 5v2h10V8zm0 4v2h7v-2z" />
            </svg>
            <span>의견</span>
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
      {farewell && retiredShown && <FarewellLoading career={retiredShown} />}
      {cheer && career && <CheerPopup career={career} cheer={cheer} />}
      {guideOpen && <GuideDialog onClose={() => setGuideOpen(false)} />}
      {noticeOpen && <NoticeDialog onClose={() => setNoticeOpen(false)} />}
      {coffeeOpen && <CoffeeDialog onClose={() => setCoffeeOpen(false)} />}
      {feedbackOpen && (
        <FeedbackDialog
          onClose={() => setFeedbackOpen(false)}
          career={career ? `${career.p.name} · ${career.year}년 ${career.age}세 · ${career.stage === "retired" ? "은퇴" : (career.team?.name ?? "무소속")}` : undefined}
        />
      )}
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
    </>
  );
}
