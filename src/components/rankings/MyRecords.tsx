import Link from "next/link";
import { fmtNum, rankHall, type CareerSummary } from "@/game";
import { gameActions } from "@/lib/game-store";
import type { MyRanks } from "@/lib/leaderboard/types";
import { nameFit } from "@/components/common/format";
import { Sprite } from "@/components/common/Sprite";
import { StatTiles } from "@/components/common/ui";
import { jerseyOf, lookOf } from "./look";
import { RankMark } from "./RankingList";

interface MyRecordsProps {
  /** 이 브라우저에서 은퇴한 선수들 */
  hall: CareerSummary[];
  /** 온라인 순위. 불러오는 중이면 undefined, 올린 적이 없거나 서버가 안 되면 null */
  mine: MyRanks | null | undefined;
  /** 아직 올리지 못하고 기다리는 커리어 id */
  pending: Set<string>;
  /** 엔딩을 다시 볼 수 있는 커리어 id. 이 기능 전에 은퇴한 선수는 요약만 남아 없어요. */
  endings: Set<string>;
}

/** 나의 기록: 이 브라우저에서 은퇴한 선수들을 랭킹과 같은 기준으로 줄 세우고, 온라인 순위를 붙여요. */
export function MyRecords({ hall, mine, pending, endings }: MyRecordsProps) {
  if (!hall.length)
    return (
      <div className="rk-empty">
        <b>아직 은퇴한 선수가 없어요</b>
        <span>프로 무대를 밟은 선수가 은퇴하면 여기에 쌓이고, 온라인 랭킹에도 저절로 올라가요.</span>
        <Link className="btn" href="/">
          게임으로
        </Link>
      </div>
    );

  const online = new Map((mine?.careers ?? []).map((c) => [c.careerId, c]));
  const best = mine?.careers[0];
  return (
    <>
      <StatTiles
        items={[
          ["은퇴한 선수", `${fmtNum(hall.length)}명`],
          ["온라인 최고 순위", best ? `${fmtNum(best.rank)}위` : "–"],
          ["올라온 전체 기록", mine ? `${fmtNum(mine.total)}명` : "–"],
        ]}
      />
      <ol className="rk-list mine">
        {rankHall(hall).map(({ rank, career: s }) => {
          const o = online.get(s.id);
          const status = o
            ? `온라인 전체 ${fmtNum(o.rank)}위 · ${s.pos} ${fmtNum(o.posRank)}위`
            : pending.has(s.id)
              ? "온라인 등록 대기 중"
              : mine === undefined
                ? "온라인 순위 확인 중"
                : "온라인 기록 없음";
          return (
            <li key={s.id} data-ending={endings.has(s.id) ? "" : undefined}>
              <RankMark rank={rank} />
              <Sprite look={lookOf(s.id, s.look)} color={jerseyOf(s.teams.at(-1))} scale={2} className="rk-mini" label={`${s.name} 캐릭터`} />
              <span className="rk-who">
                <b style={nameFit(`${s.name} #${s.num}`)}>
                  {s.name} <span className="num">#{s.num}</span>
                </b>
                <span className="sub">
                  {s.pos} · OVR {s.peak} · {s.legacy} · {s.retYear}년 은퇴
                </span>
                <span className="rk-on" data-on={o ? "" : undefined}>
                  {status}
                </span>
              </span>
              {endings.has(s.id) && (
                <Link className="btn rk-end" href="/" onClick={() => gameActions.openEnding(s.id)}>
                  엔딩 보기
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </>
  );
}
