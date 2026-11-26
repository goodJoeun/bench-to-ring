"use client";

import { useEffect, useRef, useState } from "react";
import type { Paint } from "./sceneDraw";
import { CELEBRATION_LABEL, CELEBRATION_STILL, CEL_H, CEL_W, celebrationKey, celebrationSeed, drawCelebration, drawCelebrationBg, type CelebrationKey } from "./celebrationDraw";
import { castOf, type ClutchCast } from "./ClutchMoveArt";
import { reducedMotion } from "@/shared/lib/hooks";
import styles from "./career.module.css";

/**
 * 시그니처 세리머니 장면: 라이벌전이나 결승에서 클러치로 이기면, 클러치 결과 이펙트가 플레이 장면 자리에 이어서 띄워요.
 * 플레이 장면과 같은 크기라 바뀌어도 제목과 점수가 움직이지 않아요. 세리머니 이름은 화면에 띄우지 않고 읽어 주기에만 담아요.
 * 경기장 배경(상대 벤치 포함)은 한 번만 그려 두고, 그 위에 세리머니를 매 프레임 그려요. 움직임을 줄인 설정이면 한 장면으로 멈춰요.
 * 상대 선수 생김새와 유니폼은 플레이 장면과 같아요(cast).
 */
export function CelebrationArt({ name, cast }: { name: string; cast: ClutchCast }) {
  const box = useRef<HTMLDivElement>(null);
  const ref = useRef<HTMLCanvasElement>(null);
  const [w, setW] = useState(0);
  const kind = celebrationKey(name);
  const key = JSON.stringify([kind, cast.look, cast.color, cast.oppColor ?? null, cast.seed ?? "", cast.num ?? 0]);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const cv = ref.current;
    if (!cv || !w) return;
    const [k, look, color, oppColor, seed, num] = JSON.parse(key) as [CelebrationKey, ClutchCast["look"], string, string | null, string, number];
    const frame = celebrationPainter(cv, w, k, { look, color, oppColor: oppColor ?? undefined, seed, num });
    if (!frame) return;
    if (reducedMotion()) {
      frame(CELEBRATION_STILL[k]);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const loop = (now: number) => {
      frame((now - start) / 1000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [key, w]);

  return (
    <div ref={box} className={styles.mv} data-celebration={kind}>
      <canvas ref={ref} className={styles.celArt} role="img" aria-label={`시그니처 세리머니 '${name}': ${CELEBRATION_LABEL[kind]}`} />
      <span className={styles.celKick} aria-hidden="true">
        SIGNATURE
      </span>
    </div>
  );
}

/**
 * 캔버스를 화면 너비(width, CSS 픽셀)에 맞추고, t초의 세리머니 장면을 그리는 함수를 돌려줘요.
 * 움직이지 않는 경기장(상대 벤치 포함)은 여기서 한 장 그려 두고, 돌려준 함수가 매번 그 위에 선수를 그려요.
 */
function celebrationPainter(cv: HTMLCanvasElement, width: number, kind: CelebrationKey, cast: ClutchCast): ((t: number) => void) | null {
  const ctx = cv.getContext("2d");
  if (!ctx) return null;
  const scale = (width / CEL_W) * Math.min(2, window.devicePixelRatio || 1);
  cv.width = Math.round(CEL_W * scale);
  cv.height = Math.round(CEL_H * scale);
  const people = castOf(cast);
  const paint = (target: CanvasRenderingContext2D): Paint => ({
    ctx: target,
    w: CEL_W,
    cx: CEL_W / 2,
    look: cast.look,
    color: cast.color,
    num: cast.num ?? 0,
    name: "",
    rival: people.opp(0),
    seed: celebrationSeed(cast.seed ?? ""),
  });

  const bg = document.createElement("canvas");
  bg.width = cv.width;
  bg.height = cv.height;
  const bctx = bg.getContext("2d");
  if (bctx) {
    bctx.setTransform(scale, 0, 0, scale, 0, 0);
    drawCelebrationBg(paint(bctx), kind, [0, 1, 2, 3].map(people.opp));
  }
  const front = paint(ctx);
  return (t) => {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.drawImage(bg, 0, 0);
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    drawCelebration(front, kind, t);
  };
}
