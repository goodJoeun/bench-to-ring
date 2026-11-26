"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CELEBRATION_NAMES, LOOK_KEYS, randomLook, type Look, type LookKey } from "@/game";
import { celebrationPainter } from "@/features/career/CelebrationArt";
import { CELEBRATION_MS, ClutchResult, type ClutchResultInfo } from "@/features/career/ClutchArt";
import type { ClutchCast } from "@/features/career/ClutchMoveArt";
import { CELEBRATION_LABEL, CELEBRATION_STILL, celebrationKey } from "@/features/career/celebrationDraw";
import { COVER_LOOK } from "@/shared/ui/sprite/coverArt";
import styles from "./dev.module.css";

/** 실제 화면에서 세리머니가 보이는 시간(초). 미리보기는 이 길이로 되풀이해요. */
const LENGTH = CELEBRATION_MS / 1000;
/** 한 프레임씩 넘길 때 움직이는 시간(초) */
const STEP = 1 / 30;
const SPEEDS = [0.1, 0.25, 0.5, 1];
/** 목록에 없는 이름(예전 저장 등)이면 그리는 기본 환호 장면 */
const FALLBACK = "기본 환호 (모르는 이름)";
const NAMES = [...CELEBRATION_NAMES, FALLBACK];

const KIND_LABEL: Record<LookKey, string> = { black: "흑인", white: "백인", hispanic: "히스패닉", asian: "동양인" };

type StageKey = "rival" | "finals" | "nat";
/** 실제 연출로 볼 때의 경기 결과. 클러치를 이겨 세리머니가 나오는 세 경우예요. */
const STAGES: { key: StageKey; label: string; result: ClutchResultInfo }[] = [
  { key: "rival", label: "라이벌전", result: { win: true, us: 79, them: 77, move: "shot", play: "종료 버저와 함께 풀업 점퍼" } },
  {
    key: "finals",
    label: "리그 결승",
    result: { win: true, us: 73, them: 72, finals: "챔피언결정전", move: "drive", play: "수비 둘을 제치는 돌파 레이업" },
  },
  {
    key: "nat",
    label: "국가대표 결승",
    result: { win: true, us: 86, them: 84, ot: true, finals: "아시안게임 결승", gold: true, move: "pass", play: "더블팀 사이로 찌른 결승 어시스트" },
  },
];

/**
 * 시그니처 세리머니 모션 확인 화면(개발용). 세리머니마다 장면을 되풀이해 보여주고,
 * 속도를 늦추거나 멈춰서 시간 막대로 넘겨 보거나 한 프레임씩 볼 수 있어요.
 * 캐릭터·유니폼 색·등번호·상대 팀(경기장 각도와 상대 벤치)을 바꿔 볼 수 있고,
 * '실제 연출'은 게임과 같은 클러치 결과 이펙트에 이어 세리머니를 띄워요.
 */
export function CelebrationLab() {
  const [look, setLook] = useState<Look>(COVER_LOOK);
  const [color, setColor] = useState("#1D428A");
  const [oppColor, setOppColor] = useState("#C8102E");
  const [num, setNum] = useState(7);
  const [opp, setOpp] = useState("건국대");
  const [speed, setSpeed] = useState(1);
  const [round, setRound] = useState(0);
  const [stage, setStage] = useState<{ name: string; key: StageKey; id: number } | null>(null);
  const cast: ClutchCast = { look, color, oppColor, seed: opp, num };
  const shown = stage && STAGES.find((s) => s.key === stage.key);

  return (
    <main className={styles.lab}>
      <header className={styles.head}>
        <h1>세리머니 모션 확인</h1>
        <p>
          개발 서버에서만 열리는 화면이에요. 장면은 실제로 보이는 {LENGTH}초 길이로 되풀이해요. 멈추고 시간 막대를 끌거나 ◀ ▶로 한
          프레임씩 넘겨 볼 수 있어요.
        </p>
      </header>

      <section className={styles.controls} aria-label="장면 설정">
        <div className={styles.row} role="group" aria-label="속도">
          <span className={styles.k}>속도</span>
          {SPEEDS.map((s) => (
            <button key={s} type="button" className={styles.btn} aria-pressed={speed === s} onClick={() => setSpeed(s)}>
              {s}×
            </button>
          ))}
        </div>
        <label className={styles.field}>
          <span className={styles.k}>바탕</span>
          <select value={look.kind} onChange={(e) => setLook(randomLook(e.target.value as LookKey))}>
            {LOOK_KEYS.map((k) => (
              <option key={k} value={k}>
                {KIND_LABEL[k]}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className={styles.btn} onClick={() => setLook(randomLook(look.kind))}>
          다른 얼굴
        </button>
        <label className={styles.field}>
          <span className={styles.k}>우리 팀</span>
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
        </label>
        <label className={styles.field}>
          <span className={styles.k}>상대 팀</span>
          <input type="color" value={oppColor} onChange={(e) => setOppColor(e.target.value)} />
        </label>
        <label className={styles.field}>
          <span className={styles.k}>등번호</span>
          <input
            className={styles.num}
            type="number"
            min={0}
            max={99}
            value={num}
            onChange={(e) => setNum(Math.max(0, Math.min(99, Math.round(Number(e.target.value) || 0))))}
          />
        </label>
        <label className={styles.field} title="상대 팀 이름에 따라 경기장 각도와 상대 벤치 선수 얼굴이 바뀌어요">
          <span className={styles.k}>상대 팀 이름</span>
          <input className={styles.text} value={opp} onChange={(e) => setOpp(e.target.value)} />
        </label>
        <button type="button" className={styles.btn} onClick={() => setRound((r) => r + 1)}>
          모두 처음부터
        </button>
      </section>

      <ul className={styles.grid}>
        {NAMES.map((name) => (
          <li key={`${name}-${round}`}>
            <Player name={name} cast={cast} speed={speed} onStage={(key) => setStage({ name, key, id: Date.now() })} />
          </li>
        ))}
      </ul>

      {stage && shown && (
        <ClutchResult
          key={stage.id}
          result={{ ...shown.result, opp, oppColor, celebration: stage.name }}
          cast={cast}
          onDone={() => setStage(null)}
        />
      )}
    </main>
  );
}

/** 세리머니 하나를 되풀이해 그리는 칸. 재생·멈춤, 시간 막대, 한 프레임씩 넘기기, 움직임 줄이기 장면, 실제 연출 버튼이 있어요. */
function Player({ name, cast, speed, onStage }: { name: string; cast: ClutchCast; speed: number; onStage: (key: StageKey) => void }) {
  const kind = celebrationKey(name);
  const box = useRef<HTMLDivElement>(null);
  const cv = useRef<HTMLCanvasElement>(null);
  const bar = useRef<HTMLInputElement>(null);
  const clock = useRef<HTMLOutputElement>(null);
  const draw = useRef<((t: number) => void) | null>(null);
  const time = useRef(0);
  const [w, setW] = useState(0);
  const [playing, setPlaying] = useState(true);
  const castKey = JSON.stringify(cast);

  /** t초 장면을 그리고 시간 막대와 시각을 맞춰요. */
  const show = useCallback((t: number) => {
    time.current = t;
    draw.current?.(t);
    if (bar.current) bar.current.value = String(t);
    if (clock.current) clock.current.textContent = `${t.toFixed(2)}초`;
  }, []);
  /** 멈추고 t초로 옮겨요. */
  const seek = (t: number) => {
    setPlaying(false);
    show(Math.max(0, Math.min(LENGTH, t)));
  };

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!cv.current || !w) return;
    draw.current = celebrationPainter(cv.current, w, kind, JSON.parse(castKey) as ClutchCast);
    show(time.current);
  }, [w, kind, castKey, show]);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const t = time.current + ((now - last) / 1000) * speed;
      last = now;
      show(t >= LENGTH ? 0 : t);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, show]);

  return (
    <article className={styles.card} data-celebration={kind}>
      <h2>{name}</h2>
      <p>{CELEBRATION_LABEL[kind]}</p>
      <div ref={box}>
        <canvas ref={cv} className={styles.art} role="img" aria-label={`${name}: ${CELEBRATION_LABEL[kind]}`} />
      </div>
      <input
        ref={bar}
        className={styles.bar}
        type="range"
        min={0}
        max={LENGTH}
        step={0.01}
        defaultValue={0}
        aria-label="장면 시각"
        onChange={(e) => seek(Number(e.target.value))}
      />
      <div className={styles.row}>
        <button type="button" className={styles.btn} onClick={() => setPlaying((p) => !p)} aria-label={playing ? "멈춤" : "재생"}>
          {playing ? "❚❚" : "▶"}
        </button>
        <button type="button" className={styles.btn} onClick={() => show(0)} aria-label="처음부터">
          ⏮
        </button>
        <button type="button" className={styles.btn} onClick={() => seek(time.current - STEP)} aria-label="한 프레임 뒤로">
          ◀
        </button>
        <button type="button" className={styles.btn} onClick={() => seek(time.current + STEP)} aria-label="한 프레임 앞으로">
          ▶
        </button>
        <button
          type="button"
          className={styles.btn}
          onClick={() => seek(CELEBRATION_STILL[kind])}
          title="움직임 줄이기 설정에서 멈춰 보여주는 장면"
        >
          정지 장면
        </button>
        <output ref={clock} className={styles.time}>
          0.00초
        </output>
      </div>
      <div className={styles.row}>
        <span className={styles.k}>실제 연출</span>
        {STAGES.map((s) => (
          <button key={s.key} type="button" className={styles.btn} onClick={() => onStage(s.key)}>
            {s.label}
          </button>
        ))}
      </div>
    </article>
  );
}
