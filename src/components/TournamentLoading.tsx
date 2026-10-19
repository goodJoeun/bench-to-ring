"use client";

import { useState } from "react";
import { natColor, type Career } from "@/game";
import { gameActions } from "@/lib/game-store";
import { useReveal } from "./hooks";
import { LiveGameView } from "./LiveGameView";
import { Popup, PopupFooter, PopupHero } from "./Popup";

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
  const [stage, setStage] = useState<"games" | "final" | "result">("games");
  const [shown] = useReveal(listed, () => GAME_MS, {
    running: stage === "games",
    tail: GAME_MS,
    onDone: () => setStage(final ? "final" : "result"),
  });
  const color = natColor(c.p.nat);

  if (!t) return null;

  if (stage === "final" && final)
    return (
      <Popup label={final.title}>
        <LiveGameView game={final} onDone={() => setStage("result")} />
      </Popup>
    );

  const visible = stage === "result" ? games : games.slice(0, shown);
  const w = visible.filter((g) => g.win).length;

  return (
    <Popup labelledBy="tour-title" className="tour">
      <PopupHero
        player={c.p}
        color={color}
        team={`${c.p.nat} 대표팀`}
        title={t.name}
        titleId="tour-title"
        status={stage === "result" ? `최종 성적 · ${t.label}` : visible.length ? `${w}승 ${visible.length - w}패` : "대회 개막"}
        busy={stage !== "result"}
      />
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
      <PopupFooter done={stage === "result"} onSkip={() => setStage("result")} onConfirm={() => gameActions.finishTournament()}>
        <p className="tour-story" data-medal={t.medal ?? undefined}>
          {t.medal && <b>{t.medal}메달 </b>}
          {t.story}
        </p>
      </PopupFooter>
    </Popup>
  );
}
