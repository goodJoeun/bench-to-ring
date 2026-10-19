"use client";

import { useState } from "react";
import { draftSlot, money, type Career, type DraftShow } from "@/game";
import { gameActions } from "@/lib/game-store";
import { NO_TEAM_COLOR } from "./format";
import { useReveal } from "./hooks";
import { Popup, PopupFooter, PopupHero } from "./Popup";

/** 다음 지명을 보여주기 전 기다리는 시간(ms) */
const OPENING_MS = 1800;
const ROUND_MS = 1600;
/** 스카우트 예상 범위 안에서는 한 명씩 천천히 불러요. */
const RANGE_MS = 1100;
const FAST_MS = 260;
/** 내 이름이 불리기 직전의 뜸 */
const MINE_MS = 2600;
const TAIL_MS = 1500;
/** 진행 중에 보여주는 최근 지명 수 */
const RECENT = 5;

/**
 * 드래프트 진행 화면. 결과는 이미 정해져 있고(c.draftShow), 1순위부터 지명을 하나씩 불러요.
 * 스카우트 예상 범위에 들어서면 속도가 느려지고, 내 이름이 불리기 직전에는 한 번 더 뜸을 들여요.
 */
export function DraftLoading({ career: c, show }: { career: Career; show: DraftShow }) {
  const count = show.mine ?? show.picks.length;
  const [stage, setStage] = useState<"picks" | "result">("picks");
  const delay = (i: number) => {
    const p = show.picks[i];
    if (i === 0) return OPENING_MS;
    if (p.mine) return MINE_MS;
    if (i === show.roundSize) return ROUND_MS;
    return p.no >= show.range[0] && p.no <= show.range[1] ? RANGE_MS : FAST_MS;
  };
  const [shown] = useReveal(count, delay, { running: stage === "picks", tail: TAIL_MS, onDone: () => setStage("result") });

  const done = stage === "result";
  const revealed = done ? count : shown;
  const next = !done && revealed < count ? show.picks[revealed] : null;
  const recent = show.picks.slice(Math.max(0, revealed - RECENT), revealed).reverse();
  const mine = show.mine ? show.picks[show.mine - 1] : null;
  const called = mine !== null && revealed >= count;
  const slot = mine && draftSlot(mine.no, show.roundSize);

  let status: string;
  if (called && slot) status = `${slot.round}라운드 ${slot.inRound}순위 · ${mine.team}`;
  else if (done || !next) status = "이름이 불리지 않았어요";
  else if (revealed === 0) status = `스카우트 예상 · ${show.proj}`;
  else if (next.mine) status = `${next.no}순위 · ${next.team}의 선택은`;
  else status = `${next.no}순위 · ${next.team} 지명 중`;

  return (
    <Popup labelledBy="draft-title" className="draft">
      <PopupHero
        player={c.p}
        color={called ? mine.color : NO_TEAM_COLOR}
        team={`${c.p.name} · ${called ? "지명 완료" : "그린룸에서 기다리는 중"}`}
        title={show.name}
        titleId="draft-title"
        status={status}
        busy={!done && !called}
      />
      {next && revealed > 0 && revealed === show.roundSize && <p className="draft-note">1라운드가 끝났어요. 2라운드를 시작해요.</p>}
      <ol className="draft-picks">
        {recent.map((p) => (
          <li key={p.no} data-mine={p.mine || undefined} style={{ "--tc": p.color } as React.CSSProperties}>
            <span className="dp-no">{p.no}</span>
            <span className="dp-team">{p.team}</span>
            <span className="dp-who">{p.who}</span>
          </li>
        ))}
      </ol>
      <PopupFooter done={done} onSkip={() => setStage("result")} onConfirm={() => gameActions.finishDraft()}>
        <p className="tour-story">
          {called && slot ? (
            <>
              <b>
                {slot.round}라운드 {slot.inRound}순위
              </b>
              {` (전체 ${mine.no}순위)로 ${mine.team}에 지명됐어요.`}
              {c.contract && ` 계약 ${c.contract.years}년 · 연봉 ${money(c.contract.salary)}.`}
              {` 스카우트 예상은 ${show.proj}였어요.`}
            </>
          ) : (
            `${show.picks.length}명이 불리는 동안 내 이름은 없었어요. 그래도 육성 계약이나 다른 리그로 갈 길은 남아 있어요.`
          )}
        </p>
      </PopupFooter>
    </Popup>
  );
}
