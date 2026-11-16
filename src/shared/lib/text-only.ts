"use client";

/*
 * 텍스트만 보기: 캐릭터·로고·국기·장면 그림과 이펙트(애니메이션·꽃가루·클러치 연출)를 빼고 글자만 보여줘요.
 * 고른 값은 이 브라우저에 저장하고 <html data-text-only>로 적용해요. 그림 컴포넌트는 useTextOnly()를 보고 아예 그리지 않고,
 * 남은 꾸밈과 애니메이션은 globals.css 맨 아래의 [data-text-only] 규칙이 꺼요.
 */

import { useSyncExternalStore } from "react";

export const TEXT_ONLY_KEY = "b2r-text-only";

/** 첫 화면이 그려지기 전에 저장된 값을 적용하는 스크립트(layout.tsx). 테마 스크립트 뒤에 이어 붙여요. */
export const TEXT_ONLY_BOOT = `try{if(localStorage.getItem("${TEXT_ONLY_KEY}")==="1")document.documentElement.dataset.textOnly=""}catch(e){}`;

const listeners = new Set<() => void>();

/** 지금 텍스트만 보기인지. 타이머·그리기처럼 렌더 밖에서 물어볼 때 써요. */
export function textOnly(): boolean {
  return typeof document !== "undefined" && document.documentElement.dataset.textOnly !== undefined;
}

export function applyTextOnly(on: boolean): void {
  const root = document.documentElement;
  if (on) root.dataset.textOnly = "";
  else delete root.dataset.textOnly;
  try {
    if (on) localStorage.setItem(TEXT_ONLY_KEY, "1");
    else localStorage.removeItem(TEXT_ONLY_KEY);
  } catch {
    // 저장이 막힌 브라우저에서는 이번 방문 동안만 적용돼요.
  }
  listeners.forEach((fn) => fn());
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** 텍스트만 보기인지. 설정에서 바꾸면 바로 다시 그려요. 서버에서는 늘 false예요. */
export function useTextOnly(): boolean {
  return useSyncExternalStore(subscribe, textOnly, () => false);
}
