"use client";

import { useEffect, useRef, useState } from "react";
import { CareerEffects, type CoverStage } from "./CareerEffects";
import { CoverPlayer } from "./CoverPlayer";
import styles from "./create.module.css";

const STAGE_MS = 3400;
const STAGES = [
  { key: "bench", title: "고교\n벤치", alt: "벤치에 앉아 고개를 숙이는 고교 선수" },
  { key: "debut", title: "프로\n데뷔", alt: "유니폼을 가다듬고 코트를 바라보는 신인" },
  { key: "champ", title: "챔피언결정전\n우승", alt: "우승하고 골대 그물을 잘라 들어 올리는 선수" },
  { key: "nba", title: "NBA\n진출", alt: "NBA 유니폼을 펼쳐 들고 사진을 찍는 선수" },
  { key: "mvp", title: "NBA MVP\n수상", alt: "양복을 입고 MVP 트로피를 들어 올리는 선수" },
] satisfies { key: CoverStage; title: string; alt: string }[];

export function CareerPath() {
  const figure = useRef<HTMLElement>(null);
  const [focus, setFocus] = useState(0);
  const [replay, setReplay] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let onScreen = false;
    const sync = () => setPlaying(onScreen && !document.hidden && !motion.matches);
    const observer = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      sync();
    });
    if (figure.current) observer.observe(figure.current);
    motion.addEventListener("change", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      observer.disconnect();
      motion.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(() => setFocus((i) => (i + 1) % STAGES.length), STAGE_MS);
    return () => window.clearTimeout(timer);
  }, [focus, replay, playing]);

  const jump = (i: number) => {
    setFocus(i);
    if (i === focus) setReplay((n) => n + 1);
  };

  return (
    <figure ref={figure} className={styles.evo} aria-label="고교 벤치에서 프로 데뷔, 챔피언결정전 우승, NBA 진출, NBA MVP 수상까지 자라는 선수">
      <div className={styles.evoStage} aria-hidden="true">
        {STAGES.map((s, i) => {
          const active = playing && focus === i;
          return (
            <div key={s.key} className={styles.evoFig} data-focus={focus === i || undefined} style={{ "--i": i } as React.CSSProperties}>
              <CoverPlayer stage={s.key} active={active} replay={active ? replay : 0} />
              {active && <CareerEffects key={`effect-${replay}`} stage={s.key} />}
            </div>
          );
        })}
      </div>
      <ol className={styles.evoCaps}>
        {STAGES.map((s, i) => (
          <li key={s.key} data-focus={focus === i || undefined} style={{ "--i": i } as React.CSSProperties}>
            <button type="button" aria-label={s.alt} aria-current={focus === i ? "step" : undefined} onClick={() => jump(i)}>
              <span className={styles.evoN}>{i + 1}</span>
              <span className={styles.evoT}>{s.title}</span>
            </button>
          </li>
        ))}
      </ol>
    </figure>
  );
}
