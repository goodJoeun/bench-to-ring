import type { PosKey } from "@/game";
import type { BoardEntry } from "@/lib/leaderboard/types";
import { nameFit } from "@/components/common/format";
import { Sprite } from "@/components/common/Sprite";
import { jerseyOf, lookOf } from "./look";

/** 하프 코트 위 자리 (가로·세로 %). 골대가 위에 있어요. */
const SPOTS: Record<PosKey, { x: number; y: number }> = {
  C: { x: 50, y: 21 },
  PF: { x: 19, y: 38 },
  SF: { x: 81, y: 38 },
  PG: { x: 31, y: 74 },
  SG: { x: 69, y: 74 },
};

/** 하프 코트 선 (500×470, 1칸 = 0.1피트). 골대 중심 (250, 52)에서 3점 라인 반지름 237.5 */
function CourtLines() {
  return (
    <svg className="rk-lines" viewBox="0 0 500 470" preserveAspectRatio="none" aria-hidden="true">
      <rect className="paint" x="170" y="0" width="160" height="190" />
      <path d="M190 190 A60 60 0 0 0 310 190" />
      <path d="M190 190 A60 60 0 0 1 310 190" strokeDasharray="10 10" />
      <path d="M30 0 V141.5 A237.5 237.5 0 0 0 470 141.5 V0" />
      <path d="M220 40 H280" className="board" />
      <circle cx="250" cy="52" r="9" />
      <path d="M190 470 A60 60 0 0 1 310 470" />
      <rect x="1" y="1" width="498" height="468" />
    </svg>
  );
}

/** 역대 Best 5: 포지션마다 1위를 코트 위에 세워요. */
export function BestFiveCourt({ best5, mine }: { best5: { pos: PosKey; career: BoardEntry | null }[]; mine: Set<string> }) {
  return (
    <div className="rk-court">
      <CourtLines />
      {best5.map(({ pos, career: e }) => (
        <div className="rk-spot" key={pos} style={{ left: `${SPOTS[pos].x}%`, top: `${SPOTS[pos].y}%` }}>
          {e ? (
            <>
              <Sprite look={lookOf(e.id, e.look)} color={jerseyOf(e.team)} scale={3} className="rk-sprite" label={`${e.name} 캐릭터`} />
              <span className="rk-plate" data-mine={mine.has(e.id) || undefined}>
                <b style={nameFit(e.name)}>{e.name}</b>
                <span>
                  {pos} · OVR {e.peak}
                </span>
              </span>
            </>
          ) : (
            <span className="rk-plate empty">
              <b>{pos}</b>
              <span>비어 있음</span>
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
