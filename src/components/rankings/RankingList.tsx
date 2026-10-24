import { fmtNum } from "@/game";
import type { BoardEntry } from "@/lib/leaderboard/types";
import { Sprite } from "@/components/common/Sprite";
import { fmtScore, jerseyOf, lookOf } from "./look";

/** 이름 아래 한 줄: 포지션·최고 오버롤과 큰 상 */
function line(e: BoardEntry): string {
  const parts = [`${e.pos} · OVR ${e.peak}`];
  if (e.mvp) parts.push(`NBA MVP ${e.mvp}`);
  if (e.fmvp) parts.push(`파이널 MVP ${e.fmvp}`);
  if (e.leagueMvp) parts.push(`리그 MVP ${e.leagueMvp}`);
  if (e.rings) parts.push(`반지 ${e.rings}`);
  parts.push(`통산 ${fmtNum(e.pts)}점`);
  return parts.join(" · ");
}

function Podium({ e, place, rank, mine }: { e: BoardEntry; place: 1 | 2 | 3; rank: number; mine: boolean }) {
  return (
    <div className="rk-pod" data-place={place} data-mine={mine || undefined}>
      <span className="rk-r">{rank}</span>
      <Sprite {...lookOf(e.id, e.look)} color={jerseyOf(e.team)} scale={3} className="rk-sprite" label={`${e.name} 도트 캐릭터`} />
      <b className="nm">
        {e.name}
        {mine && <span className="me">나</span>}
      </b>
      <span className="sub">
        {e.pos} · OVR {e.peak} · {e.legacy}
      </span>
      <span className="rk-badge">{fmtScore(e.score)}점</span>
    </div>
  );
}

/** 랭킹: 1~3위는 단상, 그 아래는 줄로 보여줘요. 포지션을 골랐으면 포지션 순위예요. */
export function RankingList({ rows, byPos, mine }: { rows: BoardEntry[]; byPos: boolean; mine: Set<string> }) {
  const rankOf = (e: BoardEntry) => (byPos ? e.posRank : e.rank);
  const podium = rows.slice(0, 3);
  // 단상은 2·1·3위 순서로 놓아요.
  const order = [podium[1], podium[0], podium[2]];
  return (
    <>
      <div className="rk-podium">
        {order.map((e, i) =>
          e ? <Podium key={e.id} e={e} place={([2, 1, 3] as const)[i]} rank={rankOf(e)} mine={mine.has(e.id)} /> : <div key={i} aria-hidden="true" />,
        )}
      </div>
      {rows.length > 3 && (
        <ol className="rk-list" start={4}>
          {rows.slice(3).map((e) => (
            <li key={e.id} data-mine={mine.has(e.id) || undefined}>
              <span className="rk-r">{rankOf(e)}</span>
              <Sprite {...lookOf(e.id, e.look)} color={jerseyOf(e.team)} scale={2} className="rk-mini" label={`${e.name} 도트 캐릭터`} />
              <span className="rk-who">
                <b>
                  {e.name} <span className="num">#{e.num}</span>
                  {mine.has(e.id) && <span className="me">나</span>}
                </b>
                <span className="sub">{line(e)}</span>
              </span>
              <span className="rk-score">{fmtScore(e.score)}</span>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
