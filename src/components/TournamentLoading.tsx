"use client";

import { useEffect, useRef, useState } from "react";
import { natColor, type Career } from "@/game";
import { gameActions } from "@/lib/game-store";
import { LiveGameView, reducedMotion } from "./LiveGameView";
import { Sprite } from "./Sprite";

/** 경기 결과를 하나씩 띄우는 간격(ms) */
const GAME_MS = 650;

/**
 * 국가대표 대회 진행 화면. 결과는 이미 정해져 있고(c.natLog의 마지막 대회),
 * 조별리그부터 한 경기씩 결과를 띄우다가 결승은 문자 중계로 보여줘요.
 */
export function TournamentLoading({ career: c }: { career: Career }) {
  const t = c.natLog.at(-1);
  const games = t?.games ?? [];
  const final = t && c.live?.key === `nat-${t.year}` ? c.live : null;
  // 결승은 중계로 보여주니, 목록은 결승 전까지만 하나씩 올려요.
  const listed = final ? games.length - 1 : games.length;
  const [shown, setShown] = useState(() => (reducedMotion() ? listed : 0));
  const [stage, setStage] = useState<"games" | "final" | "result">("games");
  const goRef = useRef<HTMLButtonElement>(null);
  const color = natColor(c.p.nat);

  useEffect(() => {
    if (stage !== "games") return;
    if (shown < listed) {
      const timer = setTimeout(() => setShown((n) => n + 1), GAME_MS);
      return () => clearTimeout(timer);
    }
    const timer = setTimeout(() => setStage(final ? "final" : "result"), GAME_MS);
    return () => clearTimeout(timer);
  }, [shown, listed, stage, final]);

  useEffect(() => {
    if (stage === "result") goRef.current?.focus();
  }, [stage]);

  if (!t) return null;

  if (stage === "final" && final)
    return (
      <div className="sim" role="dialog" aria-modal="true" aria-label={final.title}>
        <div className="sim-card">
          <LiveGameView game={final} onDone={() => setStage("result")} />
        </div>
      </div>
    );

  const visible = stage === "result" ? games : games.slice(0, shown);
  const w = visible.filter((g) => g.win).length;

  return (
    <div className="sim" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      <div className="sim-card tour">
        <div className="sim-court" aria-hidden="true">
          <Sprite skin={c.p.skin} hair={c.p.hair} color={color} label="" className="sprite sim-sprite" />
          <span className="sim-shadow" />
        </div>
        <span className="sim-team">{c.p.nat} 대표팀</span>
        <h2 id="tour-title">{t.name}</h2>
        <p className="sim-phase" role="status" aria-live="polite">
          {stage === "result" ? (
            <>최종 성적 · {t.label}</>
          ) : (
            <>
              {visible.length ? `${w}승 ${visible.length - w}패` : "대회 개막"}
              <span className="dots" aria-hidden="true" />
            </>
          )}
        </p>
        <ol className="tour-games">
          {visible.map((g, i) => (
            <li key={i} data-win={g.win || undefined}>
              <span className="tg-stage">{g.stage}</span>
              <span className="tg-opp">vs {g.opp}</span>
              <span className="tg-score">
                {g.us}-{g.them}
              </span>
              <span className="tg-wl">{g.win ? "승" : "패"}</span>
              {g.pts !== undefined && <span className="tg-pts">{g.pts}점</span>}
            </li>
          ))}
        </ol>
        {stage === "result" ? (
          <>
            <p className="tour-story" data-medal={t.medal ?? undefined}>
              {t.medal && <b>{t.medal}메달 </b>}
              {t.story}
            </p>
            <button type="button" ref={goRef} className="live-go" onClick={() => gameActions.finishTournament()}>
              확인
            </button>
          </>
        ) : (
          <button type="button" className="sim-skip" onClick={() => setStage("result")}>
            결과 바로 보기
          </button>
        )}
      </div>
    </div>
  );
}
