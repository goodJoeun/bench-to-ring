"use client";

import { useEffect, useRef, useState } from "react";
import { LEAGUES, type Career } from "@/game";
import { gameActions } from "@/lib/game-store";
import { Sprite } from "./Sprite";

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

/** 정규시즌 구간에서 몇 번째 경기까지 치렀는지 (0~1) */
const seasonShare = (t: number) => Math.min(1, Math.max(0, (t - 0.14) / 0.6));

/**
 * 시즌 진행 로딩 화면. 결과는 이미 계산돼 저장된 상태이고,
 * 이 화면은 c.last를 따라 경기 수와 승패를 올려 보여준 뒤 닫혀요.
 */
export function SeasonLoading({ career: c }: { career: Career }) {
  const rec = c.last;
  const [t, setT] = useState(0);
  const skipRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    skipRef.current?.focus();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = reduced ? REDUCED_DURATION : DURATION;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const next = Math.min(1, (now - start) / duration);
      setT(next);
      if (next < 1) raf = requestAnimationFrame(tick);
      else raf = requestAnimationFrame(() => gameActions.finishSimulation());
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  if (!rec) return null;

  const hasTeam = rec.lg !== null;
  const league = rec.lg ? LEAGUES[rec.lg] : null;
  const phases = hasTeam ? TEAM_PHASES(!rec.pro) : SOLO_PHASES;
  const phase = phases.find((ph) => t < ph.until) ?? phases[phases.length - 1];
  const total = rec.w + rec.l;
  const played = Math.round(seasonShare(t) * total);
  const wins = total ? Math.round((rec.w * played) / total) : 0;
  const color = hasTeam && c.team?.name === rec.team ? c.team.color : NO_TEAM_COLOR;

  return (
    <div className="sim" role="dialog" aria-modal="true" aria-labelledby="sim-title">
      <div className="sim-card">
        <div className="sim-court" aria-hidden="true">
          <Sprite skin={c.p.skin} hair={c.p.hair} color={color} label="" className="sprite sim-sprite" />
          <span className="sim-shadow" />
        </div>
        {hasTeam && total > 0 && (
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
        <span className="sim-team">{hasTeam ? `${rec.team} · ${league?.short}` : "무소속 · 개인 훈련"}</span>
        <h2 id="sim-title">{rec.year} 시즌 진행 중</h2>
        <p className="sim-phase" role="status" aria-live="polite">
          {phase.label}
          <span className="dots" aria-hidden="true" />
        </p>
        <div className="sim-bar" role="progressbar" aria-label="시즌 진행률" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(t * 100)}>
          <div className="sim-fill" style={{ width: `${t * 100}%` }} />
        </div>
        <button type="button" ref={skipRef} className="sim-skip" onClick={() => gameActions.finishSimulation()}>
          건너뛰기
        </button>
      </div>
    </div>
  );
}
