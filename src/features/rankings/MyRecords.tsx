import { Fragment, useState } from "react";
import { Link } from "@/shared/ui/Link";
import { fmtNum, rankHall, type CareerSummary } from "@/game";
import { gameActions } from "@/shared/store/game-store";
import type { MyRanks } from "@/shared/leaderboard/types";
import { nameFit } from "@/shared/lib/format";
import { DeleteRecordButton, DeleteRecordSheet } from "@/shared/ui/DeleteRecordSheet";
import { Sprite } from "@/shared/ui/sprite/Sprite";
import { StatTiles } from "@/shared/ui/ui";
import { jerseyOf, lookOf } from "../../shared/ui/sprite/look";
import { RankMark } from "./RankingList";
import { RankNeighbors } from "./RankNeighbors";
import styles from "./rankings.module.css";

interface MyRecordsProps {
  /** 이 브라우저에서 은퇴한 선수들 */
  hall: CareerSummary[];
  /** 온라인 순위. 불러오는 중이면 undefined, 올린 적이 없거나 서버가 안 되면 null */
  mine: MyRanks | null | undefined;
  /** 아직 올리지 못하고 기다리는 커리어 id */
  pending: Set<string>;
  /** 엔딩을 다시 볼 수 있는 커리어 id. 이 기능 전에 은퇴한 선수는 요약만 남아 없어요. */
  endings: Set<string>;
  /** 주변 순위를 펼친 커리어 id */
  near: string | null;
  onNear: (careerId: string | null) => void;
}

/**
 * 나의 기록: 이 브라우저에서 은퇴한 선수들을 랭킹과 같은 기준으로 줄 세우고, 온라인 순위를 붙여요.
 * 온라인에 올라간 선수는 바로 위아래 순위를 펼쳐 볼 수 있어요.
 * 줄마다 휴지통 단추로 기록을 지울 수 있어요(이 브라우저와 온라인 랭킹 모두에서).
 */
export function MyRecords({ hall, mine, pending, endings, near, onNear }: MyRecordsProps) {
  const [deleting, setDeleting] = useState<CareerSummary | null>(null);
  const online = new Map((mine?.careers ?? []).map((c) => [c.careerId, c]));
  // 브라우저에는 최근 은퇴 기록만 남아요. 최고 기록이 목록에서 빠졌어도 '내 최고 순위'의 주변 순위는 보여줘요.
  const nearElsewhere = near && online.has(near) && !hall.some((s) => s.id === near) ? near : null;
  if (!hall.length && !nearElsewhere)
    return (
      <div className={styles.rkEmpty}>
        <b>아직 은퇴한 선수가 없어요</b>
        <span>프로 무대를 밟은 선수가 은퇴하면 여기에 쌓이고, 온라인 랭킹에도 저절로 올라가요.</span>
        <Link className="btn" href="/">
          게임으로
        </Link>
      </div>
    );

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
      <p className="hint">마음에 들지 않는 기록은 휴지통 단추로 지울 수 있어요. 이 브라우저와 온라인 랭킹에서 함께 지워져요.</p>
      {nearElsewhere && (
        <section className={styles.rkNearSolo} aria-labelledby="rk-near-solo-title">
          <div className={styles.rkNearHead}>
            <b id="rk-near-solo-title">내 최고 기록 주변</b>
            <button type="button" className={styles.rkNearBtn} onClick={() => onNear(null)}>
              접기 <span aria-hidden="true">▴</span>
            </button>
          </div>
          <RankNeighbors careerId={nearElsewhere} />
        </section>
      )}
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
          const nearOpen = near === s.id && !!o;
          return (
            <Fragment key={s.id}>
              <li>
                <RankMark rank={rank} />
                <Sprite look={lookOf(s.id, s.look, s.pos)} color={jerseyOf(s.teams.at(-1))} scale={2} className="rk-mini" label={`${s.name} 캐릭터`} />
                <span className="rk-who">
                  <b style={nameFit(`${s.name} #${s.num}`)}>
                    {s.name} <span className="num">#{s.num}</span>
                  </b>
                  <span className="sub">
                    {s.pos} · OVR {s.peak} · {s.legacy} · {s.retYear}년 은퇴
                  </span>
                  <span className={styles.rkOn} data-on={o ? "" : undefined}>
                    {status}
                  </span>
                  {o && (
                    <button type="button" className={styles.rkNearBtn} aria-expanded={nearOpen} onClick={() => onNear(nearOpen ? null : s.id)}>
                      {nearOpen ? "주변 순위 접기" : "주변 순위 보기"}
                      <span aria-hidden="true">{nearOpen ? "▴" : "▾"}</span>
                    </button>
                  )}
                </span>
                <span className="rk-acts">
                  {endings.has(s.id) && (
                    <Link className="btn rk-end" href="/" onClick={() => gameActions.openEnding(s.id)}>
                      엔딩 보기
                    </Link>
                  )}
                  <DeleteRecordButton career={s} onClick={() => setDeleting(s)} />
                </span>
              </li>
              {nearOpen && (
                <li className={styles.rkNearWrap}>
                  <RankNeighbors careerId={s.id} />
                </li>
              )}
            </Fragment>
          );
        })}
      </ol>
      {deleting && <DeleteRecordSheet career={deleting} onClose={() => setDeleting(null)} />}
    </>
  );
}
