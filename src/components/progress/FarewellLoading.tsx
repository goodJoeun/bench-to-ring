"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { careerJourney, careerSummary, fmtNum, playerLook, type Career } from "@/game";
import { gameActions } from "@/lib/game-store";
import { NO_TEAM_COLOR } from "@/components/common/format";
import { reducedMotion, useAutoFocus, useEscapeKey } from "@/components/common/hooks";
import { Sprite } from "@/components/common/Sprite";
import { TeamBadge } from "@/components/common/TeamBadge";
import { AwardName } from "@/components/common/ui";
import { Popup } from "./Popup";

/** 지나온 발자취를 몇 줄 남길지 */
const TRAIL = 3;
/** 수상 칩을 몇 개까지 둘지. 넘치면 마지막 자리를 '외 N개'로 묶어요. */
const CHIP_LIMIT = 3;

/** 그해의 수상 칩. 많으면 앞의 몇 개만 펼치고, 나머지는 '외 N개의 우승 및 수상' 툴팁에 담아요. */
function AwardChips({ awards }: { awards: string[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const id = useId();
  useEscapeKey(() => setOpen(false), open);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);
  if (!awards.length) return null;
  const shown = awards.length > CHIP_LIMIT ? awards.slice(0, CHIP_LIMIT - 1) : awards;
  const rest = awards.slice(shown.length);
  return (
    <div className="fw-awards">
      {shown.map((a) => (
        <span key={a}>
          <AwardName name={a} />
        </span>
      ))}
      {rest.length > 0 && (
        // 마우스는 올리면, 터치는 누르면 열려요.
        <span ref={ref} className="fw-more" data-open={open || undefined}>
          <button type="button" aria-expanded={open} aria-describedby={id} onClick={() => setOpen((o) => !o)}>
            외 {rest.length}개의 우승 및 수상
          </button>
          <span id={id} role="tooltip">
            {rest.map((a) => (
              <span key={a}>
                <AwardName name={a} />
              </span>
            ))}
          </span>
        </span>
      )}
    </div>
  );
}

/** 숫자가 목표값까지 0.5초 동안 올라가요. 중간에 목표가 바뀌면 지금 값에서 이어서 올라가요. */
function useCountUp(target: number): number {
  const [value, setValue] = useState(() => (reducedMotion() ? target : 0));
  const from = useRef(value);
  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 500);
      const v = Math.round(a + (target - a) * t);
      from.current = v;
      setValue(v);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return value;
}

/**
 * 은퇴 직후 엔딩 전에 보여주는 커리어 회고. 선수 캐릭터가 커리어 길을 따라 걸어가며
 * 입단부터 우승·개인 수상, 메달, 드래프트 같은 굵직한 순간을 해마다 한 칸씩 보여줘요. 저절로 넘어가지 않고,
 * '다음'을 눌러야 다음 마일스톤으로 가요. 마지막 칸에서 '엔딩 보기'를 누르면 은퇴 화면으로 넘어가요.
 */
export function FarewellLoading({ career: c }: { career: Career }) {
  const steps = useMemo(() => careerJourney(c), [c]);
  const summary = c.summary ?? careerSummary(c);
  const n = steps.length;
  // 첫 칸은 바로 보여줘요. shown은 지금까지 본 칸 수예요.
  const [shown, setShown] = useState(Math.min(1, n));
  const done = shown >= n;
  // 열리자마자 '다음' 버튼에 초점을 둬서 Enter·스페이스로 넘길 수 있어요.
  const goRef = useAutoFocus<HTMLButtonElement>();

  const at = Math.max(0, shown - 1);
  const cur = shown ? steps[at] : null;
  const color = cur?.color ?? NO_TEAM_COLOR;
  const pos = n > 1 ? (at / (n - 1)) * 100 : 0;
  const gp = useCountUp(cur?.gp ?? 0);
  const pts = useCountUp(cur?.pts ?? 0);
  const trophies = useCountUp(cur?.trophies ?? 0);
  const trail = steps.slice(Math.max(0, at - TRAIL), at).reverse();

  const next = () => (done ? gameActions.finishFarewell() : setShown(shown + 1));
  // 닫기(X·Esc)는 남은 칸을 건너뛰고 바로 엔딩으로 가요.
  useEscapeKey(gameActions.finishFarewell);

  return (
    <Popup labelledBy="fw-title" className="fw">
      <button type="button" className="fw-x" aria-label="커리어 회고 닫기" onClick={gameActions.finishFarewell}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6.4 5 12 10.6 17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4-5.6-5.6L6.4 19 5 17.6l5.6-5.6L5 6.4z" />
        </svg>
      </button>
      <div className="fw-road" aria-hidden="true" style={{ "--tc": color } as React.CSSProperties}>
        <div className="fw-track">
          <div className="fw-line">
            <div className="fw-fill" style={{ width: `${pos}%` }} />
          </div>
          {steps.map((s, i) => (
            <span
              key={i}
              className="fw-dot"
              data-on={i < shown || undefined}
              data-big={s.big || undefined}
              style={{ left: `${n > 1 ? (i / (n - 1)) * 100 : 0}%` }}
            />
          ))}
          <div className="fw-walker" style={{ left: `${pos}%` }}>
            <Sprite look={playerLook(c.p)} color={color} scale={3} label="" />
          </div>
        </div>
      </div>

      {cur ? (
        <>
          <div className="fw-year">
            <b>{cur.year}</b>
            <span>{cur.age}세</span>
          </div>
          <span className="fw-team">
            <TeamBadge name={cur.team} color={cur.color ?? undefined} size={22} />
            {cur.team}
          </span>
          <h2 id="fw-title" key={at} className="fw-title" data-big={cur.big || undefined}>
            <AwardName name={cur.title} />
          </h2>
          <p className="sim-phase" role="status" aria-live="polite">
            {cur.detail}
          </p>
          {/* 칸이 바뀌면 열린 툴팁을 닫도록 새로 그려요. 제목도 at을 key로 쓰니 겹치지 않게 앞에 붙여요. */}
          <AwardChips key={`awards-${at}`} awards={cur.awards} />
        </>
      ) : (
        <h2 id="fw-title" className="fw-title">
          코트를 떠나며
        </h2>
      )}

      <div className="fw-tally">
        <span>
          <small>경기</small>
          <b>{fmtNum(gp)}</b>
        </span>
        <span>
          <small>득점</small>
          <b>{fmtNum(pts)}</b>
        </span>
        <span>
          <small>트로피</small>
          <b>{fmtNum(trophies)}</b>
        </span>
      </div>

      {done ? (
        <p className="tour-story">
          <b>{summary.legacy}</b> · {summary.retAge}세 은퇴 · 프로 {summary.seasons}시즌
        </p>
      ) : (
        <ol className="fw-trail" aria-label="지나온 발자취">
          {trail.map((s) => (
            <li key={`${s.year}-${s.title}`} data-big={s.big || undefined}>
              <span className="ty">{s.year}</span>
              <span className="tt">{s.title}</span>
            </li>
          ))}
        </ol>
      )}

      <div className="fw-nav">
        <button type="button" className="sim-skip" disabled={shown <= 1} onClick={() => setShown(shown - 1)}>
          이전
        </button>
        <span className="fw-count" aria-label={`${n}개 중 ${shown}번째`}>
          {shown} / {n}
        </span>
        <button type="button" ref={goRef} className="live-go" onClick={next}>
          {done ? "엔딩 보기" : "다음"}
        </button>
      </div>
      {!done && (
        <button type="button" className="sim-skip fw-skip" onClick={() => setShown(n)}>
          마지막으로 건너뛰기
        </button>
      )}
    </Popup>
  );
}
