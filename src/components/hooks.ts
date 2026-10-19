"use client";

import { useEffect, useRef, useState } from "react";

export const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * 렌더마다 새로 만들어지는 값(주로 콜백)의 최신 값을 ref로 들고 있어요.
 * effect 의존성에 넣지 않아도 돼서, 부모가 다시 그려져도 타이머나 이벤트 등록이 다시 시작되지 않아요.
 */
export function useLatest<T>(value: T) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  });
  return ref;
}

/** when이 true가 되는 순간 ref를 단 요소에 초점을 줘요. */
export function useAutoFocus<T extends HTMLElement>(when = true) {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (when) ref.current?.focus();
  }, [when]);
  return ref;
}

/** active인 동안 Esc 키를 누르면 onEscape를 불러요. */
export function useEscapeKey(onEscape: (() => void) | undefined, active = true) {
  const latest = useLatest(onEscape);
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") latest.current?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, latest]);
}

/**
 * 항목을 하나씩 공개해요. delay(i)는 i번째 항목을 보여주기 전 기다리는 시간(ms)이고,
 * 다 보여준 뒤 tail(ms)만큼 기다렸다가 onDone을 불러요. 움직임 줄이기를 켠 기기는 바로 다 보여줘요.
 */
export function useReveal(count: number, delay: (i: number) => number, opts: { running: boolean; tail: number; onDone: () => void }) {
  const [shown, setShown] = useState(() => (reducedMotion() ? count : 0));
  const { running, tail } = opts;
  const wait = shown < count ? delay(shown) : tail;
  const doneRef = useLatest(opts.onDone);

  useEffect(() => {
    if (!running) return;
    const timer = setTimeout(() => (shown < count ? setShown(shown + 1) : doneRef.current()), wait);
    return () => clearTimeout(timer);
  }, [running, shown, count, wait, doneRef]);

  return [shown, setShown] as const;
}
