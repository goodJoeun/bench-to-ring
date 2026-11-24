"use client";

import { Link } from "@/shared/ui/Link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ATTR_KEYS, POS, POS_KEYS, SHORT, dailyChallenge, fmtNum, type PosKey } from "@/game";
import { ChallengeGuide } from "@/features/guide/ChallengeGuide";
import { challengeQuery, myChallengeQuery } from "@/shared/leaderboard/queries";
import { loadState } from "@/shared/query/load-state";
import { Loading } from "@/shared/ui/ui";
import { RankingList } from "./RankingList";
import styles from "./rankings.module.css";

/** 날짜 칩 이름: 오늘·어제, 그 앞은 월.일 */
const chipLabel = (day: string, ago: number) => (ago === 0 ? "오늘" : ago === 1 ? "어제" : `${day.slice(5, 7)}.${day.slice(8)}`);
/** 문장에 쓰는 날짜 이름 */
const dayName = (day: string, ago: number) => (ago === 0 ? "오늘" : ago === 1 ? "어제" : `${Number(day.slice(5, 7))}월 ${Number(day.slice(8))}일`);

/**
 * 챌린지 랭킹 탭: 날짜와 포지션을 고르면 그날 그 포지션의 챌린지 선수와 순위표를 보여줘요.
 * 같은 선수로 시작한 기록끼리만 겨루고, 한 사람이 여러 번 도전했으면 가장 좋은 기록 하나만 순위에 들어가요.
 * days는 오늘부터 거꾸로 일주일(한국 시간)이에요.
 */
export function ChallengeTab({ days }: { days: string[] }) {
  const [ago, setAgo] = useState(0);
  const [pos, setPos] = useState<PosKey>("PG");
  const [help, setHelp] = useState(false);
  const day = days[ago] ?? "";
  const { data: board, loading, retry } = loadState(useQuery(challengeQuery(day)));
  const mine = useQuery(myChallengeQuery(day)).data;
  if (!day) return null;

  const spec = dailyChallenge(day, pos);
  const b = board?.boards[pos];
  const me = mine?.mine.find((m) => m.pos === pos);
  const myIds = new Set((mine?.mine ?? []).map((m) => m.id));
  const when = dayName(day, ago);

  return (
    <>
      <div className={styles.chAbout}>
        <p className="hint">
          챌린지는 매일 포지션마다 누구나 같은 선수로 시작하는 모드예요. 같은 조건에서 시작한 기록끼리만 순위를 매겨요. 선수는 매일
          0시(한국 시간)에 바뀌어요.
        </p>
        <button type="button" className="ch-help" onClick={() => setHelp(true)}>
          <span aria-hidden="true">?</span> 챌린지 모드란
        </button>
      </div>
      <div className={`${styles.rkChips} ${styles.rkDays}`} role="group" aria-label="날짜 고르기">
        {days.map((d, i) => (
          <button key={d} type="button" aria-pressed={ago === i} onClick={() => setAgo(i)}>
            {chipLabel(d, i)}
          </button>
        ))}
      </div>
      <div className={styles.rkChips} role="group" aria-label="포지션 고르기">
        {POS_KEYS.map((p) => (
          <button key={p} type="button" aria-pressed={pos === p} onClick={() => setPos(p)}>
            {p} <span>{POS[p].name}</span>
          </button>
        ))}
      </div>

      <div className={styles.chSpec}>
        <span className="label">
          {when}의 {pos} 챌린지 선수
        </span>
        <b>{spec.cand.arch}</b>
        <span className="sub">
          {spec.nat} · {spec.school} · 키 {spec.cand.h}cm · 윙스팬 {spec.cand.h + spec.cand.wsd}cm
        </span>
        <span className="sub">{ATTR_KEYS.map((k) => `${SHORT[k]} ${spec.cand.attrs[k]}`).join(" · ")}</span>
        {ago === 0 && (
          <Link className="btn" href="/">
            게임 첫 화면에서 도전하기
          </Link>
        )}
      </div>

      {loading ? (
        <Loading label="챌린지 순위표를 불러오고 있어요" rows={8} />
      ) : !b ? (
        <div className="row">
          <p className="empty" role="status">
            챌린지 순위표를 불러오지 못했어요. 잠시 뒤에 다시 해 주세요.
          </p>
          <button type="button" className="btn" onClick={retry}>
            다시 불러오기
          </button>
        </div>
      ) : !b.top.length ? (
        <div className={styles.rkEmpty}>
          <b>
            {when} {POS[pos].name}({pos}) 챌린지에 올라온 기록이 {ago === 0 ? "아직 " : ""}없어요
          </b>
          <span>챌린지 선수로 프로 무대를 밟고 은퇴하면 순위표에 올라가요.</span>
        </div>
      ) : (
        <>
          <p className={`hint ${styles.rkDayCount}`} role="status">
            {when} {pos} 챌린지 · 도전 <b>{fmtNum(b.players)}</b>명 · 기록 <b>{fmtNum(b.runs)}</b>개
            {me && (
              <>
                {" "}
                · 내 순위 <b>{fmtNum(me.rank)}</b>위 (도전 {fmtNum(me.tries)}회)
              </>
            )}
          </p>
          <RankingList rows={b.top} byPos={false} mine={myIds} rankText={(e) => `${when} ${e.pos} 챌린지 ${fmtNum(e.rank)}위`} />
        </>
      )}
      <p className="hint">
        순위 기준은 일반 랭킹과 같아요. 한 사람이 여러 번 도전하면 가장 좋은 기록 하나만 순위에 들어가요. 챌린지 기록은 일반 랭킹에도
        함께 올라가고, 시작한 날과 그다음 날까지 은퇴해서 올린 기록만 챌린지 순위에 들어가요.
      </p>
      {help && <ChallengeGuide onClose={() => setHelp(false)} />}
    </>
  );
}
