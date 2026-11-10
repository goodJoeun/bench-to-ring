"use client";

import { useEffect, useRef, useState } from "react";
import { playerLook, type Career, type SceneKey } from "@/game";
import { TeamBadge } from "@/shared/ui/badge/TeamBadge";
import { rivalOf } from "./rival";
import { SCENE_H, drawScene, type Paint } from "./sceneDraw";

const NO_TEAM = "#2F5DB0";

/** 결정마다 다른 수: 같은 결정은 다시 열어도 같은 그림이고, 다음 결정은 다른 조합이 나와요. */
function seedOf(c: Career, scene: SceneKey): number {
  const s = `${c.id}:${c.year}:${c.run ? `${c.run.g}:${c.run.shown}` : "off"}:${c.queue.length}:${scene}`;
  let h = 7;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/**
 * 결정 시트 위에 띄우는 장면 그림: 상황에 맞는 배경과 소품 속에 내 캐릭터가 서 있어요.
 * 캔버스 너비는 시트 너비를 따라가고(ResizeObserver), 그림은 가운데를 기준으로 그려요.
 * 국가대표 장면은 깃대 위에 내 나라 국기를 올려요. 라이벌전 장면에는 라이벌 도발 삽화와 같은 라이벌이 나와요.
 */
export function SceneArt({ career: c, scene }: { career: Career; scene: SceneKey }) {
  const box = useRef<HTMLDivElement>(null);
  const ref = useRef<HTMLCanvasElement>(null);
  const [w, setW] = useState(0);
  const look = playerLook(c.p);
  const color = c.team?.color ?? NO_TEAM;
  const rival = rivalOf(c, color);
  const key = JSON.stringify([scene, look, color, c.p.num, c.p.name, rival, seedOf(c, scene), w]);

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
    const [s, l, col, num, name, rv, seed] = JSON.parse(key) as [SceneKey, Paint["look"], string, number, string, Paint["rival"], number];
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = w * dpr;
    cv.height = SCENE_H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, SCENE_H);
    drawScene({ ctx, w, cx: w / 2, look: l, color: col, num, name, rival: rv, seed }, s);
  }, [key, w]);

  return (
    <div ref={box} className="sc-art" data-scene={scene} aria-hidden="true">
      <canvas ref={ref} />
      {scene === "national" && <TeamBadge name={c.p.nat} kind="nat" color="#C8372D" size={44} className="sc-flag" />}
    </div>
  );
}
