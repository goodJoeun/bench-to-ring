import { LOOKS, LOOK_KEYS, teamColor, toLook, type Look, type LookRecord } from "@/game";
import { NO_TEAM_COLOR } from "@/components/common/format";

/** 기록 id로 늘 같은 값을 골라요. 캐릭터가 없는 예전 기록에 써요. */
function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** 선수 캐릭터. 캐릭터를 고르기 전 기록은 피부색으로, 색도 없는 예전 기록은 id로 정해요. */
export function lookOf(id: string, look: LookRecord | null | undefined): Look {
  if (look) return toLook(look);
  const kind = LOOK_KEYS[hash(id) % LOOK_KEYS.length];
  return toLook({ kind, skin: LOOKS[kind].skins[hash(id) % LOOKS[kind].skins.length], hair: LOOKS[kind].hairs[0] });
}

/** 마지막 소속팀 유니폼 색 */
export const jerseyOf = (team: string | null | undefined): string => (team && teamColor(team)) || NO_TEAM_COLOR;

/** 1~3위의 메달 색 (금·은·동). 4위부터는 없어요. */
export const medalOf = (rank: number): "gold" | "silver" | "bronze" | undefined =>
  rank === 1 ? "gold" : rank === 2 ? "silver" : rank === 3 ? "bronze" : undefined;
