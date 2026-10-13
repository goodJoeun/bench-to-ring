import { POS_KEYS } from "./data";
import type { CareerSummary, PosKey } from "./types";

/** GBL MVP 횟수 → 최고 오버롤 → 개인상 → 통산 득점 */
export function compareCareers(a: CareerSummary, b: CareerSummary): number {
  return b.mvp - a.mvp || b.peak - a.peak || b.personal - a.personal || b.pts - a.pts;
}

export interface RankedCareer {
  rank: number;
  career: CareerSummary;
}

/** 네 항목이 모두 같으면 공동 순위예요. */
export function rankHall(hall: CareerSummary[]): RankedCareer[] {
  const sorted = [...hall].sort(compareCareers);
  let rank = 0;
  return sorted.map((career, i) => {
    if (i === 0 || compareCareers(sorted[i - 1], career) !== 0) rank = i + 1;
    return { rank, career };
  });
}

export function bestFive(hall: CareerSummary[]): { pos: PosKey; career: CareerSummary | null }[] {
  const sorted = [...hall].sort(compareCareers);
  return POS_KEYS.map((pos) => ({ pos, career: sorted.find((h) => h.pos === pos) ?? null }));
}
