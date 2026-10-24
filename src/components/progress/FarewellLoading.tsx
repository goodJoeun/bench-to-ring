"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { careerJourney, careerSummary, fmtNum, type Career } from "@/game";
import { gameActions } from "@/lib/game-store";
import { NO_TEAM_COLOR } from "@/components/common/format";
import { reducedMotion, useAutoFocus } from "@/components/common/hooks";
import { Sprite } from "@/components/common/Sprite";
import { TeamBadge } from "@/components/common/TeamBadge";
import { Popup } from "./Popup";

/** 지나온 발자취를 몇 줄 남길지 */
const TRAIL = 3;

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
 * 은퇴 직후 엔딩 전에 보여주는 커리어 회고. 도트 선수가 커리어 길을 따라 걸어가며
 * 입단부터 시즌마다의 활약, 메달, 드래프트를 한 칸씩 보여줘요. 저절로 넘어가지 않고,
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

  return (
    <Popup labelledBy="fw-title" className="fw">
      <span className="sim-team">
        {c.p.name} #{c.p.num} · 커리어 회고
      </span>
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
            <Sprite skin={c.p.skin} hair={c.p.hair} color={color} scale={3} label="" />
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
            {cur.title}
          </h2>
          <p className="sim-phase" role="status" aria-live="polite">
            {cur.detail}
          </p>
          {cur.awards.length > 0 && (
            <div className="fw-awards">
              {cur.awards.slice(0, 3).map((a) => (
                <span key={a}>{a}</span>
              ))}
            </div>
          )}
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
