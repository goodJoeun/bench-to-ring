import { fmtNum } from "@/game";
import type { BoardEntry } from "@/lib/leaderboard/types";
import { Sprite } from "@/components/common/Sprite";
import { jerseyOf, lookOf, medalOf } from "./look";

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

/** 순위 숫자. 1~3위는 금·은·동 메달로 보여줘요. */
export function RankMark({ rank }: { rank: number }) {
  return (
    <span className="rk-r" data-medal={medalOf(rank)}>
      {rank}
    </span>
  );
}

/** 시상대 한 칸: 선수가 위에 서고, 아래 단에 메달과 순위가 있어요. 1위 단이 가장 높아요. */
function Podium({ e, place, rank, mine }: { e: BoardEntry; place: 1 | 2 | 3; rank: number; mine: boolean }) {
  const medal = medalOf(rank) ?? "bronze";
  return (
    <div className="rk-pod" data-place={place} data-mine={mine || undefined}>
      <Sprite {...lookOf(e.id, e.look)} color={jerseyOf(e.team)} scale={3} className="rk-sprite" label={`${e.name} 도트 캐릭터`} />
      <b className="nm">
        {e.name}
        {mine && <span className="me">나</span>}
      </b>
      <span className="sub">
        {e.pos} · OVR {e.peak}
      </span>
      <div className="rk-step" data-medal={medal}>
        <span className="rk-medal" aria-hidden="true">
          {rank}
        </span>
        <span className="lbl">{rank}위</span>
      </div>
    </div>
  );
}

/** 랭킹: 1~3위는 시상대, 그 아래는 줄로 보여줘요. 포지션을 골랐으면 포지션 순위예요. */
export function RankingList({ rows, byPos, mine }: { rows: BoardEntry[]; byPos: boolean; mine: Set<string> }) {
  const rankOf = (e: BoardEntry) => (byPos ? e.posRank : e.rank);
  const podium = rows.slice(0, 3);
  // 시상대는 2·1·3위 순서로 놓아요.
  const order = [podium[1], podium[0], podium[2]];
  return (
    <>
      <div className="rk-podium">
        {order.map((e, i) =>
          e ? <Podium key={e.id} e={e} place={([2, 1, 3] as const)[i]} rank={rankOf(e)} mine={mine.has(e.id)} /> : <div key={i} aria-hidden="true" />,
        )}
      </div>
      {rows.length > 3 && (
        <ol className="rk-list">
          {rows.slice(3).map((e) => (
            <li key={e.id} data-mine={mine.has(e.id) || undefined}>
              <RankMark rank={rankOf(e)} />
              <Sprite {...lookOf(e.id, e.look)} color={jerseyOf(e.team)} scale={2} className="rk-mini" label={`${e.name} 도트 캐릭터`} />
              <span className="rk-who">
                <b>
                  {e.name} <span className="num">#{e.num}</span>
                  {mine.has(e.id) && <span className="me">나</span>}
                </b>
                <span className="sub">{line(e)}</span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
