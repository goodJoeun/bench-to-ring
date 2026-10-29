"use client";

import { useEffect, useRef } from "react";
import { playerLook, type Career, type Look } from "@/game";
import type { Mood } from "@/components/common/Sprite";
import { drawPosed } from "@/components/create/coverArt";

/** 라이벌 생김새 세 가지. 커리어마다 하나로 정해져요. */
const RIVALS: { look: Look; color: string }[] = [
  { look: { kind: "black", skin: "#6B4428", hair: "#111111", style: "braids", beard: "goatee", eyes: "#2A1A10", band: "#E8505B" }, color: "#5B2A86" },
  { look: { kind: "white", skin: "#F2D3BC", hair: "#C8A060", style: "spiky", beard: "stubble", eyes: "#3B6EA5" }, color: "#1F7A4D" },
  { look: { kind: "hispanic", skin: "#C98F62", hair: "#1B1B1B", style: "mohawk", beard: "full", eyes: "#4A2E1A" }, color: "#E2571E" },
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

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
  const rival = RIVALS[hash(c.id) % RIVALS.length];
  const mine = c.team?.color ?? "#2F5DB0";
  // 내 유니폼과 같은 색이면 다른 라이벌 색을 입혀요.
  const rivalColor = rival.color.toLowerCase() === mine.toLowerCase() ? "#232A3B" : rival.color;
  return (
    <div className="rv" aria-hidden="true">
      <Figure look={playerLook(c.p)} color={mine} lh={[42, 152]} rh={[118, 152]} mood="focus" className="rv-me" />
      <span className="rv-vs">VS</span>
      <span className="rv-anger">💢</span>
      <Figure look={rival.look} color={rivalColor} lh={[4, 96]} rh={[114, 146]} mood="smirk" className="rv-rival" />
      <span className="rv-bubble">별것 아니던데?</span>
    </div>
  );
}
