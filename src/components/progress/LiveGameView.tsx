"use client";

import { useEffect, useState } from "react";
import type { LiveGame } from "@/game";
import { reducedMotion, useAutoFocus } from "@/components/common/hooks";
import { TeamBadge } from "@/components/common/TeamBadge";

/** 한 플레이를 보여주는 간격(ms). 빠르게는 3배속이에요. */
const STEP_MS = 120;
const FAST_MS = 40;
const LOG_LINES = 6;

/**
 * 결승전 문자 중계. 결과는 이미 정해져 있고, 이 화면은 플레이를 하나씩 빠르게 흘려 보여줘요.
 * 끝까지 보거나 '결과 바로 보기'를 누르면 최종 점수와 내 기록을 보여준 뒤 onDone으로 넘어가요.
 */
export function LiveGameView({ game, onDone }: { game: LiveGame; onDone: () => void }) {
  const total = game.plays.length;
  // 움직임 줄이기를 켠 기기는 중계를 건너뛰고 결과부터 보여줘요.
  const [shown, setShown] = useState(() => (reducedMotion() ? total : 0));
  const [fast, setFast] = useState(false);
  const finished = shown >= total;
  const doneRef = useAutoFocus<HTMLButtonElement>(finished);

  useEffect(() => {
    if (finished) return;
    const timer = setTimeout(() => setShown((n) => n + 1), fast ? FAST_MS : STEP_MS);
    return () => clearTimeout(timer);
  }, [shown, fast, finished]);

  const last = shown ? game.plays[shown - 1] : null;
  const us = last?.us ?? 0;
  const them = last?.them ?? 0;
  const q = last?.q ?? 1;
  const log = game.plays.slice(Math.max(0, shown - LOG_LINES), shown).reverse();

  return (
    <div className="live">
      <span className="live-title">{game.title}</span>
      <div className="live-board">
        <div className="live-team" style={{ "--tc": game.usColor } as React.CSSProperties}>
          <TeamBadge name={game.us} color={game.usColor} size={36} />
          <span className="live-name">{game.us}</span>
          <b className={finished && game.win ? "won" : undefined}>{us}</b>
        </div>
        <div className="live-clock">
          {finished ? (
            <span className="live-final">종료</span>
          ) : (
            <>
              <span>{q}Q</span>
              <span>{last?.clock ?? `${game.periodMin}:00`}</span>
            </>
          )}
        </div>
        <div className="live-team" style={{ "--tc": game.themColor } as React.CSSProperties}>
          <TeamBadge name={game.them} color={game.themColor} size={36} />
          <span className="live-name">{game.them}</span>
          <b className={finished && !game.win ? "won" : undefined}>{them}</b>
        </div>
      </div>
      <div className="live-bar" aria-hidden="true">
        <div className="live-fill" style={{ width: `${(shown / total) * 100}%` }} />
      </div>

      {finished ? (
        <div className="live-result" role="status">
          <b>{game.key.startsWith("nat") ? (game.win ? "금메달!" : "은메달") : game.win ? "우승!" : "준우승"}</b>
          <span>
            이 경기 {game.mine.pts}점 · {game.mine.reb}리바운드 · {game.mine.ast}어시스트
          </span>
          <button type="button" ref={doneRef} className="live-go" onClick={onDone}>
            계속
          </button>
        </div>
      ) : (
        <>
          <ol className="live-log" aria-live="off">
            {log.map((pl, i) => (
              <li key={shown - i} data-mine={pl.mine || undefined} data-mark={pl.mark || undefined}>
                <span className="lc">{pl.mark ? "" : `${pl.q}Q ${pl.clock}`}</span>
                <span className="lt">{pl.text}</span>
                <span className="ls">
                  {pl.us}-{pl.them}
                </span>
              </li>
            ))}
          </ol>
          <div className="live-ctl">
            <button type="button" className="sim-skip" aria-pressed={fast} onClick={() => setFast((f) => !f)}>
              {fast ? "보통 속도" : "빠르게 ×3"}
            </button>
            <button type="button" className="sim-skip" onClick={() => setShown(total)}>
              결과 바로 보기
            </button>
          </div>
        </>
      )}
    </div>
  );
}
