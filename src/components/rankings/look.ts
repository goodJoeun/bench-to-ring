import { HAIRS, SKINS, teamColor } from "@/game";
import { NO_TEAM_COLOR } from "@/components/common/format";

/** 기록 id로 늘 같은 값을 골라요. 도트 색이 없는 예전 기록에 써요. */
function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** 도트 캐릭터 색. 예전 기록은 id로 정해요. */
export function lookOf(id: string, look: { skin: string; hair: string } | null | undefined): { skin: string; hair: string } {
  if (look) return look;
  const h = hash(id);
  return { skin: SKINS[h % SKINS.length], hair: HAIRS[Math.floor(h / SKINS.length) % HAIRS.length] };
}

/** 마지막 소속팀 유니폼 색 */
export const jerseyOf = (team: string | null | undefined): string => (team && teamColor(team)) || NO_TEAM_COLOR;

/** 점수는 소수 첫째 자리까지, 정수면 소수점 없이 */
export const fmtScore = (n: number): string => (Number.isInteger(n) ? String(n) : n.toFixed(1));
