"use client";

import { useEffect, useRef, useState } from "react";
import { ARMY, LEAGUES, SANGMU, type Career } from "@/game";
import { gameActions } from "@/lib/game-store";
import { LiveGameView } from "./LiveGameView";
import { Popup, PopupHero } from "./Popup";

const DURATION = 3200;
const REDUCED_DURATION = 900;
const NO_TEAM_COLOR = "#5A6577";

interface Phase {
  /** 이 단계가 끝나는 진행률 (0~1) */
  until: number;
  label: string;
}

const TEAM_PHASES = (amateur: boolean): Phase[] => [
  { until: 0.14, label: "프리시즌 훈련" },
  { until: 0.74, label: "정규시즌" },
  { until: 0.9, label: amateur ? "전국대회" : "플레이오프" },
  { until: 1, label: "시즌 결산" },
];

const SOLO_PHASES: Phase[] = [
  { until: 0.3, label: "체력 훈련" },
  { until: 0.65, label: "기술 훈련" },
  { until: 0.9, label: "연습 경기" },
  { until: 1, label: "시즌 결산" },
];

const SANGMU_PHASES: Phase[] = [
  { until: 0.14, label: "기초군사훈련" },
  { until: 0.74, label: "D리그" },
  { until: 0.9, label: "국군체육부대 대회" },
  { until: 1, label: "시즌 결산" },
];

const ARMY_PHASES: Phase[] = [
  { until: 0.2, label: "기초군사훈련" },
  { until: 0.45, label: "자대 배치" },
  { until: 0.85, label: "복무와 개인 운동" },
  { until: 1, label: "전역 준비" },
];

/** 결승 중계를 시작하는 지점: 플레이오프가 끝나 갈 때 */
const FINAL_AT = 0.88;

/** 정규시즌 구간에서 몇 번째 경기까지 치렀는지 (0~1) */
const seasonShare = (t: number) => Math.min(1, Math.max(0, (t - 0.14) / 0.6));

/**
 * 시즌 진행 로딩 화면. 결과는 이미 계산돼 저장된 상태이고,
 * 이 화면은 c.last를 따라 경기 수와 승패를 올려 보여준 뒤 닫혀요.
 */
export function SeasonLoading({ career: c }: { career: Career }) {
  const rec = c.last;
  // 이번 시즌 결승에 올랐으면 플레이오프 끝무렵에 멈추고 결승전 중계를 보여줘요.
  const final = rec && c.live?.key === `league-${rec.year}` ? c.live : null;
  const [t, setT] = useState(0);
  const [watching, setWatching] = useState(false);
  const skipRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    skipRef.current?.focus();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = reduced ? REDUCED_DURATION : DURATION;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const next = Math.min(1, (now - start) / duration);
      if (final && next >= FINAL_AT) {
        setT(FINAL_AT);
        setWatching(true);
        return;
      }
      setT(next);
      if (next < 1) raf = requestAnimationFrame(tick);
      else raf = requestAnimationFrame(() => gameActions.finishSimulation());
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [final]);

  if (!rec) return null;

  if (watching && final)
    return (
      <Popup label={final.title}>
        <LiveGameView game={final} onDone={() => gameActions.finishSimulation()} />
      </Popup>
    );

  const hasTeam = rec.lg !== null;
  const league = rec.lg ? LEAGUES[rec.lg] : null;
  const phases = rec.mil === "sangmu" ? SANGMU_PHASES : rec.mil === "army" ? ARMY_PHASES : hasTeam ? TEAM_PHASES(!rec.pro) : SOLO_PHASES;
  const phase = phases.find((ph) => t < ph.until) ?? phases[phases.length - 1];
  const total = rec.w + rec.l;
  const played = Math.round(seasonShare(t) * total);
  const wins = total ? Math.round((rec.w * played) / total) : 0;
  const color =
    rec.mil === "sangmu" ? SANGMU.color : rec.mil === "army" ? ARMY.color : hasTeam && c.team?.name === rec.team ? c.team.color : NO_TEAM_COLOR;
  const showScore = (hasTeam || rec.mil === "sangmu") && total > 0;

  return (
    <Popup labelledBy="sim-title">
      <PopupHero
        player={c.p}
        color={color}
        team={rec.mil ? rec.team : hasTeam ? `${rec.team} · ${league?.short}` : "무소속 · 개인 훈련"}
        title={`${rec.year} 시즌 진행 중`}
        titleId="sim-title"
        status={phase.label}
        busy
      >
        {showScore && (
          <div className="sim-score" aria-hidden="true">
            <span>
              <small>경기</small>
              <b>
                {played}
                <em>/{total}</em>
              </b>
            </span>
            <i />
            <span>
              <small>승</small>
              <b>{wins}</b>
            </span>
            <i />
            <span>
              <small>패</small>
              <b>{played - wins}</b>
            </span>
          </div>
        )}
      </PopupHero>
      <div className="sim-bar" role="progressbar" aria-label="시즌 진행률" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(t * 100)}>
        <div className="sim-fill" style={{ width: `${t * 100}%` }} />
      </div>
      <button type="button" ref={skipRef} className="sim-skip" onClick={() => gameActions.finishSimulation()}>
        건너뛰기
      </button>
    </Popup>
  );
}
