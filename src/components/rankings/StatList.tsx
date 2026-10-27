import { fmtNum } from "@/game";
import type { StatEntry, StatKey } from "@/lib/leaderboard/types";
import { nameFit } from "@/components/common/format";
import { Sprite } from "@/components/common/Sprite";
import { RankMark } from "./RankingList";
import { jerseyOf, lookOf } from "./look";

/** 스탯 랭킹 칩 이름과 단위 */
export const STAT_LABELS: Record<StatKey, { name: string; unit: string }> = {
  pts: { name: "득점", unit: "점" },
  reb: { name: "리바운드", unit: "개" },
  ast: { name: "어시스트", unit: "개" },
  stl: { name: "스틸", unit: "개" },
  blk: { name: "블록", unit: "개" },
  tpm: { name: "3점슛", unit: "개" },
};

/** 스탯 랭킹 목록: 순위, 선수, 경기당 기록, 오른쪽에 프로 통산 값 */
export function StatList({ rows, stat, mine }: { rows: StatEntry[]; stat: StatKey; mine: Set<string> }) {
  const { unit } = STAT_LABELS[stat];
  return (
    <ol className="rk-list rk-stat">
      {rows.map((e) => (
        <li key={e.id} data-mine={mine.has(e.id) || undefined}>
          <RankMark rank={e.rank} />
          <Sprite look={lookOf(e.id, e.look)} color={jerseyOf(e.team)} scale={2} className="rk-mini" label={`${e.name} 캐릭터`} />
          <span className="rk-who">
            <b style={nameFit(`${e.name} #${e.num}`)}>
              {e.name} <span className="num">#{e.num}</span>
              {mine.has(e.id) && <span className="me">나</span>}
            </b>
            <span className="sub">
              {e.pos} · {fmtNum(e.gp)}경기{e.gp > 0 && ` · 경기당 ${(e.value / e.gp).toFixed(1)}`}
            </span>
          </span>
          <span className="rk-val">
            {fmtNum(e.value)}
            <small>{unit}</small>
          </span>
        </li>
      ))}
    </ol>
  );
}
