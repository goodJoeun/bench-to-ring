"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { CLUTCH_SCENES, boardScore, clutchScene, finalsPrize, type ClutchBoard, type ClutchMove } from "@/game";
import { reducedMotion } from "@/shared/lib/hooks";
import { useTextOnly } from "@/shared/lib/text-only";
import { TeamBadge } from "@/shared/ui/badge/TeamBadge";
import { CelebrationArt } from "./CelebrationArt";
import { ClutchMoveArt, MOVE_INFO, type ClutchCast } from "./ClutchMoveArt";
import styles from "./career.module.css";

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
  const textOnly = useTextOnly();
  const summary =
    (finals ? `${finals}, ${finalsPrize(board)[0]} 결정전. ` : "") +
    (board ? `4쿼터 ${secs}초 남기고 ${board.team} ${us} 대 ${board.opp} ${them} ${scene.state}` : `4쿼터 ${secs}초 남기고 ${scene.state}`);
  // '텍스트만 보기'에서는 전광판 대신 같은 내용을 한 줄 글로 보여줘요.
  if (textOnly) return <p className="hint">{summary}</p>;
  return (
    <div className={styles.clArt} data-finals={finals ? "" : undefined} aria-label={summary} role="img">
      {finals && (
        <div className={styles.clBanner}>
          {gold ? <MedalIcon className="cl-banner-icon" /> : <TrophyIcon className="cl-banner-icon" />}
          <span className={styles.clBannerT}>{finals}</span>
          <span className={styles.clBannerS}>{gold ? "금메달 결정전" : "우승 결정전"}</span>
        </div>
      )}
      <div className={styles.clBoard}>
        {board && <Side name={board.team} color={board.teamColor} lg={board.lg} score={us} tag="우리 팀" />}
        <div className={styles.clMid}>
          <span className={styles.clQ}>4Q</span>
          <b className={styles.clClock}>{scene.clock}</b>
          <span className={styles.clTie}>{scene.state}</span>
        </div>
        {board && <Side name={board.opp} color={board.oppColor} lg={board.lg} score={them} tag="상대" />}
      </div>
    </div>
  );
}

function Side({ name, color, lg, score, tag }: { name: string; color: string; lg: ClutchBoard["lg"]; score: number; tag: string }) {
  return (
    <div className={styles.clSide}>
      <TeamBadge name={name} kind={lg} color={color} size={30} />
      <span className={styles.clName}>{name}</span>
      <b className={styles.clScore}>{score}</b>
      <span className={styles.clTag}>{tag}</span>
    </div>
  );
}

/** 우승 트로피 */
function TrophyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 72" aria-hidden="true">
      <path className={styles.trCup} d="M14 4h36v18c0 12-8 22-18 22S14 34 14 22z" />
      <path className={styles.trEar} d="M14 9H5c0 10 4 17 11 19M50 9h9c0 10-4 17-11 19" />
      <path className={styles.trCup} d="M27 43h10l2 12H25z" />
      <rect className={styles.trBase} x="17" y="55" width="30" height="7" rx="2" />
      <rect className={styles.trBase} x="13" y="62" width="38" height="7" rx="2" />
      <path className={styles.trShine} d="M22 9v13c0 6 3 11 7 14" />
    </svg>
  );
}

/** 금메달 */
function MedalIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 72" aria-hidden="true">
      <path className={styles.mdRibbon} d="M16 2h12l8 22h-12zM48 2H36l-8 22h12z" />
      <circle className={styles.trCup} cx="32" cy="46" r="22" />
      <circle className={styles.mdRing} cx="32" cy="46" r="15" />
      <path className={styles.mdStar} d="m32 36 3 6.5 7 .8-5.2 4.8 1.4 7L32 51.6l-6.2 3.5 1.4-7-5.2-4.8 7-.8z" />
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
  // '텍스트만 보기'에서는 이펙트 없이 바로 결정 시트로 넘어가요.
  const skip = useTextOnly();
  useEffect(() => {
    const timer = setTimeout(() => done(), skip ? 0 : reducedMotion() ? 500 : finals ? FINALS_FLASH_MS : FLASH_MS);
    return () => clearTimeout(timer);
  }, [finals, skip]);
  if (skip) return null;
  if (finals)
    return (
      <div className={`${styles.clFlash} ${styles.clFlashFinals}`} role="status" aria-live="assertive">
        <span className={`${styles.clSpot} ${styles.clSpotL}`} aria-hidden="true" />
        <span className={`${styles.clSpot} ${styles.clSpotR}`} aria-hidden="true" />
        {Array.from({ length: 10 }, (_, i) => (
          <i
            key={i}
            className={styles.clCam}
            aria-hidden="true"
            style={{ "--x": `${(i * 41 + 7) % 100}%`, "--y": `${(i * 23 + 11) % 70}%`, "--d": `${0.25 + (i % 5) * 0.22}s` } as React.CSSProperties}
          />
        ))}
        <div className={styles.clFlashCore}>
          {board.lg === "nat" ? <MedalIcon className={styles.clTrophy} /> : <TrophyIcon className={styles.clTrophy} />}
          <b className={styles.clFlashT}>FINALS CLUTCH</b>
          <span className={styles.clFlashS}>
            {finals}
            <br />
            {CLUTCH_SCENES[clutchScene(board)].flash} · {finalsPrize(board)[0]}까지 마지막 한 번
          </span>
        </div>
      </div>
    );
  return (
    <div className={styles.clFlash} role="status" aria-live="assertive">
      <div className={styles.clFlashCore}>
        <svg className={`${styles.clBolt} ${styles.clBoltL}`} viewBox="0 0 40 80" aria-hidden="true">
          <path d="M24 0 4 44h14L10 80 36 30H21z" />
        </svg>
        <svg className={styles.clFire} viewBox="0 0 100 120" aria-hidden="true">
          <path className={styles.clFireO} d="M50 2c6 22 30 30 30 62a30 30 0 0 1-60 0c0-14 6-22 12-30 2 10 6 14 10 16 0-20 2-34 8-48z" />
          <path className={styles.clFireI} d="M50 46c4 12 16 18 16 34a16 16 0 0 1-32 0c0-8 4-12 8-16 1 6 3 8 6 9 0-11 0-18 2-27z" />
        </svg>
        <svg className={`${styles.clBolt} ${styles.clBoltR}`} viewBox="0 0 40 80" aria-hidden="true">
          <path d="M24 0 4 44h14L10 80 36 30H21z" />
        </svg>
        <b className={styles.clFlashT}>CLUTCH TIME</b>
        <span className={styles.clFlashS}>{CLUTCH_SCENES[clutchScene(board)].flash}</span>
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
/** 시그니처 세리머니: 결과(CLUTCH!·CHAMPIONS!)를 이만큼 보여준 뒤 세리머니 장면으로 바꾸고, 그 장면을 이만큼 보여줘요. */
const CELEBRATE_AFTER_MS = 1300;
const FINALS_CELEBRATE_AFTER_MS = 1700;
const CELEBRATION_MS = 3400;

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
  /** 라이벌전이나 결승에서 이겼을 때의 시그니처 세리머니 이름. 있으면 결과를 보여준 뒤 세리머니 장면으로 넘어가요. */
  celebration?: string;
}

/**
 * 고른 플레이의 성공·실패 장면을 먼저 보여주고 결과 이펙트와 점수를 공개해요. 끝나면 onDone을 불러요.
 * 결승 클러치 성공은 트로피(메달)가 솟아오르고 축포가 터지는 우승 세리머니로 'CHAMPIONS!'('GOLD!')를,
 * 실패는 금 간 화면 위로 빛바랜 트로피와 '준우승'('은메달')을 보여줘요.
 * 장면에는 cast(내 캐릭터와 유니폼 색, 상대 유니폼 색)로 선수를 그려요.
 * 라이벌전이나 결승에서 이겨 시그니처 세리머니(celebration)가 있으면, 결과를 잠깐 보여준 뒤 플레이 장면 자리에서 세리머니를 하고 끝나요.
 */
export function ClutchResult({ result, cast, onDone }: { result: ClutchResultInfo; cast?: ClutchCast; onDone: () => void }) {
  const done = useEffectEvent(onDone);
  const [revealed, setRevealed] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const { win, us, them, opp, ot, finals, gold, play } = result;
  const move = cast ? result.move : undefined;
  const celebration = win && cast ? result.celebration : undefined;
  // '텍스트만 보기'에서는 장면과 이펙트 없이 바로 넘어가요. 결과는 이어지는 결과 카드·대회 결과가 글로 알려줘요.
  const skip = useTextOnly();
  const reduced = reducedMotion();
  const shot = move === "shot" || move === "three";
  const revealAt = move ? (reduced ? 400 : shot ? SHOT_SCENE_MS : MOVE_SCENE_MS) : 0;
  const celebrateAt = celebration ? revealAt + (reduced ? 700 : finals ? FINALS_CELEBRATE_AFTER_MS : CELEBRATE_AFTER_MS) : null;
  const doneAt =
    celebrateAt !== null ? celebrateAt + (reduced ? 1600 : CELEBRATION_MS) : reduced ? 1100 : finals ? FINALS_RESULT_MS : move ? MOVE_RESULT_MS : RESULT_MS;
  useEffect(() => {
    if (skip) {
      const timer = setTimeout(() => done(), 0);
      return () => clearTimeout(timer);
    }
    const timers = [setTimeout(() => setRevealed(true), revealAt), setTimeout(() => done(), doneAt)];
    if (celebrateAt !== null) timers.push(setTimeout(() => setCelebrating(true), celebrateAt));
    return () => timers.forEach(clearTimeout);
  }, [revealAt, celebrateAt, doneAt, skip]);
  if (skip) return null;
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
      className={styles.clRes}
      data-win={revealed && win || undefined}
      data-finals={revealed && finals ? "" : undefined}
      data-move={move}
      data-revealed={revealed || undefined}
      style={{
        ...(move && ({ "--hit": `${MOVE_INFO[move].hit}s` } as React.CSSProperties)),
        // 세리머니까지 보여주면 화면이 그만큼 늦게 사라져요.
        ...(celebrateAt !== null && { animationDuration: `${doneAt}ms` }),
      }}
      role="status"
      aria-live="assertive"
    >
      {revealed && (win ? (
        <>
          <span className={styles.clRays} aria-hidden="true" />
          {finals &&
            Array.from({ length: 5 }, (_, i) => (
              <span
                key={`fw${i}`}
                className={styles.clFw}
                aria-hidden="true"
                style={{ "--x": `${12 + i * 19}%`, "--y": `${18 + ((i * 29) % 30)}%`, "--d": `${0.3 + i * 0.32}s` } as React.CSSProperties}
              />
            ))}
          {Array.from({ length: finals ? 40 : 18 }, (_, i) => (
            <i
              key={i}
              className={styles.clConf}
              aria-hidden="true"
              style={{ "--x": `${(i * 37) % 100}%`, "--d": `${(i % 8) * 0.09}s`, "--c": palette[i % palette.length] } as React.CSSProperties}
            />
          ))}
        </>
      ) : (
        <svg className={styles.clCrack} viewBox="0 0 200 200" preserveAspectRatio="none" aria-hidden="true">
          <path d="M100 96 72 40 60 0M100 96 140 52 176 30M100 96 150 120 200 116M100 96 118 150 110 200M100 96 54 132 0 150M100 96 30 84 0 70M72 40 48 52M140 52 150 22M118 150 142 172M54 132 50 168" />
        </svg>
      ))}
      <div className={styles.clResCore}>
        {celebrating && celebration && cast ? (
          <CelebrationArt name={celebration} cast={cast} />
        ) : (
          move && cast && <ClutchMoveArt move={move} cast={cast} win={win} revealed={revealed} />
        )}
        {revealed && <>
        {finals && (gold ? <MedalIcon className={styles.clResTrophy} /> : <TrophyIcon className={styles.clResTrophy} />)}
        <b className={styles.clResT}>{title}</b>
        <span className={styles.clResS}>
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
              <span className={styles.clResScore}>{score}</span>
              {opp && <span className={styles.clResOpp}> vs {opp}</span>}
            </>
          )}
        </span>
        </>}
      </div>
    </div>
  );
}
