"use client";

import { useEffect, useRef, useState } from "react";
import { reducedMotion } from "@/components/common/hooks";
import { drawStage, STAGE_SEC, VIEW, type StageKey } from "./coverArt";

/*
 * 표지 그림: 진화 그림처럼 선수가 왼쪽에서 오른쪽으로 자라요.
 * 고교 벤치 → 프로 데뷔 → 챔피언결정전 우승 → NBA 진출 → NBA MVP 수상.
 * 1번부터 5번까지 차례로 초점이 오고, 초점이 온 단계는 짧은 움짤처럼 움직여요. 단계 이름을 누르면 그 단계로 넘어가요.
 */

const STAGES: { key: StageKey; title: string; alt: string }[] = [
  { key: "bench", title: "고교\n벤치", alt: "벤치에 앉아 고개를 숙이는 고교 선수" },
  { key: "debut", title: "프로\n데뷔", alt: "유니폼을 가다듬고 교체로 들어가는 신인" },
  { key: "champ", title: "챔피언결정전\n우승", alt: "우승하고 골대 그물을 자르는 선수" },
  { key: "nba", title: "NBA\n진출", alt: "NBA 유니폼을 펼쳐 들고 사진을 찍는 선수" },
  { key: "mvp", title: "NBA MVP\n수상", alt: "양복을 입고 MVP 트로피를 들어 올리는 선수" },
];

/** 캔버스 해상도: 그림 한 단위를 이만큼의 픽셀로 그려요. */
const DENSITY = 2.4;
/** 움짤 느낌이 나게 초당 이만큼만 새로 그려요. */
const FPS = 24;

function paint(canvas: HTMLCanvasElement | null, stage: StageKey, t: number): void {
  const ctx = canvas?.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas!.width, canvas!.height);
  ctx.setTransform(DENSITY, 0, 0, DENSITY, VIEW.left * DENSITY, VIEW.top * DENSITY);
  drawStage(ctx, stage, t);
}

export function CareerPath() {
  const canvases = useRef<(HTMLCanvasElement | null)[]>([]);
  const [focus, setFocus] = useState(0);
  /** 1번 단계가 시작된 시각. 단계 이름을 누르면 그 단계가 지금 시작되도록 옮겨요. */
  const start = useRef(0);

  useEffect(() => {
    // 움직임을 줄인 설정에서는 모든 단계를 마지막 장면으로 멈춰 그려요.
    if (reducedMotion()) {
      STAGES.forEach((s, i) => paint(canvases.current[i], s.key, STAGE_SEC));
      return;
    }
    STAGES.forEach((s, i) => paint(canvases.current[i], s.key, 0));
    start.current = performance.now();
    let shown = -1;
    let frame = -1;
    let raf = 0;
    const tick = (now: number) => {
      const sec = (now - start.current) / 1000;
      const i = Math.floor(sec / STAGE_SEC) % STAGES.length;
      const t = sec % STAGE_SEC;
      if (i !== shown) {
        // 초점이 떠난 단계는 첫 장면으로 돌려놔요.
        if (shown >= 0) paint(canvases.current[shown], STAGES[shown].key, 0);
        shown = i;
        frame = -1;
        setFocus(i);
      }
      const f = Math.floor(t * FPS);
      if (f !== frame) {
        frame = f;
        paint(canvases.current[i], STAGES[i].key, f / FPS);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  /** 이벤트 시각(timeStamp)은 performance.now()와 같은 시계예요. */
  const jump = (i: number, now: number) => {
    start.current = now - i * STAGE_SEC * 1000;
  };

  return (
    <figure className="evo" aria-label="고교 벤치에서 프로 데뷔, 챔피언결정전 우승, NBA 진출, NBA MVP 수상까지 자라는 선수">
      <div className="evo-stage" aria-hidden="true">
        {STAGES.map((s, i) => (
          <div key={s.key} className="evo-fig" data-focus={focus === i || undefined} style={{ "--i": i } as React.CSSProperties}>
            <canvas
              ref={(el) => {
                canvases.current[i] = el;
              }}
              className="evo-art"
              width={VIEW.w * DENSITY}
              height={VIEW.h * DENSITY}
            />
          </div>
        ))}
      </div>
      <ol className="evo-caps">
        {STAGES.map((s, i) => (
          <li key={s.key} data-focus={focus === i || undefined} style={{ "--i": i } as React.CSSProperties}>
            <button type="button" aria-label={s.alt} aria-current={focus === i ? "step" : undefined} onClick={(e) => jump(i, e.timeStamp)}>
              <span className="evo-n">{i + 1}</span>
              <span className="evo-t">{s.title}</span>
            </button>
          </li>
        ))}
      </ol>
    </figure>
  );
}
