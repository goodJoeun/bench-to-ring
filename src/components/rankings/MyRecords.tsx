import Link from "next/link";
import { fmtNum, rankHall, rankScore, type CareerSummary } from "@/game";
import type { MyRanks } from "@/lib/leaderboard/types";
import { Sprite } from "@/components/common/Sprite";
import { StatTiles } from "@/components/common/ui";
import { fmtScore, jerseyOf, lookOf } from "./look";

interface MyRecordsProps {
  /** 이 브라우저에서 은퇴한 선수들 */
  hall: CareerSummary[];
  /** 온라인 순위. 불러오는 중이면 undefined, 올린 적이 없거나 서버가 안 되면 null */
  mine: MyRanks | null | undefined;
  /** 아직 올리지 못하고 기다리는 커리어 id */
  pending: Set<string>;
}

/** 나의 기록: 이 브라우저에서 은퇴한 선수들을 랭킹 점수로 줄 세우고, 온라인 순위를 붙여요. */
export function MyRecords({ hall, mine, pending }: MyRecordsProps) {
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
          ["최고 점수", fmtScore(Math.max(...hall.map(rankScore)))],
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
            <li key={s.id}>
              <span className="rk-r">{rank}</span>
              <Sprite {...lookOf(s.id, s.look)} color={jerseyOf(s.teams.at(-1))} scale={2} className="rk-mini" label={`${s.name} 도트 캐릭터`} />
              <span className="rk-who">
                <b>
                  {s.name} <span className="num">#{s.num}</span>
                </b>
                <span className="sub">
                  {s.pos} · OVR {s.peak} · {s.legacy} · {s.retYear}년 은퇴
                </span>
                <span className="rk-on" data-on={o ? "" : undefined}>
                  {status}
                </span>
              </span>
              <span className="rk-score">{fmtScore(rankScore(s))}</span>
            </li>
          );
        })}
      </ol>
    </>
  );
}
