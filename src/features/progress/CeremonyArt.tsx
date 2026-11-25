"use client";

import { useEffect, useRef, useState } from "react";
import { LEAGUES, playerLook, type Career, type Cheer } from "@/game";
import { AWARD_H, PARTY_H, drawAward, drawAwardBg, drawParty, drawPartyBg, type Paint } from "@/features/career/sceneDraw";
import { reducedMotion } from "@/shared/lib/hooks";
import { useTextOnly } from "@/shared/lib/text-only";
import styles from "./progress.module.css";

/**
 * 축하마다 그리는 장면: 높이, 움직임 줄이기에서 멈춰 보여줄 순간(초), 한 번만 그리는 배경, 매 프레임 그리는 장면.
 * - title: 동료들과 우승컵을 들어 올리는 세레모니. 컵을 든 뒤 동료들이 뛰어오르고 꽃가루가 흩날리는 순간에 멈춰요.
 * - mvp, fmvp: 시상자에게 트로피를 받아 들어 올리는 장면. 들어 올린 트로피에서 반짝이가 퍼지는 순간에 멈춰요.
 */
const SCENES = {
  title: { h: PARTY_H, still: 1.45, bg: drawPartyBg, draw: drawParty },
  mvp: { h: AWARD_H, still: 1.75, bg: (p: Paint) => drawAwardBg(p, "mvp"), draw: (p: Paint, t: number, young: boolean) => drawAward(p, "mvp", t, young) },
  fmvp: { h: AWARD_H, still: 1.75, bg: (p: Paint) => drawAwardBg(p, "fmvp"), draw: (p: Paint, t: number, young: boolean) => drawAward(p, "fmvp", t, young) },
} satisfies Partial<Record<Cheer["kind"], { h: number; still: number; bg: (p: Paint) => void; draw: (p: Paint, t: number, young: boolean) => void }>>;

type Kind = keyof typeof SCENES;

/** 장면 그림이 있는 축하인지: 우승, 시즌 MVP, 파이널 MVP */
export const hasCeremony = (x: Cheer): x is Cheer & { kind: Kind } => x.kind in SCENES;

/**
 * 축하 팝업의 장면 그림. 경기장·무대 배경은 한 번만 그려 두고, 그 위에 사람들과 꽃가루·반짝이를 매 프레임 그려요.
 * 움직임 줄이기 설정이면 한 장면으로 멈춰 그려요. '텍스트만 보기'에서는 그리지 않아요.
 * 동료 생김새와 경기장 앵글은 시즌과 등번호로 정해서, 같은 시즌의 우승 세레모니와 파이널 MVP 시상은 같은 경기장·같은 동료예요.
 * 고교·대학 시즌이면 동료들도 앳된 얼굴(수염 없이)이에요.
 */
export function CeremonyArt(props: { career: Career; cheer: Cheer & { kind: Kind }; color: string }) {
  if (useTextOnly()) return null;
  return <CeremonyCanvas {...props} />;
}

function CeremonyCanvas({ career: c, cheer, color }: { career: Career; cheer: Cheer & { kind: Kind }; color: string }) {
  const box = useRef<HTMLDivElement>(null);
  const ref = useRef<HTMLCanvasElement>(null);
  const [w, setW] = useState(0);
  const scene = SCENES[cheer.kind];
  const look = playerLook(c.p);
  // 예전 저장의 축하처럼 리그를 모르면 그 시즌 기록에서 찾아요.
  const lg = cheer.lg ?? c.hist.find((h) => h.year === cheer.year)?.lg;
  const young = !!lg && !LEAGUES[lg].pro;
  const seed = cheer.year * 31 + c.p.num;
  const key = JSON.stringify([cheer.kind, look, color, c.p.num, c.p.name, young, seed, w]);

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
    const [kind, l, col, num, name, yg, sd] = JSON.parse(key) as [Kind, Paint["look"], string, number, string, boolean, number];
    const { h, still, bg: drawBg, draw } = SCENES[kind];
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = w * dpr;
    cv.height = h * dpr;
    const paint = (target: CanvasRenderingContext2D): Paint => ({ ctx: target, w, cx: w / 2, look: l, color: col, num, name, rival: { look: l, color: col }, seed: sd });

    // 움직이지 않는 배경은 따로 한 장 그려 두어요.
    const bg = document.createElement("canvas");
    bg.width = cv.width;
    bg.height = cv.height;
    const bctx = bg.getContext("2d");
    if (bctx) {
      bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawBg(paint(bctx));
    }
    const front = paint(ctx);
    const frame = (t: number) => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.drawImage(bg, 0, 0);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw(front, t, yg);
    };
    if (reducedMotion()) {
      frame(still);
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
    <div ref={box} className={styles.ceremonyArt} aria-hidden="true">
      <canvas ref={ref} style={{ height: scene.h }} />
    </div>
  );
}
