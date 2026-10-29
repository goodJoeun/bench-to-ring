"use client";

import { useEffect, useEffectEvent } from "react";
import type { ClutchBoard } from "@/game";
import { reducedMotion } from "@/components/common/hooks";
import { TeamBadge } from "@/components/common/TeamBadge";

/**
 * 클러치 결정 위에 띄우는 전광판: 4쿼터 0:24, 우리 팀과 상대의 엠블럼·이름·동점 점수.
 * 경기 시계가 깜빡여요. 예전 저장처럼 전광판 정보가 없으면 점수 없이 '동점'만 보여줘요.
 */
export function ClutchArt({ board }: { board?: ClutchBoard }) {
  return (
    <div className="cl-art" aria-label={board ? `4쿼터 24초 남기고 ${board.team} ${board.tie} 대 ${board.opp} ${board.tie} 동점` : "4쿼터 24초 남기고 동점"} role="img">
      <div className="cl-board">
        {board && <Side name={board.team} color={board.teamColor} lg={board.lg} score={board.tie} tag="우리 팀" />}
        <div className="cl-mid">
          <span className="cl-q">4Q</span>
          <b className="cl-clock">0:24</b>
          <span className="cl-tie">동점</span>
        </div>
        {board && <Side name={board.opp} color={board.oppColor} lg={board.lg} score={board.tie} tag="상대" />}
      </div>
    </div>
  );
}

function Side({ name, color, lg, score, tag }: { name: string; color: string; lg: ClutchBoard["lg"]; score: number; tag: string }) {
  return (
    <div className="cl-side">
      <TeamBadge name={name} kind={lg} color={color} size={30} />
      <span className="cl-name">{name}</span>
      <b className="cl-score">{score}</b>
      <span className="cl-tag">{tag}</span>
    </div>
  );
}

/** 이펙트를 보여주는 시간(ms). 끝나면 클러치 결정 시트가 올라와요. */
const FLASH_MS = 1500;

/** 시즌 진행 중 클러치가 걸리면 화면 가운데 번개와 불꽃이 번쩍이고 'CLUTCH TIME'이 떠요. 끝나면 onDone을 불러요. */
export function ClutchFlash({ onDone }: { onDone: () => void }) {
  // 다시 그려져도 타이머가 처음부터 다시 돌지 않게, 끝낼 때의 onDone만 불러요.
  const done = useEffectEvent(onDone);
  useEffect(() => {
    const timer = setTimeout(() => done(), reducedMotion() ? 500 : FLASH_MS);
    return () => clearTimeout(timer);
  }, []);
  return (
    <div className="cl-flash" role="status" aria-live="assertive" onClick={onDone}>
      <div className="cl-flash-core">
        <svg className="cl-bolt cl-bolt-l" viewBox="0 0 40 80" aria-hidden="true">
          <path d="M24 0 4 44h14L10 80 36 30H21z" />
        </svg>
        <svg className="cl-fire" viewBox="0 0 100 120" aria-hidden="true">
          <path className="cl-fire-o" d="M50 2c6 22 30 30 30 62a30 30 0 0 1-60 0c0-14 6-22 12-30 2 10 6 14 10 16 0-20 2-34 8-48z" />
          <path className="cl-fire-i" d="M50 46c4 12 16 18 16 34a16 16 0 0 1-32 0c0-8 4-12 8-16 1 6 3 8 6 9 0-11 0-18 2-27z" />
        </svg>
        <svg className="cl-bolt cl-bolt-r" viewBox="0 0 40 80" aria-hidden="true">
          <path d="M24 0 4 44h14L10 80 36 30H21z" />
        </svg>
        <b className="cl-flash-t">CLUTCH TIME</b>
        <span className="cl-flash-s">4쿼터 마지막 24초, 동점</span>
      </div>
    </div>
  );
}

/** 결과 이펙트를 보여주는 시간(ms) */
const RESULT_MS = 1900;

const CONFETTI = ["#ffd25a", "#ff5a4a", "#4fb3e8", "#7bd389", "#ffffff"];

/**
 * 클러치 결과 이펙트. 성공이면 금빛 빛줄기와 꽃가루 속에 'CLUTCH!'와 승리 점수가,
 * 실패면 화면이 어두워지고 금이 가며 '아쉬운 실패'와 패배 점수가 떠요. 끝나면 onDone을 불러요.
 */
export function ClutchResult({ result, onDone }: { result: { win: boolean; us?: number; them?: number; opp?: string }; onDone: () => void }) {
  const done = useEffectEvent(onDone);
  useEffect(() => {
    const timer = setTimeout(() => done(), reducedMotion() ? 700 : RESULT_MS);
    return () => clearTimeout(timer);
  }, []);
  const { win, us, them, opp } = result;
  const score = us !== undefined && them !== undefined ? `${us} : ${them}` : null;
  return (
    <div className="cl-res" data-win={win || undefined} role="status" aria-live="assertive" onClick={onDone}>
      {win ? (
        <>
          <span className="cl-rays" aria-hidden="true" />
          {Array.from({ length: 18 }, (_, i) => (
            <i
              key={i}
              className="cl-conf"
              aria-hidden="true"
              style={{ "--x": `${(i * 37) % 100}%`, "--d": `${(i % 6) * 0.08}s`, "--c": CONFETTI[i % CONFETTI.length] } as React.CSSProperties}
            />
          ))}
        </>
      ) : (
        <svg className="cl-crack" viewBox="0 0 200 200" preserveAspectRatio="none" aria-hidden="true">
          <path d="M100 96 72 40 60 0M100 96 140 52 176 30M100 96 150 120 200 116M100 96 118 150 110 200M100 96 54 132 0 150M100 96 30 84 0 70M72 40 48 52M140 52 150 22M118 150 142 172M54 132 50 168" />
        </svg>
      )}
      <div className="cl-res-core">
        <b className="cl-res-t">{win ? "CLUTCH!" : "아쉬운 실패"}</b>
        <span className="cl-res-s">
          {win ? "마지막 플레이 성공 · 승리" : "마지막 플레이 실패 · 패배"}
          {score && (
            <>
              <br />
              <span className="cl-res-score">{score}</span>
              {opp && <span className="cl-res-opp"> vs {opp}</span>}
            </>
          )}
        </span>
      </div>
    </div>
  );
}
