"use client";

import { useEffect, useRef, useState } from "react";
import { playerLook, type Career, type Cheer } from "@/game";
import { SIGNING_H, drawSigning } from "@/features/career/sceneDraw";
import { reducedMotion } from "@/shared/lib/hooks";
import { NO_TEAM_COLOR } from "@/shared/lib/format";
import { TeamBadge } from "@/shared/ui/badge/TeamBadge";

/** 배경판에 늘어놓는 로고 수 (가로 × 세로) */
const WALL_COLS = 6;
const WALL_ROWS = 3;

/**
 * 입단 기자회견 그림: 새 팀 로고가 반복된 배경판 앞에서 새 유니폼을 입은 내 선수와 구단 관계자가 악수하며 사진을 찍어요.
 * 로고는 실제 로고(TeamBadge)를 캔버스 뒤에 깔고, 캔버스에는 두 사람과 카메라 플래시를 그려요. 플래시는 계속 터지고,
 * 움직임 줄이기 설정이면 한 장면으로 멈춰 그려요.
 */
export function SigningArt({ career: c, cheer }: { career: Career; cheer: Cheer }) {
  const box = useRef<HTMLDivElement>(null);
  const ref = useRef<HTMLCanvasElement>(null);
  const [w, setW] = useState(0);
  const color = cheer.color ?? NO_TEAM_COLOR;
  const look = playerLook(c.p);
  const key = JSON.stringify([look, color, c.p.num, c.p.name, w]);

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
    const [l, col, num, name] = JSON.parse(key) as [ReturnType<typeof playerLook>, string, number, string];
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = w * dpr;
    cv.height = SIGNING_H * dpr;
    const paint = (t: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, SIGNING_H);
      drawSigning({ ctx, w, cx: w / 2, look: l, color: col, num, name, rival: { look: l, color: col }, seed: 0 }, t);
    };
    if (reducedMotion()) {
      paint(0.2);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const loop = (now: number) => {
      paint((now - start) / 1000);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [key, w]);

  return (
    <div ref={box} className="sign-art" style={{ "--team": color } as React.CSSProperties} aria-hidden="true">
      <div className="sign-wall">
        {Array.from({ length: WALL_COLS * WALL_ROWS }, (_, i) => (
          <TeamBadge key={i} name={cheer.team ?? ""} kind={cheer.lg} color={color} size={26} />
        ))}
      </div>
      <canvas ref={ref} style={{ height: SIGNING_H }} />
    </div>
  );
}
