import { FOCUS, type Career, type FocusKey } from "@/game";

/* 여러 화면이 같이 쓰는 문구와 색 */

/** 소속팀이 없을 때(무소속, 드래프트 대기)의 유니폼 색 */
export const NO_TEAM_COLOR = "#5A6577";

export const focusName = (k: FocusKey): string => FOCUS.find(([f]) => f === k)?.[1] ?? "";

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
