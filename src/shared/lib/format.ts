import type { CSSProperties } from "react";
import { FOCUS, type Career, type FocusKey } from "@/game";

/* 여러 화면이 같이 쓰는 문구와 색 */

/** 소속팀이 없을 때(무소속, 드래프트 대기)의 유니폼 색 */
export const NO_TEAM_COLOR = "#5A6577";

export const focusName = (k: FocusKey): string => FOCUS.find(([f]) => f === k)?.[1] ?? "";

/** 글자 폭: 한글·한자·가나는 2, 띄어쓰기는 0.6, 그 밖(영문·숫자·기호)은 1.2로 쳐요. 굵은 글꼴의 영문이 넓어서요. */
const WIDE = /[ᄀ-ᇿ㄰-㆏가-힣぀-ヿ一-鿿]/;
const textWidth = (s: string): number => [...s].reduce((w, ch) => w + (WIDE.test(ch) ? 2 : ch === " " ? 0.6 : 1.2), 0);

/**
 * 선수 이름 길이를 CSS 변수로 넘겨요: --nw는 전체 폭, --lw는 가장 긴 낱말 폭이에요(한글 한 글자가 2).
 * 이름이 나오는 칸은 이 값과 칸 너비(cqi)로 글자 크기를 줄여, 20자 이름도 한두 줄에 들어가게 해요(globals.css "긴 선수 이름").
 */
export function nameFit(text: string): CSSProperties {
  const t = text.trim();
  const lw = Math.max(1, ...t.split(/\s+/).map(textWidth));
  return { "--nw": Math.max(1, textWidth(t)).toFixed(1), "--lw": lw.toFixed(1) } as CSSProperties;
}

/**
 * 한 줄 문구가 어색하게 끊기지 않게: 가운뎃점(·)은 앞 낱말에 붙여서 줄 첫머리에 오지 않고,
 * 점수(4-2, 113-106)는 '-'에서 갈라지지 않아요. 소식처럼 엔진이 만든 문장에 써요.
 */
export const keepTogether = (s: string): string => s.replace(/ · /g, " · ").replace(/(\d)-(\d)/g, "$1⁠-⁠$2");

/** 병역 상태 한 줄. 대한민국 선수만 보여줘요. */
export function militaryLine(c: Career): string | null {
  if (c.p.nat !== "대한민국") return null;
  const m = c.mil;
  if (m.s === "exempt") return "병역 특례 (예술체육요원)";
  if (m.s === "served") return m.kind === "sangmu" ? "상무 복무 마침" : "현역 복무 마침";
  if (m.s === "serving") return m.kind === "sangmu" ? "상무 복무 중" : "현역 복무 중";
  return "병역 미필 · 만 28세까지 입대해야 해요";
}

/** 병역 상태를 설명 없이 짧게: "병역 미필" */
export const militaryShort = (c: Career): string | null => militaryLine(c)?.split(" · ")[0] ?? null;
