"use client";

import { useEffect, useRef } from "react";
import type { Look, LookKey } from "@/game";

/*
 * 선수 캐릭터. 예전 16x24 도트 크기(scale 한 칸)를 그대로 쓰되, 안은 160x240 단위 판에 매끈한 도형으로 그려요.
 * 남성 캐릭터예요. 바탕(흑인·백인·히스패닉·동양인)마다 눈·코·입 생김새가 다르고, 피부색·머리 모양·머리색·눈동자·수염·헤어밴드를 조합해요.
 */

/** 도트 한 칸 = 10단위 */
const U = 10;

type Ctx = CanvasRenderingContext2D;

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [n >> 16, (n >> 8) & 255, n & 255];
}

function shade(hex: string, amount: number): string {
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(amount < 0 ? v * (1 + amount) : v + (255 - v) * amount)));
  const [r, g, b] = rgb(hex).map(f);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

/** 밝은 머리색(금발, 탈색, 회색)인지 */
function isLight(hex: string): boolean {
  const [r, g, b] = rgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.45;
}

function ellipse(ctx: Ctx, x: number, y: number, rx: number, ry: number, fill: string, rot = 0): void {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
  ctx.fill();
}

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number, fill: string): void {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fill();
}

function stroke(ctx: Ctx, color: string, width: number, path: (ctx: Ctx) => void): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  path(ctx);
  ctx.stroke();
}

function fill(ctx: Ctx, color: string, path: (ctx: Ctx) => void, alpha = 1): void {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  path(ctx);
  ctx.fill();
  ctx.globalAlpha = 1;
}

/* 머리. 얼굴은 (80, 52)에 가로 반지름 27, 세로 반지름 31인 타원이에요. */

/** 이마선이 있는 짧은 머리 (두피를 따라가요) */
const cap = (c: Ctx) => {
  c.moveTo(54, 46);
  c.lineTo(55, 36);
  c.bezierCurveTo(57, 15, 103, 15, 105, 36);
  c.lineTo(106, 46);
  c.lineTo(102, 38);
  c.quadraticCurveTo(80, 30, 58, 38);
  c.closePath();
};

/** 정수리 높이: 얼굴 타원 위쪽 가장자리의 y */
const topAt = (x: number) => 52 - 31 * Math.sqrt(Math.max(0, 1 - ((x - 80) / 27) ** 2));

/** 앞머리를 가운데서 가른 머리 */
const curtain = (c: Ctx) => {
  const side = 56;
  c.moveTo(51, side);
  c.bezierCurveTo(46, 20, 62, 11, 80, 11);
  c.bezierCurveTo(98, 11, 114, 20, 109, side);
  c.lineTo(105, side);
  c.lineTo(104, 46);
  c.quadraticCurveTo(93, 30, 80, 25);
  c.quadraticCurveTo(67, 30, 56, 46);
  c.lineTo(55, side);
  c.closePath();
};

/** 얼굴 뒤로 가는 머리 (아프로, 땋은 머리) */
function drawHairBack(ctx: Ctx, look: Look): void {
  const { hair } = look;
  switch (look.style) {
    case "afro":
      ellipse(ctx, 80, 32, 38, 30, hair);
      for (let a = Math.PI * 0.85; a <= Math.PI * 2.15; a += Math.PI / 9)
        ellipse(ctx, 80 + Math.cos(a) * 36, 32 + Math.sin(a) * 28, 7, 7, hair);
      return;
    case "braids":
      ctx.lineCap = "round";
      for (const [x, dx] of [[55, -5], [61, -4], [99, 4], [105, 5]]) {
        stroke(ctx, hair, 5, (c) => {
          c.moveTo(x, 40);
          c.lineTo(x + dx, 92);
        });
        ellipse(ctx, x + dx, 92, 2.6, 2.6, shade(hair, 0.5));
      }
      return;
  }
}

/** 얼굴 위에 덮는 머리 */
function drawHairFront(ctx: Ctx, look: Look): void {
  const { hair } = look;
  const hi = shade(hair, isLight(hair) ? 0.35 : 0.22);
  const dark = shade(hair, -0.3);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  switch (look.style) {
    case "buzz":
      fill(ctx, hair, cap, 0.82);
      return;
    case "fade":
      fill(ctx, hair, cap);
      fill(
        ctx,
        hair,
        (c) => {
          c.moveTo(53, 46);
          c.lineTo(58, 38);
          c.lineTo(57, 54);
          c.closePath();
          c.moveTo(107, 46);
          c.lineTo(102, 38);
          c.lineTo(103, 54);
          c.closePath();
        },
        0.45,
      );
      for (const [x, y] of [[66, 26], [76, 22], [87, 22], [96, 27], [71, 31], [82, 28], [92, 32], [61, 33]]) ellipse(ctx, x, y, 1.6, 1.6, hi);
      return;
    case "afro":
    case "braids":
      fill(ctx, hair, cap);
      if (look.style === "braids")
        stroke(ctx, hi, 1.4, (c) => {
          for (const x of [64, 72, 80, 88, 96]) {
            c.moveTo(x, topAt(x) + 14);
            c.lineTo(80 + (x - 80) * 0.6, 20);
          }
        });
      return;
    case "twists":
      fill(ctx, hair, cap);
      for (let x = 58; x <= 102; x += 6.3)
        stroke(ctx, hair, 6, (c) => {
          c.moveTo(x, topAt(x) + 6);
          c.lineTo(x + (x - 80) * 0.12, topAt(x) - 7);
        });
      return;
    case "mohawk":
      fill(ctx, hair, cap, 0.3);
      roundRect(ctx, 72, 5, 16, 34, 8, hair);
      stroke(ctx, hi, 2, (c) => {
        c.moveTo(80, 9);
        c.lineTo(80, 30);
      });
      return;
    case "bald":
      ellipse(ctx, 70, 30, 7, 3.5, "rgba(255,255,255,.28)", -0.5);
      return;
    case "swept":
      fill(ctx, hair, (c) => {
        c.moveTo(53, 54);
        c.bezierCurveTo(45, 30, 58, 7, 84, 8);
        c.bezierCurveTo(108, 9, 117, 28, 107, 54);
        c.lineTo(104, 40);
        c.quadraticCurveTo(95, 30, 76, 34);
        c.quadraticCurveTo(62, 37, 57, 47);
        c.closePath();
      });
      stroke(ctx, hi, 3, (c) => {
        c.moveTo(60, 24);
        c.quadraticCurveTo(76, 12, 98, 17);
        c.moveTo(64, 32);
        c.quadraticCurveTo(80, 22, 100, 27);
      });
      stroke(ctx, dark, 1.6, (c) => {
        c.moveTo(68, 13);
        c.quadraticCurveTo(66, 22, 70, 33);
      });
      return;
    case "spiky":
      fill(ctx, hair, (c) => {
        c.moveTo(53, 50);
        c.lineTo(54, 34);
        const spikes = [[47, 24], [60, 25], [56, 10], [70, 17], [75, 2], [83, 15], [93, 4], [95, 19], [109, 12], [103, 28], [114, 31], [106, 36]];
        for (const [x, y] of spikes) c.lineTo(x, y);
        c.lineTo(107, 50);
        c.lineTo(103, 40);
        c.quadraticCurveTo(80, 32, 57, 40);
        c.closePath();
      });
      stroke(ctx, hi, 2, (c) => {
        c.moveTo(66, 24);
        c.lineTo(73, 12);
        c.moveTo(86, 22);
        c.lineTo(92, 10);
      });
      return;
    case "curtain":
      fill(ctx, hair, curtain);
      stroke(ctx, dark, 1.6, (c) => {
        c.moveTo(80, 13);
        c.lineTo(80, 25);
      });
      stroke(ctx, hi, 2.2, (c) => {
        c.moveTo(62, 22);
        c.quadraticCurveTo(70, 15, 76, 15);
        c.moveTo(84, 15);
        c.quadraticCurveTo(90, 15, 98, 22);
      });
      return;
    case "wavy":
      fill(ctx, hair, (c) => {
        c.moveTo(54, 50);
        c.lineTo(55, 34);
        c.lineTo(105, 34);
        c.lineTo(106, 50);
        c.lineTo(101, 39);
        c.quadraticCurveTo(80, 33, 59, 39);
        c.closePath();
      });
      for (const [x, y, r] of [[57, 34, 8], [62, 23, 9], [73, 16, 9.5], [86, 15, 9.5], [98, 21, 9], [104, 32, 8]]) ellipse(ctx, x, y, r, r, hair);
      stroke(ctx, hi, 2, (c) => {
        c.moveTo(66, 20);
        c.quadraticCurveTo(70, 15, 75, 17);
        c.moveTo(82, 13);
        c.quadraticCurveTo(87, 10, 91, 14);
        c.moveTo(96, 20);
        c.quadraticCurveTo(100, 22, 101, 27);
      });
      return;
    case "straight":
      fill(ctx, hair, (c) => {
        c.moveTo(51, 58);
        c.bezierCurveTo(46, 20, 62, 11, 80, 11);
        c.bezierCurveTo(98, 11, 114, 20, 109, 58);
        c.lineTo(105, 58);
        c.lineTo(104, 42);
        const fringe = [[98, 46], [93, 40], [87, 46], [81, 40], [75, 46], [69, 40], [63, 46], [57, 41]];
        for (const [x, y] of fringe) c.lineTo(x, y);
        c.lineTo(55, 58);
        c.closePath();
      });
      stroke(ctx, hi, 2.4, (c) => {
        c.moveTo(62, 21);
        c.quadraticCurveTo(80, 13, 98, 21);
      });
      return;
  }
}

/** 바탕마다 다른 생김새 */
const FACE: Record<LookKey, { eye: "round" | "almond"; nose: "wide" | "narrow" | "mid" | "small"; lips: boolean }> = {
  black: { eye: "round", nose: "wide", lips: true },
  white: { eye: "round", nose: "narrow", lips: false },
  hispanic: { eye: "round", nose: "mid", lips: false },
  asian: { eye: "almond", nose: "small", lips: false },
};

const faceClip = (c: Ctx) => c.ellipse(80, 52, 27, 31, 0, 0, Math.PI * 2);

function drawBeard(ctx: Ctx, look: Look): void {
  const { hair, beard } = look;
  if (beard === "none") return;
  ctx.save();
  ctx.beginPath();
  faceClip(ctx);
  ctx.clip();
  if (beard === "stubble") fill(ctx, hair, (c) => c.ellipse(80, 80, 25, 14, 0, 0, Math.PI * 2), 0.24);
  if (beard === "full")
    fill(
      ctx,
      hair,
      (c) => {
        c.moveTo(52, 56);
        c.lineTo(58, 66);
        c.quadraticCurveTo(80, 61, 102, 66);
        c.lineTo(108, 56);
        c.lineTo(108, 90);
        c.lineTo(52, 90);
        c.closePath();
      },
      0.92,
    );
  ctx.restore();
  if (beard === "goatee" || beard === "mustache" || beard === "full")
    stroke(ctx, hair, 3.4, (c) => {
      c.moveTo(72, 71.5);
      c.quadraticCurveTo(80, 68, 88, 71.5);
    });
  if (beard === "goatee") ellipse(ctx, 80, 81, 6, 3.6, hair);
  // 턱수염 사이로 입술이 보여요.
  if (beard === "full") ellipse(ctx, 80, 75, 7.5, 3.4, shade(look.skin, -0.1));
}

function drawFace(ctx: Ctx, look: Look): void {
  const { kind, skin, hair } = look;
  const f = FACE[kind];
  const line = shade(skin, -0.45);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // 눈썹 (밝은 머리색이면 조금 진하게)
  const brow = isLight(hair) ? shade(hair, -0.45) : shade(hair, 0.05);
  stroke(ctx, brow, 3.6, (c) => {
    const by = kind === "asian" ? 50 : 48;
    c.moveTo(63, by + 1);
    c.quadraticCurveTo(69, by - 3, 75, by);
    c.moveTo(85, by);
    c.quadraticCurveTo(91, by - 3, 97, by + 1);
  });

  // 눈
  for (const [ex, side] of [[69, -1], [91, 1]] as const) {
    if (f.eye === "almond") {
      const rot = side * -0.14;
      ellipse(ctx, ex, 57, 5.4, 2.4, "#FFFFFF", rot);
      ellipse(ctx, ex, 57, 2.5, 2.3, look.eyes);
      stroke(ctx, "#1A1210", 2, (c) => {
        c.ellipse(ex, 57.3, 5.6, 2.6, rot, Math.PI * 1.02, Math.PI * 1.98);
      });
    } else {
      ellipse(ctx, ex, 57, 5, 3.7, "#FFFFFF");
      ellipse(ctx, ex, 57.3, 3, 3.1, look.eyes);
      ellipse(ctx, ex, 57.3, 1.5, 1.5, "#0E0A08");
      ellipse(ctx, ex + 1, 56.2, 0.8, 0.8, "#FFFFFF");
      stroke(ctx, "#1A1210", 1.4, (c) => {
        c.ellipse(ex, 57, 5.2, 3.9, 0, Math.PI * 1.05, Math.PI * 1.95);
      });
    }
  }

  // 코
  const nose = shade(skin, -0.2);
  switch (f.nose) {
    case "wide":
      ellipse(ctx, 80, 66.5, 7, 3.6, nose);
      ellipse(ctx, 76.5, 67, 1.5, 1.1, shade(skin, -0.5));
      ellipse(ctx, 83.5, 67, 1.5, 1.1, shade(skin, -0.5));
      break;
    case "narrow":
      stroke(ctx, line, 1.6, (c) => {
        c.moveTo(80, 57);
        c.quadraticCurveTo(84, 64, 82, 67);
        c.quadraticCurveTo(80, 68, 77, 67);
      });
      break;
    case "mid":
      ellipse(ctx, 80, 66, 5.2, 3, nose);
      stroke(ctx, line, 1.3, (c) => {
        c.moveTo(77, 66.5);
        c.quadraticCurveTo(80, 68.5, 83, 66.5);
      });
      break;
    case "small":
      ellipse(ctx, 80, 65.5, 3.8, 2.2, nose);
      break;
  }

  drawBeard(ctx, look);

  // 입
  if (f.lips) {
    ellipse(ctx, 80, 75.5, 7.5, 3.4, shade(skin, -0.32));
    stroke(ctx, shade(skin, -0.55), 1.6, (c) => {
      c.moveTo(72.5, 74.5);
      c.quadraticCurveTo(80, 77, 87.5, 74.5);
    });
  } else {
    stroke(ctx, "#8A3B30", 2, (c) => {
      c.moveTo(73, 73.5);
      c.quadraticCurveTo(80, 78.5, 87, 73.5);
    });
  }
}

function drawBody(ctx: Ctx, skin: string, color: string): void {
  const shorts = shade(color, -0.22);
  const trim = shade(color, 0.75);

  // 다리, 양말, 신발
  for (const lx of [58, 86]) {
    roundRect(ctx, lx, 176, 16, 40, 6, skin);
    roundRect(ctx, lx - 1, 202, 18, 14, 3, "#F4F4F4");
    roundRect(ctx, lx - 1, 206, 18, 3, 1, color);
  }
  roundRect(ctx, 50, 213, 26, 16, 7, "#F4F4F4");
  roundRect(ctx, 84, 213, 26, 16, 7, "#F4F4F4");
  roundRect(ctx, 49, 224, 28, 7, 3, "#2A2A2A");
  roundRect(ctx, 83, 224, 28, 7, 3, "#2A2A2A");

  // 반바지 (가운데가 갈라져요)
  fill(ctx, shorts, (c) => {
    c.moveTo(47, 146);
    c.lineTo(113, 146);
    c.lineTo(117, 189);
    c.lineTo(84, 189);
    c.lineTo(80, 177);
    c.lineTo(76, 189);
    c.lineTo(43, 189);
    c.closePath();
  });
  stroke(ctx, trim, 3, (c) => {
    c.moveTo(48, 152);
    c.lineTo(45, 186);
    c.moveTo(112, 152);
    c.lineTo(115, 186);
  });

  // 팔. 오른손은 공을 튀겨요.
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  stroke(ctx, skin, 15, (c) => {
    c.moveTo(51, 100);
    c.lineTo(41, 128);
    c.lineTo(42, 150);
  });
  stroke(ctx, skin, 15, (c) => {
    c.moveTo(109, 100);
    c.lineTo(121, 124);
    c.lineTo(126, 140);
  });
  ellipse(ctx, 42, 155, 8, 8.5, skin);

  // 공
  const bx = 131;
  const by = 160;
  ellipse(ctx, bx, by, 15, 15, "#E26A1E");
  stroke(ctx, "#5A2A10", 1.8, (c) => {
    c.moveTo(bx - 15, by);
    c.lineTo(bx + 15, by);
    c.moveTo(bx, by - 15);
    c.lineTo(bx, by + 15);
    c.moveTo(bx - 10, by - 11);
    c.quadraticCurveTo(bx - 3, by, bx - 10, by + 11);
    c.moveTo(bx + 10, by - 11);
    c.quadraticCurveTo(bx + 3, by, bx + 10, by + 11);
  });
  ellipse(ctx, 127, 143, 8, 8.5, skin);

  // 민소매 유니폼
  fill(ctx, color, (c) => {
    c.moveTo(53, 90);
    c.lineTo(67, 88);
    c.quadraticCurveTo(80, 106, 93, 88);
    c.lineTo(107, 90);
    c.quadraticCurveTo(103, 112, 116, 124);
    c.lineTo(114, 151);
    c.lineTo(46, 151);
    c.lineTo(44, 124);
    c.quadraticCurveTo(57, 112, 53, 90);
    c.closePath();
  });
  stroke(ctx, trim, 3, (c) => {
    c.moveTo(67, 88);
    c.quadraticCurveTo(80, 106, 93, 88);
    c.moveTo(107, 90);
    c.quadraticCurveTo(103, 112, 116, 124);
    c.moveTo(53, 90);
    c.quadraticCurveTo(57, 112, 44, 124);
  });
  roundRect(ctx, 45, 145, 70, 7, 2, shade(color, -0.35));
}

/** 선수를 캔버스의 (x, y)에 16x24칸(한 칸 scale 픽셀) 크기로 그려요. 유니폼은 color 색이에요. 화면의 Sprite와 기록 카드가 같이 써요. */
export function drawSprite(ctx: Ctx, look: Look, color: string, scale: number, x = 0, y = 0): void {
  const { skin } = look;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale / U, scale / U);

  drawBody(ctx, skin, color);
  drawHairBack(ctx, look);
  // 목과 귀, 얼굴
  roundRect(ctx, 71, 74, 18, 22, 6, shade(skin, -0.12));
  ellipse(ctx, 53, 57, 5, 7.5, shade(skin, -0.05));
  ellipse(ctx, 107, 57, 5, 7.5, shade(skin, -0.05));
  ellipse(ctx, 80, 52, 27, 31, skin);
  drawHairFront(ctx, look);
  if (look.band)
    fill(ctx, look.band, (c) => {
      c.moveTo(53, 41);
      c.quadraticCurveTo(80, 29, 107, 41);
      c.lineTo(107, 47);
      c.quadraticCurveTo(80, 35, 53, 47);
      c.closePath();
    });
  drawFace(ctx, look);

  ctx.restore();
}

interface SpriteProps {
  look: Look;
  /** 유니폼 색 (소속팀 색) */
  color: string;
  /** 16x24칸 그림의 한 칸 크기 (화면 크기는 CSS가 정해요) */
  scale?: number;
  label: string;
  className?: string;
}

/** 캔버스는 화면 크기보다 3배 크게 그려 고해상도 화면에서도 매끈하게 보여요. */
const DENSITY = 3;

/** 선수 캐릭터. 유니폼은 소속팀 색을 따라가요. */
export function Sprite({ look, color, scale = 6, label, className = "sprite" }: SpriteProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  // 캐릭터 객체가 새로 만들어져도 생김새가 같으면 다시 그리지 않아요.
  const key = JSON.stringify(look);

  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, 16 * scale * DENSITY, 24 * scale * DENSITY);
    ctx.scale(DENSITY, DENSITY);
    drawSprite(ctx, JSON.parse(key) as Look, color, scale);
  }, [key, color, scale]);

  return <canvas ref={ref} className={className} width={16 * scale * DENSITY} height={24 * scale * DENSITY} role="img" aria-label={label} />;
}
