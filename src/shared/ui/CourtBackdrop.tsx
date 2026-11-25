"use client";

import { useEffect, useRef } from "react";
import { reducedMotion } from "@/shared/lib/hooks";
import { useTextOnly } from "@/shared/lib/text-only";
import { legacyCourt, legacyCourtFx, portraitCourt, type LegacyStage } from "./sprite/courtArt";

/** 은퇴 엔딩의 배경: 화려함 단계(0~7), 등번호, 우승 반지 수. 주면 레거시만큼 화려한 배경을 그려요. */
export type LegacyBackdrop = Omit<LegacyStage, "team">;

/** 움직임 줄이기에서 멈춰 보여줄 순간(초): 불꽃이 막 퍼지고 플래시가 터진 때 */
const STILL = 1.2;

export function CourtBackdrop({ color, compact = false, shadow = true, legacy }: { color: string; compact?: boolean; shadow?: boolean; legacy?: LegacyBackdrop }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const textOnly = useTextOnly();
  const level = legacy?.level;
  const num = legacy?.num ?? 0;
  const rings = legacy?.rings ?? 0;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || textOnly) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const stage: LegacyStage | null = level === undefined ? null : { team: color, level, num, rings };
    // 단계 3부터는 움직여요. 배경은 크기가 바뀔 때만 따로 그려 두고, 매 프레임 그 위에 움직이는 것만 그려요.
    const moving = !!stage && stage.level >= 3;
    const still = reducedMotion();
    const bg = moving ? document.createElement("canvas") : null;
    const start = performance.now();
    let size = { width: 0, height: 0 };

    function frame(t: number) {
      if (!canvas || !ctx || !bg || !stage) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bg, 0, 0);
      ctx.setTransform(canvas.width / size.width, 0, 0, canvas.height / size.height, 0, 0);
      legacyCourtFx(ctx, size.width, size.height, stage, t);
    }

    function paint() {
      if (!canvas || !ctx) return;
      const { width, height } = canvas.getBoundingClientRect();
      if (!width || !height) return;
      const density = Math.min(window.devicePixelRatio || 1, 3);
      canvas.width = Math.round(width * density);
      canvas.height = Math.round(height * density);
      size = { width, height };
      const target = bg?.getContext("2d") ?? ctx;
      if (bg) {
        bg.width = canvas.width;
        bg.height = canvas.height;
      }
      target.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
      if (stage) legacyCourt(target, width, height, stage);
      else portraitCourt(target, width, height, color, compact, shadow);
      if (moving) frame(still ? STILL : (performance.now() - start) / 1000);
    }

    const observer = new ResizeObserver(paint);
    observer.observe(canvas);
    if (!moving || still) return () => observer.disconnect();

    // 화면에 보일 때만 움직여요. 긴 엔딩 화면을 내려 읽는 동안에는 멈춰요.
    let raf = 0;
    let visible = false;
    const loop = (now: number) => {
      frame((now - start) / 1000);
      raf = visible ? requestAnimationFrame(loop) : 0;
    };
    const seen = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible && !raf) raf = requestAnimationFrame(loop);
    });
    seen.observe(canvas);
    return () => {
      observer.disconnect();
      seen.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [color, compact, shadow, textOnly, level, num, rings]);

  return textOnly ? null : <canvas ref={ref} className="court-backdrop" aria-hidden="true" />;
}
