"use client";

import { useEffect, useRef, useState } from "react";
import { LEAGUES, playerLook, type Career, type Cheer } from "@/game";
import { PARTY_H, drawParty, drawPartyBg, type Paint } from "@/features/career/sceneDraw";
import { reducedMotion } from "@/shared/lib/hooks";
import { useTextOnly } from "@/shared/lib/text-only";
import styles from "./progress.module.css";

/** 움직임 줄이기에서 멈춰 보여줄 순간(초): 컵을 들어 올리고 동료들이 뛰어오른 뒤 꽃가루가 흩날려요. */
const STILL = 1.45;

/**
 * 우승 세레모니 그림: 경기장 한가운데서 내 선수가 우승컵을 들어 올리고, 같은 유니폼을 입은 동료 넷이 둘러싸 함께 뛰어올라요.
 * 경기장 배경은 한 번만 그려 두고, 그 위에 선수들과 꽃가루를 매 프레임 그려요. 움직임 줄이기 설정이면 한 장면으로 멈춰 그려요.
 * 동료 생김새와 경기장 앵글은 우승한 시즌과 등번호로 정해져서 같은 축하는 늘 같은 그림이에요. '텍스트만 보기'에서는 그리지 않아요.
 */
export function ChampionArt(props: { career: Career; cheer: Cheer; color: string }) {
  if (useTextOnly()) return null;
  return <ChampionCanvas {...props} />;
}

function ChampionCanvas({ career: c, cheer, color }: { career: Career; cheer: Cheer; color: string }) {
  const box = useRef<HTMLDivElement>(null);
  const ref = useRef<HTMLCanvasElement>(null);
  const [w, setW] = useState(0);
  const look = playerLook(c.p);
  // 고교·대학 우승이면 동료들도 앳된 얼굴(수염 없이)이에요.
  const young = !!cheer.lg && !LEAGUES[cheer.lg].pro;
  const seed = cheer.year * 31 + c.p.num;
  const key = JSON.stringify([look, color, c.p.num, c.p.name, young, seed, w]);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const cv = ref.current;
    const ctx = cv?.getContext("2d");
    if (!cv || !ctx || !w) return;
    const [l, col, num, name, yg, sd] = JSON.parse(key) as [Paint["look"], string, number, string, boolean, number];
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = w * dpr;
    cv.height = PARTY_H * dpr;
    const paint = (target: CanvasRenderingContext2D): Paint => ({ ctx: target, w, cx: w / 2, look: l, color: col, num, name, rival: { look: l, color: col }, seed: sd });

    // 움직이지 않는 경기장은 따로 한 장 그려 두어요.
    const bg = document.createElement("canvas");
    bg.width = cv.width;
    bg.height = cv.height;
    const bctx = bg.getContext("2d");
    if (bctx) {
      bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawPartyBg(paint(bctx));
    }
    const scene = paint(ctx);
    const frame = (t: number) => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.drawImage(bg, 0, 0);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawParty(scene, t, yg);
    };
    if (reducedMotion()) {
      frame(STILL);
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
    <div ref={box} className={styles.champArt} aria-hidden="true">
      <canvas ref={ref} style={{ height: PARTY_H }} />
    </div>
  );
}
