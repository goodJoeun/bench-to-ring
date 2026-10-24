/* 화면 테마: 시스템(기기 설정 따라), 라이트, 다크. 고른 값은 이 브라우저에 저장하고 <html data-theme>로 적용해요. */

export type Theme = "system" | "light" | "dark";

export const THEME_KEY = "b2r-theme";

/**
 * 첫 화면이 그려지기 전에 저장된 테마를 적용하는 스크립트(layout.tsx의 <head>).
 * 이게 없으면 다크를 골라도 새로고침할 때 잠깐 밝은 화면이 번쩍여요.
 */
export const THEME_BOOT = `try{var t=localStorage.getItem("${THEME_KEY}");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export function readTheme(): Theme {
  try {
    const t = localStorage.getItem(THEME_KEY);
    return t === "light" || t === "dark" ? t : "system";
  } catch {
    return "system";
  }
}

export function applyTheme(t: Theme): void {
  const root = document.documentElement;
  if (t === "system") delete root.dataset.theme;
  else root.dataset.theme = t;
  try {
    if (t === "system") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, t);
  } catch {
    // 저장이 막힌 브라우저에서는 이번 방문 동안만 적용돼요.
  }
}
