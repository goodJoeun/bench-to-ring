"use client";

import { useEffect, useRef, useState } from "react";
import { Sprite } from "./Sprite";

export const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

interface PopupProps {
  /** 제목 요소 id. 없으면 label로 이름을 붙여요. */
  labelledBy?: string;
  label?: string;
  className?: string;
  children: React.ReactNode;
}

/**
 * 진행 화면용 파란 전체 화면 팝업: 시즌 진행, 국가대표 대회, 드래프트, 결승 중계.
 * 휴대폰은 전체 화면, 넓은 화면은 가운데 패널이에요.
 */
export function Popup({ labelledBy, label, className, children }: PopupProps) {
  return (
    <div className="sim" role="dialog" aria-modal="true" aria-labelledby={labelledBy} aria-label={labelledBy ? undefined : label}>
      <div className={className ? `sim-card ${className}` : "sim-card"}>{children}</div>
    </div>
  );
}

interface PopupHeroProps {
  /** 코트 위 도트 캐릭터 */
  player: { skin: string; hair: string };
  /** 유니폼 색 */
  color: string;
  /** 제목 위 작은 줄: 팀, 소속 */
  team: React.ReactNode;
  title: React.ReactNode;
  titleId: string;
  /** 제목 아래 진행 상태. 화면 읽기 프로그램에 바로 읽혀요. */
  status: React.ReactNode;
  /** 진행 중이면 상태 뒤에 점 세 개가 움직여요. */
  busy?: boolean;
  /** 코트와 제목 사이에 넣을 내용 (전광판 등) */
  children?: React.ReactNode;
}

/** 팝업 위쪽: 코트 위 선수, 소속, 제목, 진행 상태 */
export function PopupHero({ player, color, team, title, titleId, status, busy, children }: PopupHeroProps) {
  return (
    <>
      <div className="sim-court" aria-hidden="true">
        <Sprite skin={player.skin} hair={player.hair} color={color} label="" className="sprite sim-sprite" />
        <span className="sim-shadow" />
      </div>
      {children}
      <span className="sim-team">{team}</span>
      <h2 id={titleId}>{title}</h2>
      <p className="sim-phase" role="status" aria-live="polite">
        {status}
        {busy && <span className="dots" aria-hidden="true" />}
      </p>
    </>
  );
}

/**
 * 항목을 하나씩 공개해요. delay(i)는 i번째 항목을 보여주기 전 기다리는 시간(ms)이고,
 * 다 보여준 뒤 tail(ms)만큼 기다렸다가 onDone을 불러요. 움직임 줄이기를 켠 기기는 바로 다 보여줘요.
 */
export function useReveal(count: number, delay: (i: number) => number, opts: { running: boolean; tail: number; onDone: () => void }) {
  const [shown, setShown] = useState(() => (reducedMotion() ? count : 0));
  const { running, tail } = opts;
  const wait = shown < count ? delay(shown) : tail;
  // 부모가 다시 그려져도 타이머가 처음부터 다시 돌지 않게 콜백은 ref로 들고 있어요.
  const doneRef = useRef(opts.onDone);
  useEffect(() => {
    doneRef.current = opts.onDone;
  });

  useEffect(() => {
    if (!running) return;
    const timer = setTimeout(() => (shown < count ? setShown(shown + 1) : doneRef.current()), wait);
    return () => clearTimeout(timer);
  }, [running, shown, count, wait]);

  return [shown, setShown] as const;
}
