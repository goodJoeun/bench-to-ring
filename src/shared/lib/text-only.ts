"use client";

/*
 * 텍스트만 보기: 커리어를 진행하는 동안(시즌·클러치·우승 축하·드래프트·회고) 캐릭터·로고·장면 그림과 이펙트를 빼고 글자만 보여줘요.
 * 첫 화면, 선수 만들기, 랭킹, 은퇴 화면에서는 그림을 그대로 보여줘요.
 * 고른 값은 이 브라우저에 저장하고, 게임 중일 때만 <html data-text-only>를 붙여요. 그림 컴포넌트는 useTextOnly()를 보고 아예 그리지 않고,
 * 남은 꾸밈과 애니메이션은 globals.css 맨 아래의 [data-text-only] 규칙이 꺼요.
 */

import { useLayoutEffect, useSyncExternalStore } from "react";

export const TEXT_ONLY_KEY = "b2r-text-only";

const listeners = new Set<() => void>();
/** 설정에서 고른 값. 저장이 막힌 브라우저에서도 이번 방문 동안은 기억해요. */
let chosen: boolean | null = null;
/** 지금 커리어를 진행하는 화면인지 */
let inPlay = false;

function readChosen(): boolean {
  if (chosen === null) {
    try {
      chosen = localStorage.getItem(TEXT_ONLY_KEY) === "1";
    } catch {
      chosen = false;
    }
  }
  return chosen;
}

function sync(): void {
  const root = document.documentElement;
  if (inPlay && readChosen()) root.dataset.textOnly = "";
  else delete root.dataset.textOnly;
  listeners.forEach((fn) => fn());
}

/** 지금 그림을 빼고 보여주는 중인지. 설정을 켰고 게임 중일 때만 true예요. */
export function textOnly(): boolean {
  return typeof document !== "undefined" && document.documentElement.dataset.textOnly !== undefined;
}

export function applyTextOnly(on: boolean): void {
  chosen = on;
  try {
    if (on) localStorage.setItem(TEXT_ONLY_KEY, "1");
    else localStorage.removeItem(TEXT_ONLY_KEY);
  } catch {
    // 저장이 막힌 브라우저에서는 이번 방문 동안만 적용돼요.
  }
  sync();
}

/** 게임 화면에 들어오고 나갈 때 불러요. */
export function setTextOnlyPlay(on: boolean): void {
  if (inPlay === on) return;
  inPlay = on;
  sync();
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** 지금 그림을 빼고 보여주는 중인지. 설정을 바꾸거나 게임에 들어오고 나가면 바로 다시 그려요. 서버에서는 늘 false예요. */
export function useTextOnly(): boolean {
  return useSyncExternalStore(subscribe, textOnly, () => false);
}

/** 설정에서 '텍스트만'을 골랐는지. 게임 밖에서도 설정 화면에 고른 값을 보여줘요. */
export function useTextOnlyChosen(): boolean {
  return useSyncExternalStore(subscribe, readChosen, () => false);
}

/** active인 동안 텍스트만 보기를 적용해요. 화면이 그려지기 전에 바뀌어서 그림이 번쩍이지 않아요. */
export function useTextOnlyPlay(active: boolean): void {
  useLayoutEffect(() => {
    setTextOnlyPlay(active);
    return () => setTextOnlyPlay(false);
  }, [active]);
}
