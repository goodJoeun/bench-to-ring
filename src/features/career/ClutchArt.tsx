"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { CLUTCH_SCENES, boardScore, clutchScene, finalsPrize, type ClutchBoard, type ClutchMove } from "@/game";
import { reducedMotion } from "@/shared/lib/hooks";
import { TeamBadge } from "@/shared/ui/badge/TeamBadge";
import { ClutchMoveArt, MOVE_INFO, type ClutchCast } from "./ClutchMoveArt";

/**
 * 클러치 결정 위에 띄우는 전광판: 4쿼터 남은 시간, 우리 팀과 상대의 엠블럼·이름·점수, 상황(동점 · 2점 차 열세 · 2점 차 리드).
 * 경기 시계가 깜빡여요. 예전 저장처럼 전광판 정보가 없으면 점수 없이 '동점'만 보여줘요.
 * 결승 클러치면 금테를 두르고, 위에 트로피(국가대표는 메달)와 결승 이름 배너를 달아요.
 */
export function ClutchArt({ board }: { board?: ClutchBoard }) {
  const scene = CLUTCH_SCENES[clutchScene(board)];
  const [us, them] = board ? boardScore(board) : [0, 0];
  const secs = Number(scene.clock.split(":")[1]);
  const finals = board?.finals;
  const gold = board?.lg === "nat";
  return (
    <div
      className="cl-art"
      data-finals={finals ? "" : undefined}
      aria-label={
        (finals ? `${finals}, ${finalsPrize(board)[0]} 결정전. ` : "") +
        (board ? `4쿼터 ${secs}초 남기고 ${board.team} ${us} 대 ${board.opp} ${them} ${scene.state}` : `4쿼터 ${secs}초 남기고 ${scene.state}`)
      }
      role="img"
    >
      {finals && (
        <div className="cl-banner">
          {gold ? <MedalIcon className="cl-banner-icon" /> : <TrophyIcon className="cl-banner-icon" />}
          <span className="cl-banner-t">{finals}</span>
          <span className="cl-banner-s">{gold ? "금메달 결정전" : "우승 결정전"}</span>
        </div>
      )}
      <div className="cl-board">
        {board && <Side name={board.team} color={board.teamColor} lg={board.lg} score={us} tag="우리 팀" />}
        <div className="cl-mid">
          <span className="cl-q">4Q</span>
          <b className="cl-clock">{scene.clock}</b>
          <span className="cl-tie">{scene.state}</span>
        </div>
        {board && <Side name={board.opp} color={board.oppColor} lg={board.lg} score={them} tag="상대" />}
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

/** 우승 트로피 */
function TrophyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 72" aria-hidden="true">
      <path className="tr-cup" d="M14 4h36v18c0 12-8 22-18 22S14 34 14 22z" />
      <path className="tr-ear" d="M14 9H5c0 10 4 17 11 19M50 9h9c0 10-4 17-11 19" />
      <path className="tr-cup" d="M27 43h10l2 12H25z" />
      <rect className="tr-base" x="17" y="55" width="30" height="7" rx="2" />
      <rect className="tr-base" x="13" y="62" width="38" height="7" rx="2" />
      <path className="tr-shine" d="M22 9v13c0 6 3 11 7 14" />
    </svg>
  );
}

/** 금메달 */
function MedalIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 72" aria-hidden="true">
      <path className="md-ribbon" d="M16 2h12l8 22h-12zM48 2H36l-8 22h12z" />
      <circle className="tr-cup" cx="32" cy="46" r="22" />
      <circle className="md-ring" cx="32" cy="46" r="15" />
      <path className="md-star" d="m32 36 3 6.5 7 .8-5.2 4.8 1.4 7L32 51.6l-6.2 3.5 1.4-7-5.2-4.8 7-.8z" />
    </svg>
  );
}

/**
 * 이펙트를 보여주는 시간(ms). 끝나면 클러치 결정 시트가 올라와요. 결승 클러치는 조금 더 길어요.
 * 클러치 이펙트는 눌러도 넘어가지 않고 이 시간을 다 채워요(등장·결과 모두).
 */
const FLASH_MS = 1500;
const FINALS_FLASH_MS = 2300;

/**
 * 시즌 진행 중 클러치가 걸리면 화면 가운데 번개와 불꽃이 번쩍이고 'CLUTCH TIME'과 상황이 떠요. 끝나면 onDone을 불러요.
 * 결승 클러치는 어두운 경기장에 스포트라이트 두 줄기가 엇갈리고, 가운데 금빛 트로피(국가대표는 금메달)가 떠오르며
 * 카메라 플래시가 터지고 'FINALS CLUTCH'와 결승 이름이 떠요.
 */
export function ClutchFlash({ board, onDone }: { board?: ClutchBoard; onDone: () => void }) {
  // 다시 그려져도 타이머가 처음부터 다시 돌지 않게, 끝낼 때의 onDone만 불러요.
  const done = useEffectEvent(onDone);
  const finals = board?.finals;
  useEffect(() => {
    const timer = setTimeout(() => done(), reducedMotion() ? 500 : finals ? FINALS_FLASH_MS : FLASH_MS);
    return () => clearTimeout(timer);
  }, [finals]);
  if (finals)
    return (
      <div className="cl-flash cl-flash-finals" role="status" aria-live="assertive">
        <span className="cl-spot cl-spot-l" aria-hidden="true" />
        <span className="cl-spot cl-spot-r" aria-hidden="true" />
        {Array.from({ length: 10 }, (_, i) => (
          <i
            key={i}
            className="cl-cam"
            aria-hidden="true"
            style={{ "--x": `${(i * 41 + 7) % 100}%`, "--y": `${(i * 23 + 11) % 70}%`, "--d": `${0.25 + (i % 5) * 0.22}s` } as React.CSSProperties}
          />
        ))}
        <div className="cl-flash-core">
          {board.lg === "nat" ? <MedalIcon className="cl-trophy" /> : <TrophyIcon className="cl-trophy" />}
          <b className="cl-flash-t">FINALS CLUTCH</b>
          <span className="cl-flash-s">
            {finals}
            <br />
            {CLUTCH_SCENES[clutchScene(board)].flash} · {finalsPrize(board)[0]}까지 마지막 한 번
          </span>
        </div>
      </div>
    );
  return (
    <div className="cl-flash" role="status" aria-live="assertive">
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
        <span className="cl-flash-s">{CLUTCH_SCENES[clutchScene(board)].flash}</span>
      </div>
    </div>
  );
}

/** 플레이 장면을 먼저 보여준 뒤 결과를 공개해요. */
const RESULT_MS = 1900;
const MOVE_SCENE_MS = 1350;
const SHOT_SCENE_MS = 900;
const MOVE_RESULT_MS = 3100;
const FINALS_RESULT_MS = 3400;

const CONFETTI = ["#ffd25a", "#ff5a4a", "#4fb3e8", "#7bd389", "#ffffff"];
const GOLD_CONFETTI = ["#ffd25a", "#ffe9a3", "#f2b632", "#ffffff", "#ffd25a", "#e8a317"];

/** 클러치 결과 이펙트에 넘기는 값. 결승 클러치면 finals(결승 이름)와 국가대표 여부(gold)가 있어요. */
export interface ClutchResultInfo {
  win: boolean;
  us?: number;
  them?: number;
  opp?: string;
  ot?: boolean;
  finals?: string;
  gold?: boolean;
  /** 고른 플레이의 장면과 이름. 성공·실패와 결승 모두 장면을 먼저 그려요. */
  move?: ClutchMove;
  play?: string;
  /** 상대 유니폼 색 (장면의 상대 선수) */
  oppColor?: string;
}

/**
 * 고른 플레이의 성공·실패 장면을 먼저 보여주고 결과 이펙트와 점수를 공개해요. 끝나면 onDone을 불러요.
 * 결승 클러치 성공은 트로피(메달)가 솟아오르고 축포가 터지는 우승 세리머니로 'CHAMPIONS!'('GOLD!')를,
 * 실패는 금 간 화면 위로 빛바랜 트로피와 '준우승'('은메달')을 보여줘요.
 * 장면에는 cast(내 캐릭터와 유니폼 색, 상대 유니폼 색)로 선수를 그려요.
 */
export function ClutchResult({ result, cast, onDone }: { result: ClutchResultInfo; cast?: ClutchCast; onDone: () => void }) {
  const done = useEffectEvent(onDone);
  const [revealed, setRevealed] = useState(false);
  const { win, us, them, opp, ot, finals, gold, play } = result;
  const move = cast ? result.move : undefined;
  useEffect(() => {
    const reduced = reducedMotion();
    const shot = move === "shot" || move === "three";
    const revealTimer = setTimeout(() => setRevealed(true), move ? (reduced ? 400 : shot ? SHOT_SCENE_MS : MOVE_SCENE_MS) : 0);
    const doneTimer = setTimeout(() => done(), reduced ? 1100 : finals ? FINALS_RESULT_MS : move ? MOVE_RESULT_MS : RESULT_MS);
    return () => { clearTimeout(revealTimer); clearTimeout(doneTimer); };
  }, [finals, move]);
  const score = us !== undefined && them !== undefined ? `${us} : ${them}` : null;
  const prize = gold ? ["금메달", "은메달"] : ["우승", "준우승"];
  const title = finals ? (win ? (gold ? "GOLD!" : "CHAMPIONS!") : prize[1]) : win ? "CLUTCH!" : ot ? "아쉬운 연장" : "아쉬운 실패";
  const sub = finals
    ? ot
      ? win
        ? `동점 성공 · 연장 끝 ${prize[0]}`
        : `동점 성공 · 연장 끝 ${prize[1]}`
      : win
        ? `결승 클러치 성공 · ${prize[0]}`
        : `결승 클러치 실패 · ${prize[1]}`
    : ot
      ? win
        ? "동점 성공 · 연장 승리"
        : "동점 성공 · 연장 끝 패배"
      : win
        ? `${play ?? "마지막 플레이 성공"} · 승리`
        : "마지막 플레이 실패 · 패배";
  const palette = finals ? GOLD_CONFETTI : CONFETTI;
  return (
    <div
      className="cl-res"
      data-win={revealed && win || undefined}
      data-finals={revealed && finals ? "" : undefined}
      data-move={move}
      data-revealed={revealed || undefined}
      style={move ? ({ "--hit": `${MOVE_INFO[move].hit}s` } as React.CSSProperties) : undefined}
      role="status"
      aria-live="assertive"
    >
      {revealed && (win ? (
        <>
          <span className="cl-rays" aria-hidden="true" />
          {finals &&
            Array.from({ length: 5 }, (_, i) => (
              <span
                key={`fw${i}`}
                className="cl-fw"
                aria-hidden="true"
                style={{ "--x": `${12 + i * 19}%`, "--y": `${18 + ((i * 29) % 30)}%`, "--d": `${0.3 + i * 0.32}s` } as React.CSSProperties}
              />
            ))}
          {Array.from({ length: finals ? 40 : 18 }, (_, i) => (
            <i
              key={i}
              className="cl-conf"
              aria-hidden="true"
              style={{ "--x": `${(i * 37) % 100}%`, "--d": `${(i % 8) * 0.09}s`, "--c": palette[i % palette.length] } as React.CSSProperties}
            />
          ))}
        </>
      ) : (
        <svg className="cl-crack" viewBox="0 0 200 200" preserveAspectRatio="none" aria-hidden="true">
          <path d="M100 96 72 40 60 0M100 96 140 52 176 30M100 96 150 120 200 116M100 96 118 150 110 200M100 96 54 132 0 150M100 96 30 84 0 70M72 40 48 52M140 52 150 22M118 150 142 172M54 132 50 168" />
        </svg>
      ))}
      <div className="cl-res-core">
        {move && cast && <ClutchMoveArt move={move} cast={cast} win={win} revealed={revealed} />}
        {revealed && <>
        {finals && (gold ? <MedalIcon className="cl-res-trophy" /> : <TrophyIcon className="cl-res-trophy" />)}
        <b className="cl-res-t">{title}</b>
        <span className="cl-res-s">
          {finals && (
            <>
              {finals}
              <br />
            </>
          )}
          {sub}
          {score && (
            <>
              <br />
              <span className="cl-res-score">{score}</span>
              {opp && <span className="cl-res-opp"> vs {opp}</span>}
            </>
          )}
        </span>
        </>}
      </div>
    </div>
  );
}
