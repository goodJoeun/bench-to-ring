"use client";

import { useState } from "react";
import { natColor, type Career } from "@/game";
import { ClutchResult } from "@/features/career/ClutchArt";
import { gameActions } from "@/shared/store/game-store";
import { useReveal } from "@/shared/lib/hooks";
import { TeamBadge } from "@/shared/ui/badge/TeamBadge";
import { LiveGameView } from "./LiveGameView";
import { Popup, PopupFooter, PopupHero } from "./Popup";

/** 경기 결과를 하나씩 띄우는 간격(ms) */
const GAME_MS = 650;

type Stage = "games" | "effect" | "final" | "result";

/**
 * 국가대표 대회 진행 화면. 결과는 이미 정해져 있고(c.natLog의 마지막 대회),
 * 조별리그부터 한 경기씩 결과를 띄우다가 결승은 문자 중계로 보여줘요.
 * 결승 클러치가 걸렸으면 결승 전까지 띄우고 화면을 닫아요. 클럽 결승과 같은 클러치 이펙트와 결정 시트(ActionPanel)가 뜨고,
 * 고르면 이 화면이 다시 열려 성공·실패 이펙트 뒤에 바로 최종 성적을 보여줘요. 마지막 플레이로 결승이 끝났으니 결승 중계는 틀지 않아요.
 */
export function TournamentLoading({ career: c }: { career: Career }) {
  const t = c.natLog.at(-1);
  const games = t?.games ?? [];
  const final = t && c.live?.key === `nat-${t.year}` ? c.live : null;
  // 이 대회의 결승 클러치를 기다리는 중인지
  const pending = !!t && c.natFinal?.year === t.year && c.natFinal.ev === t.ev;
  // 결승은 중계로 보여주니, 목록은 결승 전까지만 하나씩 올려요.
  const listed = final ? games.length - 1 : games.length;
  // 결승 클러치를 고른 뒤 다시 열리면 목록을 다시 올리지 않고 결과 이펙트부터 보여줘요.
  const [stage, setStage] = useState<Stage>(() => (t?.clutch && !pending ? "effect" : "games"));
  /** 경기 목록 다음: 결승 클러치를 기다리면 화면을 닫아 결정 시트로, 아니면 결승 중계 → 최종 성적 */
  const afterGames = () => {
    if (pending) gameActions.pauseTournament();
    else setStage(final ? "final" : "result");
  };
  const [shown] = useReveal(listed, () => GAME_MS, {
    running: stage === "games",
    tail: GAME_MS,
    onDone: afterGames,
  });
  const color = natColor(c.p.nat);

  if (!t) return null;

  if (stage === "final" && final)
    return (
      <Popup label={final.title}>
        <LiveGameView game={final} onDone={() => setStage("result")} />
      </Popup>
    );

  const visible = stage === "games" ? games.slice(0, shown) : games;
  const w = visible.filter((g) => g.win).length;

  // 결과 이펙트는 화면 전체를 덮어야 해서 팝업 카드 밖에 그려요. 카드 안의 너비 규칙(.sim-card > *)을 받지 않고, 뒤에는 대회 진행 화면이 남아요.
  const overlay =
    stage === "effect" && t.clutch ? (
      <ClutchResult result={{ ...t.clutch, finals: `${t.name} 결승`, gold: true }} onDone={() => setStage(final ? "final" : "result")} />
    ) : null;

  return (
    <>
      <Popup labelledBy="tour-title" className="tour">
        <PopupHero
          player={c.p}
          color={color}
          team={
            <span className="team-cell">
              <TeamBadge name={c.p.nat} size={18} />
              {c.p.nat} 대표팀
            </span>
          }
          title={t.name}
          titleId="tour-title"
          status={stage === "result" ? `최종 성적 · ${t.label}` : visible.length ? `${w}승 ${visible.length - w}패` : "대회 개막"}
          busy={stage !== "result"}
        />
        <ol className="tour-games">
          {visible.map((g, i) => (
            <li key={i} data-win={g.win || undefined}>
              <span className="tg-stage">{g.stage}</span>
              <span className="tg-opp">
                <TeamBadge name={g.opp} kind="nat" size={18} />
                vs {g.opp}
              </span>
              <span className="tg-score">
                {g.us}-{g.them}
              </span>
              <span className="tg-wl">{g.win ? "승" : "패"}</span>
              {g.pts !== undefined && <span className="tg-pts">{g.pts}점</span>}
            </li>
          ))}
        </ol>
        {/* 목록을 건너뛰면 결승 클러치(있으면)나 최종 성적으로 가요. 결승 클러치 자체는 건너뛰지 않아요. */}
        <PopupFooter
          done={stage === "result"}
          onSkip={() => (stage === "games" ? afterGames() : setStage("result"))}
          onConfirm={() => gameActions.finishTournament()}
        >
          <p className="tour-story" data-medal={t.medal ?? undefined}>
            {t.medal && <b>{t.medal}메달 </b>}
            {t.story}
          </p>
        </PopupFooter>
      </Popup>
      {overlay}
    </>
  );
}
