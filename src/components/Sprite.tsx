"use client";

import { useEffect, useRef } from "react";
import { SPRITE } from "@/game";

function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v * (1 + amount))));
  const r = f(n >> 16);
  const g = f((n >> 8) & 255);
  const b = f(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

interface SpriteProps {
  skin: string;
  hair: string;
  /** 유니폼 색 (소속팀 색) */
  color: string;
  /** 도트 한 칸의 픽셀 크기 */
  scale?: number;
  label: string;
  className?: string;
}

/** 16x24 도트 선수. 유니폼은 소속팀 색을 따라가요. */
export function Sprite({ skin, hair, color, scale = 6, label, className = "sprite" }: SpriteProps) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    const palette: Record<string, string> = {
      H: hair,
      S: skin,
      E: "#151515",
      J: color,
      j: shade(color, -0.35),
      n: "#FFFFFF",
      W: shade(color, -0.22),
      K: "#F2F2F2",
      k: "#2A2A2A",
      B: "#E26A1E",
      b: "#5A2A10",
    };
    ctx.clearRect(0, 0, 16 * scale, 24 * scale);
    SPRITE.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const ch = row[x];
        if (ch === ".") continue;
        ctx.fillStyle = palette[ch];
        ctx.fillRect(x * scale, y * scale, scale, scale);
      }
    });
  }, [skin, hair, color, scale]);

  return <canvas ref={ref} className={className} width={16 * scale} height={24 * scale} role="img" aria-label={label} />;
}
