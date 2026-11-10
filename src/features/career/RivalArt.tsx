"use client";

import { useEffect, useRef } from "react";
import { playerLook, type Career, type Look } from "@/game";
import type { Mood } from "@/shared/ui/sprite/Sprite";
import { drawPosed } from "@/shared/ui/sprite/coverArt";
import { rivalOf } from "./rival";

/** 캔버스: 선수 판(160x240)을 왼쪽으로 뻗는 팔이 들어가게 넓혀 그려요. */
const BOX = { left: 60, top: 10, w: 240, h: 260 };
const DENSITY = 2;

function Figure({ look, color, lh, rh, mood, className }: { look: Look; color: string; lh: [number, number]; rh: [number, number]; mood: Mood; className: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const key = JSON.stringify([look, color, lh, rh, mood]);
  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    const [l, c, a, b, m] = JSON.parse(key) as [Look, string, [number, number], [number, number], Mood];
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, BOX.w * DENSITY, BOX.h * DENSITY);
    ctx.setTransform(DENSITY, 0, 0, DENSITY, BOX.left * DENSITY, BOX.top * DENSITY);
    drawPosed(ctx, l, c, a, b, m);
  }, [key]);
  return <canvas ref={ref} className={className} width={BOX.w * DENSITY} height={BOX.h * DENSITY} aria-hidden="true" />;
}

/**
 * 라이벌 도발 결정 위에 띄우는 삽화: 오른쪽 라이벌이 손가락으로 나를 가리키며 비웃고, 말풍선으로 도발해요.
 * 왼쪽의 나는 눈썹을 세우고 노려봐요.
 */
export function RivalArt({ career: c }: { career: Career }) {
  const mine = c.team?.color ?? "#2F5DB0";
  const { look, color: rivalColor } = rivalOf(c, mine);
  return (
    <div className="rv" aria-hidden="true">
      <Figure look={playerLook(c.p)} color={mine} lh={[42, 152]} rh={[118, 152]} mood="focus" className="rv-me" />
      <span className="rv-vs">VS</span>
      <span className="rv-anger">💢</span>
      <Figure look={look} color={rivalColor} lh={[4, 96]} rh={[114, 146]} mood="smirk" className="rv-rival" />
      <span className="rv-bubble">별것 아니던데?</span>
    </div>
  );
}
