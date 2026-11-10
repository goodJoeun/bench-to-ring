/*
 * 결정 시트 위에 띄우는 장면 그림. 장면(SceneKey)마다 배경, 소품, 내 캐릭터의 자세·표정·옷을 정해 캔버스 한 장에 그려요.
 * 높이는 SCENE_H로 고정이고 너비는 시트 너비를 그대로 써요. 가운데에서 좌우 160px 안에 주인공과 소품을 두고, 나머지는 배경만 이어져요.
 * 배경도 그림이라 밝은·어두운 화면 테마와 상관없이 같은 색이에요.
 */
import type { Look, SceneKey } from "@/game";
import { shade, type Mood } from "@/shared/ui/sprite/Sprite";
import { drawPosed, ellipse, line, poly, rrect, sparkle, type PosedExtra } from "@/shared/ui/sprite/coverArt";

type Ctx = CanvasRenderingContext2D;
type Pt = [number, number];

export const SCENE_H = 150;
/** 캐릭터 판(160x240)을 줄이는 배율과 발끝 높이 */
const S = 0.58;
const FEET = 145;

/** 그리는 데 필요한 것: 캔버스, 너비와 가운데, 내 생김새·유니폼 색·등번호·이름, 이 커리어의 라이벌, 조합을 고르는 seed */
export interface Paint {
  ctx: Ctx;
  w: number;
  cx: number;
  look: Look;
  color: string;
  num: number;
  name: string;
  rival: { look: Look; color: string };
  /** 결정마다 정해지는 수. 경기장 앵글·조명처럼 매번 달라지는 조합을 골라요. */
  seed: number;
}

/* ---------- 그리기 도구 ---------- */

function grad(ctx: Ctx, y0: number, y1: number, stops: string[]): CanvasGradient {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
  return g;
}

function band(p: Paint, y0: number, y1: number, fill: string | CanvasGradient): void {
  p.ctx.fillStyle = fill;
  p.ctx.fillRect(0, y0, p.w, y1 - y0);
}

function text(ctx: Ctx, s: string, x: number, y: number, size: number, color: string, weight = 800): void {
  ctx.font = `${weight} ${size}px system-ui, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(s, x, y);
}

/** 가장자리가 흐려지는 둥근 빛 */
function glow(ctx: Ctx, x: number, y: number, r: number, color: string, alpha: number): void {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();
}

function heart(ctx: Ctx, x: number, y: number, r: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y + r);
  ctx.bezierCurveTo(x - r * 1.6, y - r * 0.2, x - r * 0.7, y - r * 1.4, x, y - r * 0.5);
  ctx.bezierCurveTo(x + r * 0.7, y - r * 1.4, x + r * 1.6, y - r * 0.2, x, y + r);
  ctx.fill();
}

/** 정해진 자리에 흩뿌리는 점(별, 하트, 관중): 그릴 때마다 같은 자리에 나와요. */
function scatter(n: number, seed: number): Pt[] {
  const out: Pt[] = [];
  let s = seed;
  const next = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < n; i++) out.push([next(), next()]);
  return out;
}

/* ---------- 캐릭터 ---------- */

/** 손 위치(캐릭터 판 기준). 팔 길이(57) 안에 두어야 그 자리에 닿아요. */
const HANDS = {
  rest: [[42, 152], [118, 152]],
  ball: [[42, 152], [124, 124]],
  shoot: [[66, 46], [94, 46]],
  think: [[44, 150], [92, 82]],
  wave: [[42, 152], [138, 54]],
  cheer: [[22, 54], [138, 54]],
  hold: [[62, 128], [98, 128]],
  heart: [[72, 108], [88, 108]],
  point: [[42, 152], [164, 100]],
  salute: [[42, 152], [102, 46]],
  mic: [[42, 152], [96, 96]],
  bag: [[42, 152], [128, 136]],
  dribble: [[42, 152], [122, 146]],
  chest: [[62, 122], [98, 122]],
} satisfies Record<string, [Pt, Pt]>;
type HandKey = keyof typeof HANDS;

interface FigureOpt extends PosedExtra {
  scale?: number;
  /** 발끝 높이. 캔버스보다 아래면 다리가 잘린 클로즈업이 돼요. */
  feet?: number;
  flip?: boolean;
  look?: Look;
  color?: string;
}

/** 캐릭터를 x(가운데)에 세우고, 캔버스 위 두 손 위치를 돌려줘요. */
function figure(p: Paint, x: number, hands: HandKey, mood: Mood, o: FigureOpt = {}): { l: Pt; r: Pt; head: Pt } {
  const { ctx } = p;
  const s = o.scale ?? S;
  const top = (o.feet ?? FEET) - 231 * s;
  const dir = o.flip ? -1 : 1;
  const [l, r] = HANDS[hands];
  ctx.save();
  ctx.translate(x, top);
  ctx.scale(s * dir, s);
  ctx.translate(-80, 0);
  drawPosed(ctx, o.look ?? p.look, o.color ?? p.color, l, r, mood, o);
  ctx.restore();
  const at = ([bx, by]: Pt): Pt => [x + (bx - 80) * s * dir, top + by * s];
  return { l: at(l), r: at(r), head: at([80, 18]) };
}

/* ---------- 카메라 (경기장 장면) ---------- */

/** 캐릭터를 잡는 샷: 전신, 허리 위 클로즈업, 올려다보는 앵글(발끝이 살짝 잘림), 멀리서 잡은 와이드 */
const SHOTS = [
  { scale: S, feet: FEET },
  { scale: 0.8, feet: 190 },
  { scale: 0.68, feet: 160 },
  { scale: 0.48, feet: 138 },
] as const;

interface Cam {
  scale: number;
  feet: number;
  flip: boolean;
  /** 화면 기울기(라디안). 0이면 똑바로 */
  tilt: number;
  hold: "ball" | "chest" | "dribble";
}

/**
 * 경기장 장면의 카메라. 배경 앵글과 겹치지 않는 seed 자리로 골라서 배경과 따로 섞여요.
 * close가 아니면 클로즈업을 빼요(두 사람이 마주 서는 라이벌전). 클로즈업에서는 드리블 공이 화면 밖으로 나가서 빼요.
 */
function camOf(p: Paint, close = true): Cam {
  const k = Math.floor(p.seed / 24);
  const shots = close ? SHOTS : SHOTS.filter((v) => v.scale < 0.8);
  const shot = shots[k % shots.length];
  const holds = shot.scale >= 0.8 ? (["ball", "chest"] as const) : (["ball", "chest", "dribble"] as const);
  return {
    ...shot,
    flip: Math.floor(k / 4) % 2 === 1,
    tilt: [0, 0.03, -0.03][Math.floor(k / 8) % 3],
    hold: holds[Math.floor(k / 24) % holds.length],
  };
}

/** 카메라대로 공을 든 캐릭터를 그려요. 공 크기도 샷 크기를 따라가요. */
function withBall(p: Paint, x: number, cam: Cam, mood: Mood): { l: Pt; r: Pt; head: Pt } {
  const k = cam.scale / S;
  const dir = cam.flip ? -1 : 1;
  const h = figure(p, x, cam.hold, mood, { scale: cam.scale, feet: cam.feet, flip: cam.flip });
  if (cam.hold === "chest") ball(p.ctx, x, h.head[1] + (116 - 18) * cam.scale, 12 * k);
  else if (cam.hold === "dribble") ball(p.ctx, h.r[0] + 2 * k * dir, h.r[1] + 16 * k, 9 * k);
  else ball(p.ctx, h.r[0] + 6 * k * dir, h.r[1] - 4 * k, 9 * k);
  return h;
}

/** 머리 위 땀방울 */
function sweat(ctx: Ctx, x: number, y: number): void {
  poly(ctx, [[x, y - 7], [x + 4, y + 1], [x - 4, y + 1]], "#7EC8EE");
  ellipse(ctx, x, y + 2, 4, 4, "#7EC8EE");
  ellipse(ctx, x - 1.2, y + 1, 1.3, 1.3, "#FFFFFF");
}

/** 내 머리 꼭대기 근처(캐릭터 판 기준 머리 위) */
/** 캐릭터 판의 점(bx, by)이 캔버스에서 오는 자리. 캐릭터가 x에 서 있을 때예요. */
const bp = (x: number, bx: number, by: number): Pt => [x + (bx - 80) * S, FEET - 231 * S + by * S];
const headTop = (x: number, s = S): Pt => [x, FEET - 231 * s + 18 * s];

/* ---------- 소품 ---------- */

function ball(ctx: Ctx, x: number, y: number, r = 9): void {
  ellipse(ctx, x, y, r, r, "#E8742A");
  ctx.strokeStyle = "#7A3410";
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(x - r, y);
  ctx.lineTo(x + r, y);
  ctx.moveTo(x, y - r);
  ctx.lineTo(x, y + r);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x - r * 1.25, y, r * 0.95, -0.9, 0.9);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x + r * 1.25, y, r * 0.95, Math.PI - 0.9, Math.PI + 0.9);
  ctx.stroke();
}

/** 골대: 쿠션 댄 기둥과 팔, 유리 백보드, 림, 마름모 그물. (x, y)가 림 가운데예요. */
function hoop(ctx: Ctx, x: number, y: number, pole = true): void {
  if (pole) {
    rrect(ctx, x + 30, y - 36, 7, FEET - y + 36, 2, "#4A5361");
    rrect(ctx, x + 27, FEET - 42, 13, 42, 4, "#2F5DB0");
    rrect(ctx, x + 27, FEET - 42, 13, 3, 1, "#4F7FD6");
    poly(ctx, [[x + 14, y - 38], [x + 33, y - 36], [x + 33, y - 27], [x + 14, y - 24]], "#4A5361");
  }
  // 유리 백보드: 흰 테두리, 주황 슛 박스, 비치는 빛
  rrect(ctx, x - 31, y - 52, 62, 42, 3, "rgba(226,240,252,0.94)");
  ctx.strokeStyle = "#FFFFFF";
  ctx.lineWidth = 3;
  ctx.strokeRect(x - 31, y - 52, 62, 42);
  ctx.strokeStyle = "#9AA3AE";
  ctx.lineWidth = 1;
  ctx.strokeRect(x - 33, y - 54, 66, 46);
  ctx.strokeStyle = "#E2571E";
  ctx.lineWidth = 2.2;
  ctx.strokeRect(x - 11, y - 33, 22, 17);
  ctx.save();
  ctx.globalAlpha = 0.55;
  poly(ctx, [[x - 26, y - 49], [x - 18, y - 49], [x - 27, y - 13], [x - 29, y - 13]], "#FFFFFF");
  ctx.restore();
  rrect(ctx, x - 4, y - 12, 8, 10, 1, "#B8461A");
  // 그물: 위는 넓고 아래로 좁아지는 마름모 그물
  const top: Pt[] = [0, 1, 2, 3, 4, 5, 6].map((i) => [x - 13 + (26 * i) / 6, y + 1]);
  const mid: Pt[] = [0, 1, 2, 3, 4, 5, 6].map((i) => [x - 10 + (20 * i) / 6, y + 11]);
  const bot: Pt[] = [0, 1, 2, 3, 4, 5, 6].map((i) => [x - 8 + (16 * i) / 6, y + 21]);
  const mesh = (color: string, width: number) => {
    for (const [a, b] of [[top, mid], [mid, bot]] as const)
      for (let i = 0; i < 7; i++) {
        if (i < 6) line(ctx, [a[i], b[i + 1]], color, width);
        if (i > 0) line(ctx, [a[i], b[i - 1]], color, width);
      }
    line(ctx, bot, color, width);
  };
  mesh("#9AA3AE", 2.6);
  mesh("#FFFFFF", 1.3);
  // 림: 앞뒤가 보이게 납작한 고리
  ctx.strokeStyle = "#E2571E";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(x, y, 14, 3.5, 0, 0, Math.PI * 2);
  ctx.stroke();
}

/** 책상(앞쪽 가림판): 캐릭터 아랫몸을 가려요. */
function desk(p: Paint, x0: number, x1: number, y: number, top: string, front: string): void {
  rrect(p.ctx, x0, y, x1 - x0, 7, 3, top);
  rrect(p.ctx, x0 + 4, y + 6, x1 - x0 - 8, SCENE_H - y, 2, front);
}

function paper(ctx: Ctx, x: number, y: number, w: number, h: number, tilt = 0): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  rrect(ctx, -w / 2, -h / 2, w, h, 2, "#FFFFFF");
  for (let i = 0; i < 4; i++) rrect(ctx, -w / 2 + 5, -h / 2 + 6 + i * 6, w - 10 - (i % 2) * 8, 2, 1, "#C9D1DC");
  ctx.restore();
}

function speech(ctx: Ctx, x: number, y: number, w: number, h: number, fill: string, tailRight = false): void {
  rrect(ctx, x - w / 2, y - h / 2, w, h, h / 2, fill);
  const tx = tailRight ? x + w / 4 : x - w / 4;
  poly(ctx, [[tx - 5, y + h / 2 - 2], [tx + 5, y + h / 2 - 2], [tx + (tailRight ? 8 : -8), y + h / 2 + 8]], fill);
}

function flash(ctx: Ctx, x: number, y: number, r: number): void {
  ctx.save();
  ctx.globalAlpha = 0.35;
  ellipse(ctx, x, y, r * 1.6, r * 1.6, "#FFFFFF");
  ctx.restore();
  sparkle(ctx, x, y, r, "#FFFFFF");
}

function anger(ctx: Ctx, x: number, y: number, r = 7): void {
  ctx.strokeStyle = "#E8505B";
  ctx.lineWidth = 2.6;
  ctx.lineCap = "round";
  for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    ctx.beginPath();
    ctx.moveTo(x + sx * r * 0.25, y + sy * r);
    ctx.quadraticCurveTo(x + sx * r * 0.3, y + sy * r * 0.3, x + sx * r, y + sy * r * 0.25);
    ctx.stroke();
  }
}

function frameOnWall(ctx: Ctx, x: number, y: number, w: number, h: number, inner: string): void {
  rrect(ctx, x - w / 2, y - h / 2, w, h, 2, "#8A5A2E");
  rrect(ctx, x - w / 2 + 3, y - h / 2 + 3, w - 6, h - 6, 1, inner);
}

/* ---------- 배경 ---------- */

/** 체육관: 벽, 창, 나무 바닥과 코트 선. 밤이면 창밖이 어둡고 실내도 어둑해요. */
function gymBg(p: Paint, night = false): void {
  const { ctx, w } = p;
  band(p, 0, 104, grad(ctx, 0, 104, night ? ["#2A3350", "#3A4566"] : ["#DCE4EE", "#C7D2E0"]));
  for (let x = ((p.cx - 150) % 120) - 120; x < w; x += 120) {
    rrect(ctx, x, 14, 70, 40, 3, night ? "#121A33" : "#F4F9FF");
    rrect(ctx, x + 34, 14, 2, 40, 1, night ? "#3A4566" : "#C7D2E0");
    if (night) for (const [sx, sy] of scatter(3, x + 7)) sparkle(ctx, x + 6 + sx * 58, 18 + sy * 30, 1.8, "#FFF4C2");
  }
  band(p, 100, 104, night ? "#1E2640" : "#9FB0C4");
  band(p, 104, SCENE_H, grad(ctx, 104, SCENE_H, night ? ["#7A5233", "#5E3E26"] : ["#D9A066", "#C4864A"]));
  ctx.strokeStyle = night ? "rgba(0,0,0,0.18)" : "rgba(120,70,30,0.22)";
  ctx.lineWidth = 1;
  for (let y = 112; y < SCENE_H; y += 9) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(p.cx + 120, 150, 120, 26, 0, Math.PI, Math.PI * 2);
  ctx.stroke();
  if (night) glow(ctx, p.cx - 50, 80, 110, "#FFE9A8", 0.45);
}

function wallBg(p: Paint, wall: [string, string], floor: [string, string], floorY = 112): void {
  band(p, 0, floorY, grad(p.ctx, 0, floorY, wall));
  band(p, floorY, SCENE_H, grad(p.ctx, floorY, SCENE_H, floor));
}

/** 바깥: 하늘, 먼 건물, 땅 */
function skyBg(p: Paint, sky: [string, string], ground: [string, string], city = "#9FB3C8"): void {
  const { ctx, w } = p;
  band(p, 0, 112, grad(ctx, 0, 112, sky));
  for (let x = ((p.cx - 200) % 46) - 46, i = 0; x < w; x += 46, i++) {
    const h = 26 + ((i * 37) % 30);
    rrect(ctx, x, 112 - h, 38, h + 2, 2, city);
  }
  band(p, 110, SCENE_H, grad(ctx, 110, SCENE_H, ground));
}

/**
 * 경기장 배경. 결정마다 정해지는 seed로 앵글 4가지(정면 관중석, 코트 옆 낮은 앵글, 엔드라인에서 본 코트, 위층 관중석)와
 * 조명 색 3가지(따뜻한 빛, 차가운 빛, 우리 팀 색), 관중석 카메라 플래시를 섞어 그려요. 바닥 높이는 어느 앵글이든 같아서 소품 자리는 그대로예요.
 * crowd를 주면 관중 옷 색을 자리(x)마다 정해요. bright가 아니면 조명을 끄고 어둑하게 그려요.
 */
function arenaBg(p: Paint, bright = true, crowd?: (x: number) => string[]): void {
  const { ctx, w, cx } = p;
  const angle = p.seed % 4;
  const tint = ["#FFF4C2", "#CFE6FF", shade(p.color, 0.6)][Math.floor(p.seed / 4) % 3];
  const flashes = Math.floor(p.seed / 12) % 2 === 1;
  const mixed = [p.color, "#F4F4F4", "#F5C443", "#E8505B", "#4FB3E8"];
  const fan = (x: number, i: number, row: number) => {
    const colors = crowd?.(x) ?? mixed;
    return colors[(i * 7 + row * 3) % colors.length];
  };
  band(p, 0, SCENE_H, grad(ctx, 0, SCENE_H, ["#101830", "#1C2646"]));

  if (angle === 0) {
    // 정면 관중석: 고른 네 줄
    for (let row = 0; row < 4; row++)
      for (let x = (row % 2) * 7 - 6, i = 0; x < w; x += 14, i++) spectator(ctx, x, 46 + row * 15, 5.4, fan(x, i, row), -0.35 + row * 0.08, i + row);
    woodFloor(p, 104);
    if (bright)
      for (let x = ((cx - 120) % 160) - 160; x < w; x += 160) {
        ctx.save();
        ctx.globalAlpha = 0.18;
        poly(ctx, [[x + 70, 0], [x + 90, 0], [x + 130, SCENE_H], [x + 30, SCENE_H]], tint);
        ctx.restore();
        ellipse(ctx, x + 80, 6, 12, 5, "#FFF7D6");
      }
  } else if (angle === 1) {
    // 코트 옆 낮은 앵글: 위로 갈수록 작아지는 관중, 천장 트러스, LED 광고판
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1.5;
    for (let x = ((cx - 10) % 40) - 40; x < w; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 4);
      ctx.lineTo(x + 20, 18);
      ctx.lineTo(x + 40, 4);
      ctx.stroke();
    }
    band(p, 3, 5, "rgba(255,255,255,0.1)");
    band(p, 17, 19, "rgba(255,255,255,0.1)");
    for (let row = 6; row >= 0; row--) {
      const y = 90 - row * 9 - row * row * 0.4;
      const r = 5.5 - row * 0.5;
      const step = r * 2.6;
      for (let x = (row % 2) * (step / 2) - step, i = 0; x < w + step; x += step, i++) spectator(ctx, x, y, r * 1.05, fan(x, i, row), -0.2 - row * 0.07, i + row);
    }
    band(p, 94, 108, "#0B0F1C");
    for (let x = ((cx - 30) % 64) - 64, i = 0; x < w; x += 64, i++) {
      rrect(ctx, x + 4, 97, 56, 8, 2, i % 2 ? p.color : shade(tint, -0.25));
      for (let d = 0; d < 3; d++) rrect(ctx, x + 12 + d * 14, 100, 9, 2, 1, "rgba(255,255,255,0.85)");
    }
    woodFloor(p, 108);
    band(p, 113, 117, "rgba(255,255,255,0.1)");
    if (bright) {
      for (let x = ((cx - 40) % 80) - 80; x < w; x += 80) ellipse(ctx, x + 40, 11, 6, 3, "#FFF7D6");
      glow(ctx, cx, 30, 200, tint, 0.18);
    }
  } else if (angle === 2) {
    // 엔드라인에서 본 코트: 먼 관중석, 비스듬한 옆 관중석, 멀어질수록 모이는 코트 선
    const vx = cx + 30;
    for (let row = 0; row < 4; row++)
      for (let x = (row % 2) * 4 - 4, i = 0; x < w; x += 8, i++) spectator(ctx, x, 42 + row * 8, 3.3, fan(x, i, row), -0.45 + row * 0.06, i + row);
    for (const side of [-1, 1]) {
      const edge = side < 0 ? 0 : w;
      const inner = cx + side * 150;
      poly(ctx, [[edge, 20], [inner, 72], [inner, 82], [edge, 82]], "#141C33");
      for (let row = 0; row < 5; row++)
        for (let t = 0.04, i = 0; t < 1; t += 0.06, i++) {
          const x = edge + (inner - edge) * t;
          const y = 30 + 44 * t + row * 10;
          if (y < 80) spectator(ctx, x, y, 3.9 - t * 1.4, fan(x, i, row), -0.3, i + row);
        }
    }
    band(p, 74, 82, "#0B0F1C");
    band(p, 82, SCENE_H, grad(ctx, 82, SCENE_H, ["#B98250", "#D9A066"]));
    ctx.strokeStyle = "rgba(255,255,255,0.6)";
    ctx.lineWidth = 2;
    for (const bx of [-1.2, 1.2]) {
      ctx.beginPath();
      ctx.moveTo(vx + bx * 160, SCENE_H);
      ctx.lineTo(vx + bx * 40, 82);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.ellipse(vx, 100, 46, 7, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.save();
    ctx.globalAlpha = 0.25;
    poly(ctx, [[vx - 20, 82], [vx + 20, 82], [vx + 34, 92], [vx - 34, 92]], p.color);
    ctx.restore();
    // 멀리 매달린 전광판
    rrect(ctx, cx - 150, 4, 46, 24, 3, "#0B0F1C");
    rrect(ctx, cx - 147, 7, 19, 18, 2, shade(tint, -0.5));
    rrect(ctx, cx - 126, 7, 19, 18, 2, shade(tint, -0.5));
    if (bright) for (let x = ((cx - 20) % 60) - 60; x < w; x += 60) glow(ctx, x + 30, 8, 26, tint, 0.55);
  } else {
    // 위층 관중석: 천장 들보에 걸린 우승 배너와 비스듬히 내려가는 관중 줄
    band(p, 6, 9, "#2A3558");
    for (let x = ((cx - 8) % 46) - 46, i = 0; x < w; x += 46, i++) {
      const c = i % 2 ? p.color : "#C98F1C";
      rrect(ctx, x + 14, 9, 18, 30, 1, c);
      poly(ctx, [[x + 14, 39], [x + 32, 39], [x + 23, 45]], c);
      sparkle(ctx, x + 23, 20, 5, "#FFF4C2");
      rrect(ctx, x + 17, 29, 12, 2, 1, "rgba(255,255,255,0.6)");
    }
    for (let row = 0; row < 5; row++)
      for (let x = (row % 2) * 6 - 6, i = 0; x < w + 12; x += 12, i++) {
        const y = 54 + row * 11 + (x - cx) * 0.06;
        if (y > 46 && y < 102) spectator(ctx, x, y, 4.8, fan(x, i, row), -0.4 + row * 0.07, i + row);
      }
    woodFloor(p, 104);
    if (bright) {
      ctx.save();
      ctx.globalAlpha = 0.14;
      for (let x = ((cx - 60) % 200) - 200; x < w; x += 200) poly(ctx, [[x, 0], [x + 30, 0], [x + 170, SCENE_H], [x + 100, SCENE_H]], tint);
      ctx.restore();
    }
  }

  if (!bright) band(p, 0, 104, "rgba(5,8,20,0.35)");
  if (bright && flashes)
    for (const [sx, sy] of scatter(9, p.seed % 97)) {
      const x = sx * w;
      if (Math.abs(x - cx) > 30) sparkle(ctx, x, 44 + sy * 50, 3 + sy * 2.5, "#FFFFFF");
    }
}

/** 관중 피부색. 자리마다 돌아가며 써요. */
const FAN_SKINS = ["#F1CFA4", "#D9A577", "#A8714A", "#6B4428", "#E8BC94"];

/**
 * 관중 한 명의 실루엣: 둥근 어깨의 몸통(응원하는 옷 색)과 머리. (x, y)가 어깨 위, r이 크기예요.
 * 뒷줄일수록 dark만큼 어둡게 칠하고, 몇 명은 두 팔을 들어 응원해요. n은 자리 번호예요.
 */
function spectator(ctx: Ctx, x: number, y: number, r: number, shirt: string, dark: number, n: number): void {
  const body = shade(shirt, dark);
  const skin = shade(FAN_SKINS[n % FAN_SKINS.length], dark - 0.05);
  if (n % 6 === 0) {
    for (const side of [-1, 1]) {
      line(ctx, [[x + side * r * 0.7, y + r * 0.2], [x + side * r * 1.05, y - r * 1.5]], body, r * 0.42);
      ellipse(ctx, x + side * r * 1.05, y - r * 1.6, r * 0.27, r * 0.27, skin);
    }
  }
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.roundRect(x - r, y - r * 0.05, r * 2, r * 1.6, [r * 0.85, r * 0.85, 0, 0]);
  ctx.fill();
  ellipse(ctx, x, y - r * 0.62, r * 0.55, r * 0.62, skin);
  // 머리카락이나 모자
  ctx.fillStyle = n % 4 === 1 ? body : shade("#2A1A10", dark);
  ctx.beginPath();
  ctx.ellipse(x, y - r * 0.82, r * 0.57, r * 0.44, 0, Math.PI, 0);
  ctx.fill();
}

/** 경기장 나무 바닥: y부터 아래로. 위에 얇은 경계선을 둬요. */
function woodFloor(p: Paint, y: number): void {
  band(p, y, y + 4, "#2A3558");
  band(p, y + 4, SCENE_H, grad(p.ctx, y + 4, SCENE_H, ["#C99158", "#AF7840"]));
}

/** 무대: 어두운 막과 스포트라이트 */
function stageBg(p: Paint, spot: number, top: [string, string] = ["#2B1846", "#3E2163"]): void {
  const { ctx, w } = p;
  band(p, 0, SCENE_H, grad(ctx, 0, SCENE_H, top));
  ctx.strokeStyle = "rgba(0,0,0,0.18)";
  ctx.lineWidth = 6;
  for (let x = 10; x < w; x += 26) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 112);
    ctx.stroke();
  }
  band(p, 112, SCENE_H, grad(ctx, 112, SCENE_H, ["#5A3A24", "#3E2817"]));
  ctx.save();
  ctx.globalAlpha = 0.28;
  poly(ctx, [[spot - 18, 0], [spot + 18, 0], [spot + 70, SCENE_H], [spot - 70, SCENE_H]], "#FFF4C2");
  ctx.globalAlpha = 0.35;
  ellipse(ctx, spot, 140, 64, 10, "#FFF4C2");
  ctx.restore();
}

/* ---------- 장면 ---------- */

type Scene = (p: Paint) => void;

const scenes: Record<SceneKey, Scene> = {
  gym(p) {
    const { ctx, cx } = p;
    gymBg(p);
    // 바닥의 훈련용 콘과 공 바구니
    for (const x of [cx + 40, cx + 78, cx + 116]) {
      poly(ctx, [[x - 8, 140], [x, 118], [x + 8, 140]], "#F28C28");
      rrect(ctx, x - 6, 127, 12, 3, 1, "#FFFFFF");
      rrect(ctx, x - 11, 139, 22, 4, 2, "#D9731A");
    }
    rrect(ctx, cx + 128, 96, 36, 30, 3, "rgba(60,70,80,0.6)");
    for (const [dx, dy] of [[8, 0], [20, -2], [32, 1], [14, -12], [27, -11]]) ball(ctx, cx + 128 + dx, 96 + dy, 7);
    rrect(ctx, cx + 128, 112, 36, 3, 1, "#4A5361");
    rrect(ctx, cx + 130, 126, 3, 18, 1, "#4A5361");
    rrect(ctx, cx + 159, 126, 3, 18, 1, "#4A5361");
    // 두 손으로 가슴 앞에 든 공
    figure(p, cx - 40, "chest", "focus");
    const [bx, by] = bp(cx - 40, 80, 116);
    ball(ctx, bx, by, 12);
  },

  dawn(p) {
    const { ctx, cx } = p;
    gymBg(p, true);
    // 벽시계: 새벽 다섯 시
    ellipse(ctx, cx + 30, 32, 15, 15, "#F4F4F4");
    ctx.strokeStyle = "#232A3B";
    ctx.lineWidth = 2;
    ctx.stroke();
    line(ctx, [[cx + 30, 32], [cx + 36, 38]], "#232A3B", 2.4);
    line(ctx, [[cx + 30, 32], [cx + 30, 21]], "#232A3B", 1.6);
    hoop(ctx, cx + 110, 60);
    figure(p, cx - 50, "shoot", "focus");
    ball(ctx, cx - 50, 12, 8);
  },

  slump(p) {
    const { ctx, cx } = p;
    gymBg(p);
    hoop(ctx, cx + 95, 58);
    // 림 맞고 튀어나가는 공
    ball(ctx, cx + 128, 40, 8);
    ctx.strokeStyle = "rgba(60,40,20,0.45)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx + 112, 60, 18, -2.2, -0.6);
    ctx.stroke();
    text(ctx, "!", cx + 144, 26, 16, "#E8505B");
    figure(p, cx - 50, "rest", "glum", { bow: 0.35 });
    const [hx, hy] = headTop(cx - 50);
    sweat(ctx, hx + 26, hy + 8);
  },

  captain(p) {
    const { ctx, cx } = p;
    gymBg(p);
    // 주장 완장 엠블럼
    ellipse(ctx, cx + 75, 52, 26, 26, "#F5C443");
    ellipse(ctx, cx + 75, 52, 20, 20, "#FFD66B");
    text(ctx, "C", cx + 75, 53, 26, "#8A5A00", 900);
    for (const [x, y, r] of [[cx + 112, 30, 6], [cx + 40, 22, 4], [cx + 108, 78, 4]]) sparkle(ctx, x, y, r, "#FFF4C2");
    figure(p, cx - 35, "cheer", "beam");
  },

  board(p) {
    const { ctx, cx } = p;
    wallBg(p, ["#E6EAF0", "#D3DAE4"], ["#9C7A5B", "#836248"]);
    // 전술판: 코트 반쪽과 X·O, 화살표
    rrect(ctx, cx - 10, 16, 150, 86, 4, "#8A94A3");
    rrect(ctx, cx - 6, 20, 142, 78, 2, "#F8FAFC");
    ctx.strokeStyle = "#9AA3AE";
    ctx.lineWidth = 1.4;
    ctx.strokeRect(cx + 34, 20, 54, 34);
    ctx.beginPath();
    ctx.arc(cx + 61, 20, 40, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
    for (const [x, y] of [[cx + 20, 70], [cx + 100, 74], [cx + 60, 84]]) text(ctx, "O", x, y, 12, "#2F5DB0");
    for (const [x, y] of [[cx + 34, 60], [cx + 88, 62]]) text(ctx, "X", x, y, 12, "#C8372D");
    ctx.strokeStyle = "#2F5DB0";
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(cx + 26, 66);
    ctx.quadraticCurveTo(cx + 46, 36, cx + 70, 42);
    ctx.stroke();
    ctx.setLineDash([]);
    poly(ctx, [[cx + 70, 37], [cx + 78, 43], [cx + 68, 47]], "#2F5DB0");
    rrect(ctx, cx + 118, 96, 16, 4, 2, "#E8505B");
    figure(p, cx - 70, "think", "focus");
  },

  screen(p) {
    const { ctx, cx } = p;
    wallBg(p, ["#1A2238", "#232D48"], ["#2B3550", "#222A42"]);
    // 모니터: 경기 영상과 기록 그래프
    glow(ctx, cx + 60, 56, 120, "#7EC8EE", 0.35);
    rrect(ctx, cx - 6, 14, 140, 84, 5, "#0E1424");
    rrect(ctx, cx, 20, 128, 72, 2, "#2E7D57");
    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.lineWidth = 1.4;
    ctx.strokeRect(cx + 4, 24, 120, 64);
    ctx.beginPath();
    ctx.moveTo(cx + 64, 24);
    ctx.lineTo(cx + 64, 88);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx + 64, 56, 12, 0, Math.PI * 2);
    ctx.stroke();
    for (const [x, y, c] of [[cx + 30, 40, "#E8505B"], [cx + 92, 70, "#4FB3E8"], [cx + 48, 72, "#E8505B"], [cx + 100, 38, "#4FB3E8"]] as const)
      ellipse(ctx, x, y, 3.5, 3.5, c);
    poly(ctx, [[cx + 56, 50], [cx + 56, 62], [cx + 67, 56]], "rgba(255,255,255,0.85)");
    rrect(ctx, cx + 56, 98, 16, 12, 1, "#0E1424");
    rrect(ctx, cx + 40, 108, 48, 5, 2, "#0E1424");
    figure(p, cx - 72, "think", "focus");
  },

  study(p) {
    const { ctx, cx } = p;
    wallBg(p, ["#F2EBDD", "#E6DCC8"], ["#B58B5F", "#9C7650"]);
    // 칠판과 시험 날짜
    rrect(ctx, cx - 150, 12, 300, 66, 4, "#8A5A2E");
    rrect(ctx, cx - 146, 16, 292, 58, 2, "#2F5A44");
    text(ctx, "D-1", cx + 92, 40, 20, "#F4F4F4");
    ctx.strokeStyle = "rgba(255,255,255,0.6)";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(cx - 120, 34);
    ctx.lineTo(cx - 70, 34);
    ctx.moveTo(cx - 120, 48);
    ctx.lineTo(cx - 84, 48);
    ctx.stroke();
    figure(p, cx - 30, "think", "nervous", { outfit: "tee" });
    const [hx, hy] = headTop(cx - 30);
    sweat(ctx, hx + 28, hy + 10);
    desk(p, cx - 110, cx + 120, 112, "#C9925C", "#A87444");
    // 책 더미와 시험지
    for (const [i, c] of ["#E8505B", "#4FB3E8", "#F5C443", "#7BD389"].entries()) rrect(ctx, cx + 54 - i * 2, 104 - i * 8, 46, 8, 2, c);
    paper(ctx, cx - 70, 104, 36, 26, -0.15);
    text(ctx, "A+?", cx - 70, 104, 11, "#C8372D");
  },

  track(p) {
    const { ctx, cx, w } = p;
    skyBg(p, ["#8FD0F5", "#CDEBFA"], ["#4FA65A", "#3E8D49"]);
    // 붉은 트랙과 흰 레인
    band(p, 118, SCENE_H, "#C4523A");
    ctx.strokeStyle = "rgba(255,255,255,0.8)";
    ctx.lineWidth = 1.5;
    for (const y of [126, 136, 146]) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    // 결승 테이프
    rrect(ctx, cx + 80, 50, 4, 80, 1, "#F4F4F4");
    rrect(ctx, cx + 140, 50, 4, 80, 1, "#F4F4F4");
    line(ctx, [[cx + 82, 78], [cx + 110, 82], [cx + 142, 78]], "#F5C443", 3);
    for (const y of [70, 84, 98]) line(ctx, [[cx - 140, y], [cx - 100, y]], "rgba(255,255,255,0.8)", 2.5);
    const h = figure(p, cx - 40, "ball", "focus");
    // 바통
    ctx.save();
    ctx.translate(h.r[0], h.r[1]);
    ctx.rotate(-0.6);
    rrect(ctx, -3, -14, 6, 26, 3, "#F5C443");
    ctx.restore();
  },

  stage(p) {
    const { ctx, cx } = p;
    stageBg(p, cx - 30);
    for (const [x, y, r] of [[cx + 70, 30, 7], [cx + 110, 60, 5], [cx - 110, 40, 6], [cx + 40, 16, 4]]) sparkle(ctx, x, y, r, "#FFE58A");
    // 음표
    for (const [x, y] of [[cx + 80, 76], [cx - 100, 80]]) {
      ellipse(ctx, x, y, 5, 4, "#F4F4F4");
      line(ctx, [[x + 4, y], [x + 4, y - 18], [x + 12, y - 14]], "#F4F4F4", 2);
    }
    figure(p, cx - 30, "wave", "beam", { outfit: "tee" });
  },

  studio(p) {
    const { ctx, cx } = p;
    wallBg(p, ["#272C38", "#323846"], ["#1E222B", "#181B22"]);
    // ON AIR 불
    rrect(ctx, cx - 150, 14, 60, 20, 4, "#E8505B");
    text(ctx, "ON AIR", cx - 120, 24, 10, "#FFFFFF", 900);
    // 조명 판
    for (const x of [cx - 60, cx + 20]) rrect(ctx, x, 6, 40, 10, 3, "#FFF7D6");
    // 카메라와 삼각대
    line(ctx, [[cx + 108, 76], [cx + 92, 140]], "#5B6472", 3);
    line(ctx, [[cx + 108, 76], [cx + 124, 140]], "#5B6472", 3);
    line(ctx, [[cx + 108, 76], [cx + 108, 140]], "#5B6472", 3);
    rrect(ctx, cx + 84, 52, 48, 28, 5, "#151821");
    rrect(ctx, cx + 70, 58, 18, 16, 3, "#0B0D12");
    ellipse(ctx, cx + 72, 66, 6, 6, "#4FB3E8");
    ellipse(ctx, cx + 126, 58, 3, 3, "#E8505B");
    const h = figure(p, cx - 30, "mic", "smile", { outfit: "tee" });
    rrect(ctx, h.r[0] - 2.5, h.r[1] - 12, 5, 13, 2, "#2A2A2A");
    ellipse(ctx, h.r[0], h.r[1] - 14, 5, 5.5, "#5B6472");
  },

  press(p) {
    const { ctx, cx, w } = p;
    // 후원사 로고 벽
    band(p, 0, SCENE_H, "#EEF1F6");
    for (let y = 8, r = 0; y < 110; y += 26, r++)
      for (let x = ((cx - 13 * r) % 52) - 52; x < w; x += 52) rrect(ctx, x, y, 30, 14, 3, r % 2 ? shade(p.color, 0.55) : "#CBD3DF");
    flash(ctx, cx - 120, 36, 10);
    flash(ctx, cx + 128, 52, 8);
    figure(p, cx, "rest", "nervous", { outfit: "tee" });
    desk(p, cx - 150, cx + 150, 112, "#232A3B", "#2F3648");
    // 마이크 다발
    for (const [dx, c] of [[-26, "#E8505B"], [-10, "#2F5DB0"], [8, "#F5C443"], [24, "#1F7A4D"]] as const) {
      line(ctx, [[cx + dx * 0.4, 112], [cx + dx, 92]], "#1A1D24", 3);
      rrect(ctx, cx + dx - 5, 84, 10, 12, 4, "#1A1D24");
      rrect(ctx, cx + dx - 6, 94, 12, 6, 2, c);
    }
  },

  phone(p) {
    const { ctx, cx } = p;
    wallBg(p, ["#DDE6F5", "#C8D6EE"], ["#AFC0DC", "#9DB0D0"]);
    for (const [sx, sy] of scatter(8, 11)) {
      ctx.save();
      ctx.globalAlpha = 0.35;
      ellipse(ctx, cx - 160 + sx * 320, 10 + sy * 90, 8 + sy * 10, 8 + sy * 10, "#FFFFFF");
      ctx.restore();
    }
    // 큰 휴대폰 화면: 알림과 댓글
    rrect(ctx, cx + 30, 10, 88, 132, 14, "#1A1D24");
    rrect(ctx, cx + 35, 16, 78, 120, 10, "#F8FAFC");
    rrect(ctx, cx + 60, 19, 28, 4, 2, "#1A1D24");
    for (const [i, c] of ["#E8505B", "#4FB3E8", "#F5C443"].entries()) {
      const y = 34 + i * 30;
      ellipse(ctx, cx + 47, y + 6, 6, 6, c);
      rrect(ctx, cx + 57, y, 50, 5, 2, "#C9D1DC");
      rrect(ctx, cx + 57, y + 9, 34, 5, 2, "#DDE3EA");
    }
    ellipse(ctx, cx + 112, 14, 9, 9, "#E8505B");
    text(ctx, "99+", cx + 112, 14, 7, "#FFFFFF", 900);
    heart(ctx, cx + 136, 54, 7, "#E8505B");
    speech(ctx, cx + 140, 96, 26, 16, "#FFFFFF");
    text(ctx, "!?", cx + 140, 96, 10, "#232A3B", 900);
    figure(p, cx - 60, "think", "nervous", { outfit: "tee" });
    const [hx, hy] = headTop(cx - 60);
    sweat(ctx, hx + 28, hy + 10);
  },

  deal(p) {
    const { ctx, cx } = p;
    office(p);
    figure(p, cx - 40, "hold", "smile", { outfit: "suit" });
    desk(p, cx - 130, cx + 130, 112, "#6E4A2E", "#5A3B24");
    paper(ctx, cx - 4, 106, 54, 20, 0.05);
    line(ctx, [[cx - 20, 110], [cx + 10, 111]], "#2F5DB0", 1.6);
    // 만년필
    ctx.save();
    ctx.translate(cx + 30, 104);
    ctx.rotate(-0.7);
    rrect(ctx, -2.5, -14, 5, 22, 2, "#232A3B");
    poly(ctx, [[-2.5, 8], [2.5, 8], [0, 13]], "#F5C443");
    ctx.restore();
    // 서류 가방
    rrect(ctx, cx + 70, 86, 44, 28, 4, "#8A5A2E");
    rrect(ctx, cx + 84, 80, 16, 8, 3, "#5E3E22");
    rrect(ctx, cx + 89, 96, 6, 6, 1, "#F5C443");
    sparkle(ctx, cx + 124, 72, 6, "#FFE58A");
  },

  dealOff(p) {
    const { ctx, cx } = p;
    office(p, true);
    figure(p, cx - 40, "rest", "glum", { outfit: "suit", bow: 0.3 });
    desk(p, cx - 130, cx + 130, 112, "#6E4A2E", "#5A3B24");
    // 찢어진 계약서
    paper(ctx, cx - 12, 104, 26, 20, -0.25);
    paper(ctx, cx + 18, 106, 26, 20, 0.3);
    line(ctx, [[cx + 1, 94], [cx + 5, 100], [cx + 1, 106], [cx + 5, 112]], "#9AA3AE", 1.4);
    // 머리 위 먹구름
    const [hx, hy] = headTop(cx - 40);
    const [ox, oy] = [hx + 44, hy + 2];
    for (const [dx, r] of [[-12, 9], [0, 12], [12, 9]]) ellipse(ctx, ox + dx, oy, r, r * 0.8, "#7A8494");
    for (const dx of [-8, 2, 12]) line(ctx, [[ox + dx, oy + 12], [ox + dx - 3, oy + 20]], "#7EC8EE", 2);
  },

  shoe(p) {
    const { ctx, cx } = p;
    stageBg(p, cx + 75, ["#1C2B44", "#2A3E60"]);
    // 받침대 위 시그니처 농구화
    rrect(ctx, cx + 36, 104, 80, 40, 4, "#E7EBF0");
    rrect(ctx, cx + 36, 104, 80, 6, 3, "#FFFFFF");
    ctx.save();
    ctx.translate(cx + 76, 84);
    poly(ctx, [[-36, 14], [-34, -2], [-14, -8], [-4, -24], [16, -26], [22, -6], [38, 2], [40, 14]], p.color);
    rrect(ctx, -38, 12, 80, 9, 4, "#F4F4F4");
    rrect(ctx, -38, 18, 80, 4, 2, "#2A2A2A");
    line(ctx, [[-2, -18], [8, -10]], "#F4F4F4", 2);
    line(ctx, [[-6, -10], [4, -2]], "#F4F4F4", 2);
    poly(ctx, [[-24, 4], [6, -4], [28, 6], [-6, 8]], shade(p.color, 0.45));
    ctx.restore();
    for (const [x, y, r] of [[cx + 40, 40, 6], [cx + 118, 50, 7], [cx + 76, 26, 4]]) sparkle(ctx, x, y, r, "#FFE58A");
    figure(p, cx - 60, "point", "beam", { outfit: "tee" });
  },

  money(p) {
    const { ctx, cx } = p;
    office(p, true);
    // 투자 그래프: 오를지 내릴지 모를 화살표
    rrect(ctx, cx + 4, 14, 128, 80, 4, "#F8FAFC");
    ctx.strokeStyle = "#C9D1DC";
    ctx.lineWidth = 1;
    for (let y = 30; y < 90; y += 14) {
      ctx.beginPath();
      ctx.moveTo(cx + 12, y);
      ctx.lineTo(cx + 124, y);
      ctx.stroke();
    }
    line(ctx, [[cx + 14, 80], [cx + 40, 60], [cx + 60, 70], [cx + 86, 36], [cx + 104, 54], [cx + 120, 26]], "#1F9D55", 3);
    poly(ctx, [[cx + 114, 24], [cx + 124, 20], [cx + 122, 31]], "#1F9D55");
    text(ctx, "?", cx + 138, 30, 22, "#E8505B", 900);
    figure(p, cx - 60, "think", "nervous", { outfit: "suit" });
    // 동전 탑
    for (let i = 0; i < 4; i++) {
      ellipse(ctx, cx + 60, 138 - i * 6, 14, 5, "#C98F1C");
      ellipse(ctx, cx + 60, 136 - i * 6, 14, 5, "#F5C443");
    }
    for (let i = 0; i < 2; i++) {
      ellipse(ctx, cx + 92, 138 - i * 6, 14, 5, "#C98F1C");
      ellipse(ctx, cx + 92, 136 - i * 6, 14, 5, "#F5C443");
    }
  },

  home(p) {
    const { ctx, cx } = p;
    living(p);
    figure(p, cx - 40, "wave", "smile", { outfit: "tee" });
    speech(ctx, cx + 40, 34, 46, 24, "#FFFFFF");
    heart(ctx, cx + 40, 34, 6, "#E8505B");
  },

  dog(p) {
    const { ctx, cx } = p;
    living(p);
    figure(p, cx - 50, "hold", "beam", { outfit: "tee" });
    // 강아지
    const x = cx + 50;
    const y = 128;
    ellipse(ctx, x, y, 24, 14, "#E0B27A");
    rrect(ctx, x - 18, y + 4, 7, 14, 3, "#E0B27A");
    rrect(ctx, x + 10, y + 4, 7, 14, 3, "#E0B27A");
    line(ctx, [[x + 22, y - 4], [x + 32, y - 16]], "#E0B27A", 5);
    ellipse(ctx, x - 22, y - 16, 15, 13, "#E8C08A");
    ellipse(ctx, x - 34, y - 18, 6, 11, "#A87444");
    ellipse(ctx, x - 10, y - 20, 6, 10, "#A87444");
    ellipse(ctx, x - 27, y - 18, 2, 2.4, "#232A3B");
    ellipse(ctx, x - 17, y - 18, 2, 2.4, "#232A3B");
    ellipse(ctx, x - 22, y - 12, 3, 2.2, "#232A3B");
    ellipse(ctx, x - 22, y - 6, 2.4, 3, "#E8505B");
    for (const [hx, hy, r] of [[x - 6, y - 42, 6], [x + 14, y - 54, 4.5], [x - 30, y - 50, 4]]) heart(ctx, hx, hy, r, "#E8505B");
  },

  love(p) {
    const { ctx, cx } = p;
    band(p, 0, SCENE_H, grad(ctx, 0, SCENE_H, ["#FFD6E3", "#FFC2D4"]));
    for (const [sx, sy] of scatter(14, 5)) {
      ctx.save();
      ctx.globalAlpha = 0.5;
      heart(ctx, cx - 180 + sx * 360, 10 + sy * 120, 4 + sy * 6, "#FF8FAE");
      ctx.restore();
    }
    // 하트 봉인 편지
    ctx.save();
    ctx.translate(cx + 72, 64);
    ctx.rotate(0.12);
    rrect(ctx, -32, -20, 64, 42, 3, "#FFFFFF");
    poly(ctx, [[-32, -20], [32, -20], [0, 4]], "#F1E6EA");
    heart(ctx, 0, 2, 7, "#E8505B");
    ctx.restore();
    figure(p, cx - 40, "heart", "beam", { outfit: "tee" });
    heart(ctx, cx - 40, 76, 7, "#E8505B");
  },

  heartbreak(p) {
    const { ctx, cx, w } = p;
    band(p, 0, SCENE_H, grad(ctx, 0, SCENE_H, ["#5D6C84", "#7C8AA1"]));
    ctx.strokeStyle = "rgba(220,235,255,0.5)";
    ctx.lineWidth = 1.4;
    for (const [sx, sy] of scatter(40, 3)) {
      const x = sx * w;
      const y = sy * SCENE_H;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 3, y + 10);
      ctx.stroke();
    }
    // 금 간 하트
    heart(ctx, cx + 70, 64, 22, "#E8505B");
    line(ctx, [[cx + 70, 44], [cx + 64, 56], [cx + 74, 64], [cx + 66, 76], [cx + 70, 86]], "#5D6C84", 3);
    figure(p, cx - 40, "rest", "glum", { outfit: "tee", bow: 0.4 });
  },

  wedding(p) {
    const { ctx, cx } = p;
    band(p, 0, SCENE_H, grad(ctx, 0, SCENE_H, ["#FFF6EC", "#F6E6D6"]));
    // 꽃 아치
    ctx.strokeStyle = "#C9B79C";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(cx - 20, 150, 110, Math.PI * 1.05, Math.PI * 1.95);
    ctx.stroke();
    for (let i = 0; i <= 12; i++) {
      const a = Math.PI * (1.05 + (0.9 * i) / 12);
      const x = cx - 20 + Math.cos(a) * 110;
      const y = 150 + Math.sin(a) * 110;
      ellipse(ctx, x, y, 7, 7, i % 3 ? "#FFFFFF" : "#F7A8C0");
      ellipse(ctx, x, y, 2.5, 2.5, "#F5C443");
    }
    // 반지 두 개
    ctx.strokeStyle = "#F5C443";
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(cx + 96, 52, 11, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx + 112, 56, 11, 0, Math.PI * 2);
    ctx.stroke();
    sparkle(ctx, cx + 96, 40, 5, "#FFFFFF");
    sparkle(ctx, cx + 126, 44, 4, "#F5C443");
    const h = figure(p, cx - 20, "hold", "beam", { outfit: "suit" });
    // 부케
    const bx = (h.l[0] + h.r[0]) / 2;
    const by = h.l[1] - 6;
    for (const [dx, dy, c] of [[-7, 0, "#F7A8C0"], [7, 0, "#FFFFFF"], [0, -7, "#E8505B"], [0, 4, "#FFFFFF"]] as const) ellipse(ctx, bx + dx, by + dy, 6, 6, c);
    poly(ctx, [[bx - 5, by + 8], [bx + 5, by + 8], [bx, by + 20]], "#4FA65A");
  },

  clinic(p) {
    const { ctx, cx } = p;
    clinicRoom(p, "#7BD389", true);
    // 키 재는 눈금과 위로 자라는 화살표
    rrect(ctx, cx - 96, 10, 14, 102, 2, "#FFFFFF");
    for (let y = 16; y < 110; y += 8) rrect(ctx, cx - 96, y, y % 16 ? 5 : 9, 1.5, 0.5, "#5B6472");
    poly(ctx, [[cx - 20, 22], [cx - 12, 32], [cx - 17, 32], [cx - 17, 44], [cx - 23, 44], [cx - 23, 32], [cx - 28, 32]], "#1F9D55");
    figure(p, cx - 50, "rest", "smile", { outfit: "tee" });
  },

  injury(p) {
    const { ctx, cx } = p;
    clinicRoom(p, "#E8505B", false);
    const x = cx - 50;
    const h = figure(p, x, "bag", "nervous");
    // 오른쪽 무릎 붕대
    const [kx, ky] = bp(x, 84, 184);
    rrect(ctx, kx, ky, 22 * S, 14 * S, 2, "#FFFFFF");
    line(ctx, [[kx + 1, ky + 3], [kx + 22 * S - 1, ky + 5]], "#D3DAE4", 1.2);
    line(ctx, [[kx + 1, ky + 7], [kx + 22 * S - 1, ky + 9]], "#D3DAE4", 1.2);
    // 겨드랑이에 낀 목발
    const [ax, ay] = bp(x, 118, 104);
    line(ctx, [[ax, ay], [h.r[0] + 3, h.r[1]], [h.r[0] + 6, FEET]], "#9AA3AE", 3.5);
    rrect(ctx, ax - 8, ay - 3, 16, 5, 2.5, "#5B6472");
    rrect(ctx, h.r[0] - 2, h.r[1] - 2, 10, 4, 2, "#5B6472");
    rrect(ctx, h.r[0] + 3, FEET - 4, 7, 5, 2, "#232A3B");
  },

  sick(p) {
    const { ctx, cx } = p;
    // 원정 숙소의 밤: 창밖 달, 스탠드 불빛, 침대
    wallBg(p, ["#3A3F66", "#4A4F78"], ["#5A4A5E", "#4A3C4E"]);
    rrect(ctx, cx - 150, 14, 64, 52, 3, "#2A2E4E");
    rrect(ctx, cx - 146, 18, 56, 44, 2, "#151936");
    ellipse(ctx, cx - 104, 32, 8, 8, "#FFF4C2");
    ellipse(ctx, cx - 100, 29, 7, 7, "#151936");
    glow(ctx, cx + 140, 70, 60, "#FFE9A8", 0.45);
    rrect(ctx, cx + 136, 62, 10, 30, 2, "#C9B79C");
    poly(ctx, [[cx + 128, 62], [cx + 154, 62], [cx + 148, 46], [cx + 134, 46]], "#F7E2B0");
    rrect(ctx, cx + 30, 104, 120, 30, 6, "#F4F4F4");
    rrect(ctx, cx + 30, 112, 120, 22, 6, "#8FA8D8");
    rrect(ctx, cx + 34, 96, 34, 14, 6, "#FFFFFF");
    const x = cx - 40;
    figure(p, x, "rest", "glum", { outfit: "tee", bow: 0.15 });
    // 달아오른 볼과 머리 위 얼음주머니
    ctx.save();
    ctx.globalAlpha = 0.55;
    for (const bx of [64, 96]) {
      const [ex, ey] = bp(x, bx, 68);
      ellipse(ctx, ex, ey, 5, 3, "#FF6B6B");
    }
    ctx.restore();
    const [hx, hy] = headTop(x);
    rrect(ctx, hx - 16, hy - 6, 32, 12, 6, "#7EC8EE");
    rrect(ctx, hx - 12, hy - 4, 10, 3, 1.5, "#CFEFFF");
    // 큰 체온계와 열 표시
    rrect(ctx, cx + 4, 18, 14, 70, 7, "#FFFFFF");
    rrect(ctx, cx + 8, 28, 6, 54, 3, "#E7EBF0");
    rrect(ctx, cx + 8, 36, 6, 46, 3, "#E8505B");
    ellipse(ctx, cx + 11, 90, 10, 10, "#E8505B");
    for (let y = 30; y < 80; y += 8) rrect(ctx, cx + 15, y, 4, 1.4, 0.5, "#9AA3AE");
    speech(ctx, cx + 48, 26, 48, 20, "#FFFFFF");
    text(ctx, "38.5°", cx + 48, 26, 11, "#E8505B", 900);
    for (const [dx, dy] of [[28, 14], [34, 4]]) line(ctx, [[hx + dx - 4, hy + dy], [hx + dx + 4, hy + dy - 2]], "#FF8F8F", 2);
  },

  tired(p) {
    const { ctx, cx, w } = p;
    // 원정 경기장 라커룸: 줄지은 사물함과 벤치
    wallBg(p, ["#C9D3DF", "#B7C3D2"], ["#7A8494", "#6A7484"]);
    for (let x = ((cx - 20) % 34) - 34, i = 0; x < w; x += 34, i++) {
      rrect(ctx, x, 10, 32, 98, 2, i % 2 ? "#5A7BA8" : "#4F6F9C");
      for (let v = 0; v < 3; v++) rrect(ctx, x + 8, 18 + v * 5, 16, 2, 1, "rgba(0,0,0,0.25)");
      ellipse(ctx, x + 26, 60, 2, 2, "#C9D1DC");
    }
    const x = cx - 40;
    figure(p, x, "rest", "glum", { bow: 0.35 });
    // 목에 두른 수건
    const L = bp(x, 58, 92);
    const R = bp(x, 102, 92);
    const M = bp(x, 80, 104);
    line(ctx, [L, M, R], "#FFFFFF", 8);
    line(ctx, [L, bp(x, 60, 132)], "#FFFFFF", 8);
    line(ctx, [R, bp(x, 100, 132)], "#FFFFFF", 8);
    line(ctx, [bp(x, 60, 126), bp(x, 60, 131)], "#4FB3E8", 8);
    line(ctx, [bp(x, 100, 126), bp(x, 100, 131)], "#4FB3E8", 8);
    // 벤치
    rrect(ctx, cx - 150, 128, 300, 8, 3, "#C28448");
    rrect(ctx, cx - 140, 136, 6, 12, 1, "#93602F");
    rrect(ctx, cx + 134, 136, 6, 12, 1, "#93602F");
    // 방전된 배터리와 Zz
    rrect(ctx, cx + 40, 30, 54, 26, 4, "#232A3B");
    rrect(ctx, cx + 94, 38, 5, 10, 1, "#232A3B");
    rrect(ctx, cx + 44, 34, 46, 18, 2, "#F4F4F4");
    rrect(ctx, cx + 46, 36, 9, 14, 1, "#E8505B");
    text(ctx, "Z", cx + 112, 30, 16, "#5B6472", 900);
    text(ctx, "z", cx + 126, 20, 12, "#5B6472", 900);
    const [hx, hy] = headTop(x);
    sweat(ctx, hx + 28, hy + 12);
  },

  wellness(p) {
    const { ctx, cx } = p;
    wallBg(p, ["#EAF4E4", "#D8EBD0"], ["#C9B79C", "#B8A486"]);
    // 창으로 드는 햇빛과 화분
    ctx.save();
    ctx.globalAlpha = 0.4;
    poly(ctx, [[cx - 150, 10], [cx - 90, 10], [cx - 20, 112], [cx - 120, 112]], "#FFF9D6");
    ctx.restore();
    rrect(ctx, cx + 118, 92, 24, 22, 4, "#C4864A");
    for (const [dx, dy, r] of [[-8, -14, 9], [6, -20, 10], [0, -30, 8]]) ellipse(ctx, cx + 130 + dx, 94 + dy, r, r * 1.3, "#4FA65A");
    // 요가 매트
    rrect(ctx, cx - 110, 136, 140, 8, 4, "#9A7CD6");
    // 샐러드 그릇과 물병
    rrect(ctx, cx + 40, 98, 64, 6, 2, "#F4F4F4");
    rrect(ctx, cx + 46, 104, 4, 40, 1, "#D3DAE4");
    rrect(ctx, cx + 94, 104, 4, 40, 1, "#D3DAE4");
    ellipse(ctx, cx + 60, 92, 14, 7, "#7BD389");
    ellipse(ctx, cx + 56, 88, 4, 4, "#E8505B");
    ellipse(ctx, cx + 64, 88, 3.5, 3.5, "#F5C443");
    ctx.fillStyle = "#F4F4F4";
    ctx.beginPath();
    ctx.ellipse(cx + 60, 94, 16, 6, 0, 0, Math.PI);
    ctx.fill();
    rrect(ctx, cx + 82, 72, 12, 26, 4, "#7EC8EE");
    rrect(ctx, cx + 84, 66, 8, 7, 2, "#2F5DB0");
    figure(p, cx - 40, "cheer", "smile", { outfit: "tee" });
  },

  street(p) {
    const { ctx, cx, w } = p;
    skyBg(p, ["#7FC4F0", "#D2ECFA"], ["#5B6472", "#4A525E"]);
    // 철망 울타리
    ctx.strokeStyle = "rgba(60,70,80,0.45)";
    ctx.lineWidth = 1;
    for (let x = -120; x < w + 120; x += 10) {
      ctx.beginPath();
      ctx.moveTo(x, 54);
      ctx.lineTo(x + 56, 110);
      ctx.moveTo(x + 56, 54);
      ctx.lineTo(x, 110);
      ctx.stroke();
    }
    band(p, 52, 55, "#6E7886");
    ctx.strokeStyle = "rgba(255,255,255,0.75)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(cx + 110, 150, 110, 24, 0, Math.PI, Math.PI * 2);
    ctx.stroke();
    hoop(ctx, cx + 110, 60);
    text(ctx, "3x3", cx - 120, 132, 18, "rgba(255,255,255,0.7)", 900);
    const h = figure(p, cx - 40, "ball", "smirk", { outfit: "tee" });
    ball(ctx, h.r[0] + 6, h.r[1] - 4);
  },

  travel(p) {
    const { ctx, cx, w } = p;
    // 공항 큰 창과 이륙하는 비행기
    band(p, 0, SCENE_H, "#DCE3EC");
    rrect(ctx, 0, 10, w, 92, 0, "#9ED3F2");
    for (let x = ((cx - 30) % 90) - 90; x < w; x += 90) rrect(ctx, x, 10, 5, 92, 0, "#AEB8C6");
    ctx.save();
    ctx.translate(cx + 70, 46);
    ctx.rotate(-0.22);
    rrect(ctx, -40, -7, 80, 14, 7, "#FFFFFF");
    poly(ctx, [[-6, 0], [10, 0], [-14, 28], [-22, 28]], "#E7EBF0");
    poly(ctx, [[-6, 0], [10, 0], [-14, -26], [-22, -26]], "#E7EBF0");
    poly(ctx, [[-36, -4], [-28, -4], [-38, -18], [-44, -18]], "#E8505B");
    for (let i = 0; i < 5; i++) ellipse(ctx, 8 + i * 6, -1, 1.6, 1.6, "#4FB3E8");
    ctx.restore();
    band(p, 102, 110, "#AEB8C6");
    band(p, 110, SCENE_H, grad(ctx, 110, SCENE_H, ["#C5CEDA", "#B4BECC"]));
    const h = figure(p, cx - 40, "bag", "beam", { outfit: "tee" });
    // 여행 가방
    rrect(ctx, h.r[0] - 2, h.r[1] - 2, 4, 14, 1, "#232A3B");
    rrect(ctx, h.r[0] - 16, h.r[1] + 10, 32, 36, 5, "#E8505B");
    rrect(ctx, h.r[0] - 16, h.r[1] + 24, 32, 4, 1, "#B83A44");
    rrect(ctx, h.r[0] - 8, h.r[1] + 14, 10, 6, 2, "#F5C443");
  },

  kids(p) {
    const { ctx, cx } = p;
    gymBg(p);
    figure(p, cx - 70, "wave", "smile");
    const k1 = figure(p, cx + 30, "ball", "beam", { scale: 0.38, look: KIDS[0], color: "#4FB3E8" });
    ball(ctx, k1.r[0] + 4, k1.r[1] - 2, 7);
    figure(p, cx + 92, "cheer", "beam", { scale: 0.36, look: KIDS[1], color: "#F5C443" });
    for (const [x, y, r] of [[cx + 60, 46, 5], [cx + 130, 56, 4]]) sparkle(ctx, x, y, r, "#FFF4C2");
  },

  clash(p) {
    const { ctx, cx } = p;
    gymBg(p);
    figure(p, cx - 52, "rest", "focus");
    figure(p, cx + 52, "point", "smirk", { flip: true, look: MATE });
    // 번개와 화난 표시
    poly(ctx, [[cx - 2, 30], [cx + 10, 30], [cx + 2, 48], [cx + 12, 48], [cx - 6, 74], [cx - 2, 54], [cx - 10, 54]], "#F5C443");
    anger(ctx, cx - 82, 30);
  },

  crowd(p) {
    const { ctx, cx } = p;
    arenaBg(p);
    // 응원 현수막
    rrect(ctx, cx + 20, 20, 110, 26, 4, "#F5C443");
    heart(ctx, cx + 40, 33, 6, "#E8505B");
    text(ctx, `${p.num}번 화이팅!`, cx + 82, 33, 12, "#232A3B", 900);
    for (const [x, y, r] of [[cx + 140, 18, 5], [cx + 10, 14, 4]]) sparkle(ctx, x, y, r, "#FFF4C2");
    const cam = camOf(p);
    figure(p, cx - 40, "wave", "beam", { scale: cam.scale, feet: cam.feet, flip: cam.flip });
  },

  bigmatch(p) {
    const { ctx, cx } = p;
    arenaBg(p);
    // 전광판
    rrect(ctx, cx + 20, 8, 120, 46, 5, "#0B0F1C");
    rrect(ctx, cx + 24, 12, 112, 38, 3, "#141C33");
    text(ctx, "VS", cx + 80, 31, 18, "#F5C443", 900);
    ellipse(ctx, cx + 44, 31, 10, 10, p.color);
    ellipse(ctx, cx + 116, 31, 10, 10, "#E8505B");
    const cam = camOf(p);
    const h = withBall(p, cx - 40, cam, "focus");
    sweat(ctx, h.head[0] + 28 * (cam.scale / S), h.head[1] + 10);
    // 불꽃
    for (const [x, s] of [[cx + 50, 1], [cx + 100, 0.8]] as const) {
      poly(ctx, [[x - 10 * s, 144], [x - 6 * s, 110], [x, 124], [x + 4 * s, 100], [x + 10 * s, 144]], "#F5A623");
      poly(ctx, [[x - 5 * s, 144], [x - 2 * s, 122], [x + 2 * s, 130], [x + 5 * s, 144]], "#FFE58A");
    }
  },

  rivalGame(p) {
    const { ctx, cx } = p;
    const { look, color } = p.rival;
    // 관중석도 반으로 갈려요: 왼쪽은 우리 팀, 오른쪽은 라이벌 팀 색
    arenaBg(p, true, (x) => (x < cx ? [p.color, shade(p.color, 0.35), "#F4F4F4"] : [color, shade(color, 0.35), "#F4F4F4"]));
    glow(ctx, cx, 70, 110, "#E8505B", 0.35);
    rrect(ctx, cx - 38, 6, 76, 20, 10, "#E8505B");
    text(ctx, "라이벌전", cx, 16, 11, "#FFFFFF", 900);
    // 두 사람은 늘 마주 봐서 좌우 반전은 하지 않고, 샷 크기만 같이 바꿔요.
    const cam = { ...camOf(p, false), flip: false };
    withBall(p, cx - 62, cam, "focus");
    figure(p, cx + 62, "point", "smirk", { flip: true, look, color, scale: cam.scale, feet: cam.feet });
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#101830";
    ctx.font = "900 26px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.strokeText("VS", cx, 48);
    text(ctx, "VS", cx, 48, 26, "#F5C443", 900);
    anger(ctx, cx - 92, 34);
    for (const [x, y, r] of [[cx - 20, 72, 5], [cx + 22, 30, 4]]) sparkle(ctx, x, y, r, "#FFE58A");
  },

  standings(p) {
    const { ctx, cx } = p;
    arenaBg(p);
    // 순위표: 1위 팀을 반 경기 차로 쫓는 우리 팀(2위)
    rrect(ctx, cx + 4, 8, 146, 96, 6, "#0B0F1C");
    rrect(ctx, cx + 8, 12, 138, 88, 4, "#141C33");
    text(ctx, "순위", cx + 77, 23, 11, "#F5C443", 900);
    const rows: [string, number][] = [["#E8505B", 104], [p.color, 100], ["#7BD389", 70], ["#9AA3AE", 56]];
    rows.forEach(([c, len], i) => {
      const y = 36 + i * 16;
      if (i === 1) rrect(ctx, cx + 10, y - 7, 134, 14, 3, "rgba(245,196,67,0.28)");
      text(ctx, String(i + 1), cx + 20, y, 10, i === 1 ? "#F5C443" : "#C9D1DC", 900);
      rrect(ctx, cx + 30, y - 4, 8, 8, 2, c);
      rrect(ctx, cx + 42, y - 3, len * 0.92, 6, 3, i === 1 ? "#F5C443" : "#5B6472");
    });
    poly(ctx, [[cx + 140, 46], [cx + 146, 54], [cx + 134, 54]], "#7BD389");
    text(ctx, "0.5G", cx + 128, 23, 9, "#C9D1DC", 700);
    const cam = camOf(p);
    const h = withBall(p, cx - 60, cam, "focus");
    sweat(ctx, h.head[0] + 28 * (cam.scale / S), h.head[1] + 10);
  },

  broadcast(p) {
    const { ctx, cx } = p;
    arenaBg(p);
    withBall(p, cx - 30, camOf(p), "focus");
    // 어깨에 메는 방송 카메라
    ctx.save();
    ctx.translate(cx + 112, 74);
    rrect(ctx, -26, -18, 60, 36, 6, "#232A3B");
    rrect(ctx, -44, -12, 22, 24, 4, "#151821");
    ellipse(ctx, -44, 0, 9, 12, "#2E3A55");
    ellipse(ctx, -45, -2, 4, 5, "#7EC8EE");
    rrect(ctx, -10, -28, 30, 10, 3, "#3A4256");
    ellipse(ctx, 26, -10, 3.5, 3.5, "#E8505B");
    rrect(ctx, 2, 18, 8, 30, 2, "#3A4256");
    ctx.restore();
    // 중계 화면 그래픽: LIVE, 채널 표시, 선수 자막
    rrect(ctx, cx - 152, 8, 50, 18, 4, "#E8505B");
    ellipse(ctx, cx - 142, 17, 3.5, 3.5, "#FFFFFF");
    text(ctx, "LIVE", cx - 122, 17, 10, "#FFFFFF", 900);
    rrect(ctx, cx + 82, 8, 70, 18, 4, "rgba(0,0,0,0.55)");
    text(ctx, "전국 생중계", cx + 117, 17, 10, "#FFFFFF", 800);
    rrect(ctx, cx - 152, 118, 120, 22, 3, "#FFFFFF");
    rrect(ctx, cx - 152, 118, 30, 22, 3, p.color);
    text(ctx, String(p.num), cx - 137, 129, 12, "#FFFFFF", 900);
    text(ctx, p.name, cx - 76, 129, 11, "#232A3B", 800);
  },

  derby(p) {
    const { ctx, cx, w } = p;
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(p.color.slice(i, i + 2), 16));
    const away = r > g + 40 && r > b + 40 ? "#2F5DB0" : "#E8505B";
    // 노을 진 우리 도시: 먼 건물과 탑
    band(p, 0, 70, grad(ctx, 0, 70, ["#5B3F8C", "#F29B6B"]));
    for (let x = ((cx - 200) % 40) - 40, i = 0; x < w; x += 40, i++) rrect(ctx, x, 70 - (18 + ((i * 29) % 26)), 32, 60, 2, "#3B2C5C");
    rrect(ctx, cx + 30, 8, 4, 50, 1, "#3B2C5C");
    ellipse(ctx, cx + 32, 26, 9, 5, "#3B2C5C");
    // 관중석: 왼쪽은 우리 팀, 오른쪽은 상대 팀 색
    band(p, 54, 104, "#141C33");
    for (let row = 0; row < 3; row++)
      for (let x = (row % 2) * 7 - 6, i = 0; x < w; x += 14, i++) {
        const c = x < cx ? p.color : away;
        spectator(ctx, x, 64 + row * 14, 5.4, i % 3 ? c : "#F4F4F4", -0.3 + row * 0.1, i + row);
      }
    band(p, 104, 108, "#2A3558");
    band(p, 108, SCENE_H, grad(ctx, 108, SCENE_H, ["#C99158", "#AF7840"]));
    // 머리 위로 둥글게 펼친 응원 머플러
    const h = figure(p, cx - 30, "cheer", "beam");
    for (let i = 0; i < 6; i++) {
      const at = (t: number): Pt => [h.l[0] + (h.r[0] - h.l[0]) * t, h.l[1] - 4 - Math.sin(t * Math.PI) * 26];
      line(ctx, [at(i / 6), at((i + 1) / 6)], i % 2 ? "#F4F4F4" : p.color, 9);
    }
  },

  finalGame(p) {
    const { ctx, cx } = p;
    arenaBg(p);
    glow(ctx, cx + 80, 70, 120, "#FFD66B", 0.4);
    for (const [sx, sy] of scatter(18, 21)) rrect(ctx, cx - 160 + sx * 320, 4 + sy * 90, 5, 3, 1, sx > 0.5 ? "#F5C443" : "#FFFFFF");
    text(ctx, "FINAL", cx + 80, 18, 18, "#F5C443", 900);
    // 받침대 위 우승 트로피
    rrect(ctx, cx + 56, 108, 48, 38, 4, "#232A3B");
    rrect(ctx, cx + 52, 104, 56, 8, 3, "#3A4256");
    ctx.save();
    ctx.translate(cx + 80, 104);
    rrect(ctx, -14, -10, 28, 10, 2, "#C98F1C");
    poly(ctx, [[-5, -10], [5, -10], [7, -24], [-7, -24]], "#E2A93B");
    ctx.fillStyle = "#F5C443";
    ctx.beginPath();
    ctx.moveTo(-22, -62);
    ctx.lineTo(22, -62);
    ctx.quadraticCurveTo(22, -26, 0, -24);
    ctx.quadraticCurveTo(-22, -26, -22, -62);
    ctx.fill();
    ctx.strokeStyle = "#E2A93B";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(-22, -50, 9, Math.PI * 0.5, Math.PI * 1.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(22, -50, 9, -Math.PI * 0.5, Math.PI * 0.5);
    ctx.stroke();
    rrect(ctx, -12, -58, 5, 26, 2, "#FFF1A8");
    ctx.restore();
    for (const [x, y, r] of [[cx + 50, 40, 6], [cx + 112, 52, 5], [cx + 96, 30, 4]]) sparkle(ctx, x, y, r, "#FFFFFF");
    withBall(p, cx - 50, camOf(p), "focus");
  },

  buzzer(p) {
    const { ctx, cx } = p;
    arenaBg(p, false);
    rrect(ctx, cx - 2, 8, 84, 42, 5, "#0B0F1C");
    rrect(ctx, cx + 2, 12, 76, 34, 3, "#141C33");
    text(ctx, "0.0", cx + 40, 29, 22, "#E8505B", 900);
    hoop(ctx, cx + 128, 92, false);
    ball(ctx, cx + 156, 110, 8);
    const cam = camOf(p);
    figure(p, cx - 40, "rest", "glum", { bow: 0.4, scale: cam.scale, feet: cam.feet, flip: cam.flip });
  },

  draft(p) {
    const { ctx, cx } = p;
    stageBg(p, cx - 30, ["#0E1B3A", "#183064"]);
    text(ctx, "DRAFT", cx + 50, 30, 30, "rgba(255,255,255,0.16)", 900);
    // 단상과 마이크
    poly(ctx, [[cx + 62, 92], [cx + 122, 92], [cx + 116, 146], [cx + 68, 146]], "#232A3B");
    rrect(ctx, cx + 60, 88, 64, 8, 2, "#2F3648");
    ellipse(ctx, cx + 92, 118, 10, 10, "#F5C443");
    line(ctx, [[cx + 84, 88], [cx + 76, 72]], "#1A1D24", 2.5);
    ellipse(ctx, cx + 75, 70, 4, 5, "#5B6472");
    const h = figure(p, cx - 30, "wave", "beam", { outfit: "suit" });
    // 손에 든 모자
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(h.r[0], h.r[1] - 2, 11, Math.PI, 0);
    ctx.fill();
    rrect(ctx, h.r[0] - 11, h.r[1] - 3, 30, 5, 2.5, shade(p.color, -0.3));
    ellipse(ctx, h.r[0], h.r[1] - 13, 2.2, 2.2, shade(p.color, -0.3));
    for (const [x, y, r] of [[cx - 90, 24, 6], [cx + 140, 60, 5]]) sparkle(ctx, x, y, r, "#FFE58A");
  },

  undrafted(p) {
    const { ctx, cx } = p;
    stageBg(p, cx - 30, ["#0B1226", "#121C38"]);
    text(ctx, "DRAFT", cx + 50, 30, 30, "rgba(255,255,255,0.08)", 900);
    // 빈 의자들
    for (const x of [cx + 50, cx + 90, cx + 130]) {
      rrect(ctx, x - 12, 100, 24, 26, 3, "#2F3648");
      rrect(ctx, x - 14, 122, 28, 6, 2, "#3A4256");
      rrect(ctx, x - 12, 128, 3, 18, 1, "#2F3648");
      rrect(ctx, x + 9, 128, 3, 18, 1, "#2F3648");
    }
    figure(p, cx - 40, "rest", "glum", { outfit: "suit", bow: 0.35 });
  },

  path(p) {
    const { ctx, cx } = p;
    skyBg(p, ["#9ED3F2", "#E3F3FB"], ["#7BC07A", "#5FA85E"], "#B6C6D6");
    // 갈라지는 길
    poly(ctx, [[cx - 20, SCENE_H], [cx + 40, SCENE_H], [cx + 40, 112], [cx + 30, 112]], "#D9C39A");
    poly(ctx, [[cx + 34, 120], [cx + 46, 112], [cx + 160, 112], [cx + 160, 124]], "#D9C39A");
    poly(ctx, [[cx + 30, 120], [cx + 36, 112], [cx - 160, 112], [cx - 160, 124]], "#D9C39A");
    // 표지판
    rrect(ctx, cx + 92, 40, 5, 76, 1, "#8A5A2E");
    poly(ctx, [[cx + 98, 42], [cx + 140, 42], [cx + 152, 52], [cx + 140, 62], [cx + 98, 62]], "#2F5DB0");
    poly(ctx, [[cx + 91, 68], [cx + 50, 68], [cx + 38, 78], [cx + 50, 88], [cx + 91, 88]], "#C8372D");
    text(ctx, "?", cx + 122, 52, 14, "#FFFFFF", 900);
    text(ctx, "?", cx + 68, 78, 14, "#FFFFFF", 900);
    figure(p, cx - 60, "think", "focus");
  },

  military(p) {
    const { ctx, cx, w } = p;
    skyBg(p, ["#A9D3EE", "#E2F0F8"], ["#8A8F5E", "#757A4C"], "#AEB79A");
    // 막사와 깃대
    rrect(ctx, cx + 20, 56, 130, 56, 3, "#B7A57C");
    for (let x = cx + 30; x < cx + 140; x += 24) rrect(ctx, x, 68, 14, 12, 1, "#5B6472");
    poly(ctx, [[cx + 14, 58], [cx + 85, 36], [cx + 156, 58]], "#7A6A4C");
    rrect(ctx, cx - 130, 14, 3, 100, 1, "#9AA3AE");
    rrect(ctx, cx - 127, 16, 34, 22, 1, "#56653B");
    sparkle(ctx, cx - 110, 27, 7, "#F5C443");
    // 모래주머니
    for (let x = ((cx - 20) % 30) - 30, i = 0; x < w; x += 30, i++) if (Math.abs(x - cx + 40) > 60) ellipse(ctx, x, 140, 16, 8, i % 2 ? "#B7A57C" : "#A8966E");
    figure(p, cx - 40, "salute", "focus", { outfit: "tee", color: "#56653B" });
  },

  national(p) {
    const { ctx, cx } = p;
    arenaBg(p);
    // 깃대(국기는 그림 위에 따로 올려요)
    rrect(ctx, cx + 64, 8, 3, 104, 1, "#C9D1DC");
    ellipse(ctx, cx + 65, 8, 4, 4, "#F5C443");
    for (const [sx, sy] of scatter(16, 9)) {
      const c = ["#F5C443", "#E8505B", "#4FB3E8", "#7BD389"][Math.floor(sx * 4)];
      rrect(ctx, cx - 160 + sx * 320, 6 + sy * 80, 5, 3, 1, c);
    }
    const cam = camOf(p);
    figure(p, cx - 40, "cheer", "beam", { color: NATIONAL_JERSEY, scale: cam.scale, feet: cam.feet, flip: cam.flip });
  },

  retire(p) {
    const { ctx, cx } = p;
    band(p, 0, 112, grad(ctx, 0, 112, ["#F6A869", "#F9D49B"]));
    ellipse(ctx, cx + 120, 104, 34, 34, "#FFE6B0");
    band(p, 104, 112, "#C77D52");
    band(p, 112, SCENE_H, grad(ctx, 112, SCENE_H, ["#B8703F", "#9C5B31"]));
    // 액자에 걸린 내 유니폼과 등번호
    frameOnWall(ctx, cx + 60, 52, 74, 70, "#FFF6EC");
    poly(ctx, [[cx + 38, 26], [cx + 50, 24], [cx + 60, 32], [cx + 70, 24], [cx + 82, 26], [cx + 80, 78], [cx + 40, 78]], p.color);
    text(ctx, String(p.num), cx + 60, 52, 18, shade(p.color, 0.8), 900);
    figure(p, cx - 50, "wave", "moved", { outfit: "suit" });
  },
};

/** 아이 둘(유소년 캠프): 생김새는 정해져 있어요. */
const KIDS: Look[] = [
  { kind: "asian", skin: "#F1CFA4", hair: "#2A1A10", style: "buzz", beard: "none", eyes: "#2A1A10" },
  { kind: "black", skin: "#8D5A3B", hair: "#111111", style: "afro", beard: "none", eyes: "#2A1A10" },
];
/** 언쟁하는 팀 동료 */
const MATE: Look = { kind: "white", skin: "#F2D3BC", hair: "#7A4A22", style: "swept", beard: "stubble", eyes: "#3B6EA5" };
const NATIONAL_JERSEY = "#C8372D";

/** 진료실: 십자 표시, 엑스레이(무릎 뼈), 침대. growth면 성장판 자리에 줄을 긋고, 표시 동그라미 색은 mark예요. */
function clinicRoom(p: Paint, mark: string, growth: boolean): void {
  const { ctx, cx } = p;
  wallBg(p, ["#E3F4F1", "#CDE9E4"], ["#B9D4D0", "#A5C4C0"]);
  rrect(ctx, cx - 150, 18, 30, 30, 4, "#FFFFFF");
  rrect(ctx, cx - 139, 23, 8, 20, 1, "#E8505B");
  rrect(ctx, cx - 145, 29, 20, 8, 1, "#E8505B");
  rrect(ctx, cx + 30, 14, 96, 74, 4, "#C9D1DC");
  rrect(ctx, cx + 34, 18, 88, 66, 2, "#1A2238");
  rrect(ctx, cx + 70, 22, 16, 26, 6, "#E7EBF0");
  ellipse(ctx, cx + 78, 50, 13, 6, "#E7EBF0");
  rrect(ctx, cx + 71, 56, 14, 24, 5, "#E7EBF0");
  if (growth) for (const y of [42, 62]) rrect(ctx, cx + 68, y, 20, 2, 1, "#1A2238");
  ctx.strokeStyle = mark;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx + 78, 52, 18, 0, Math.PI * 2);
  ctx.stroke();
  rrect(ctx, cx + 30, 112, 110, 16, 4, "#FFFFFF");
  rrect(ctx, cx + 30, 126, 110, 6, 2, "#9AA3AE");
  rrect(ctx, cx + 34, 130, 5, 18, 1, "#9AA3AE");
  rrect(ctx, cx + 131, 130, 5, 18, 1, "#9AA3AE");
}

/** 사무실: 창밖 도시와 벽. dim이면 저녁처럼 어두워요. */
function office(p: Paint, dim = false): void {
  const { ctx, cx } = p;
  wallBg(p, dim ? ["#B9C2CF", "#A9B3C2"] : ["#E6EBF2", "#D5DDE8"], ["#8A94A3", "#7A8494"]);
  rrect(ctx, cx - 160, 12, 110, 80, 3, "#8A94A3");
  rrect(ctx, cx - 156, 16, 102, 72, 2, dim ? "#F2A86A" : "#A9DBF7");
  for (const [x, h] of [[-152, 30], [-136, 46], [-118, 24], [-100, 52], [-80, 36]]) rrect(ctx, cx + x, 88 - h, 14, h, 1, dim ? "#5A4A5E" : "#7F98B5");
}

/** 거실: 따뜻한 벽, 창, 액자, 소파 */
function living(p: Paint): void {
  const { ctx, cx } = p;
  wallBg(p, ["#F8E7D2", "#F0D8BC"], ["#B98A5E", "#A77A50"]);
  rrect(ctx, cx - 150, 14, 70, 56, 3, "#FFFFFF");
  rrect(ctx, cx - 146, 18, 62, 48, 2, "#A9DBF7");
  rrect(ctx, cx - 156, 12, 12, 64, 3, "#E8A0A0");
  rrect(ctx, cx - 92, 12, 12, 64, 3, "#E8A0A0");
  frameOnWall(ctx, cx + 70, 30, 38, 30, "#CDEBFA");
  frameOnWall(ctx, cx + 116, 40, 28, 34, "#FDE7B0");
  rrect(ctx, cx + 30, 86, 120, 30, 10, "#7A9CC6");
  rrect(ctx, cx + 24, 100, 132, 26, 10, "#6A8CB6");
  rrect(ctx, cx + 30, 124, 8, 14, 2, "#5E3E22");
  rrect(ctx, cx + 142, 124, 8, 14, 2, "#5E3E22");
}

/** 화면을 살짝 기울여 찍는 장면 */
const TILTED = new Set<SceneKey>(["crowd", "bigmatch", "rivalGame", "standings", "finalGame", "buzzer"]);

export function drawScene(p: Paint, scene: SceneKey): void {
  const tilt = TILTED.has(scene) ? camOf(p).tilt * Math.min(1, 360 / p.w) : 0;
  if (!tilt) {
    scenes[scene](p);
    return;
  }
  // 돌린 만큼 모서리가 비지 않게 조금 키워서 그려요. 넓은 화면은 덜 기울여요.
  const { ctx, cx } = p;
  ctx.save();
  ctx.translate(cx, SCENE_H / 2);
  ctx.rotate(tilt);
  ctx.scale(1.08, 1.08);
  ctx.translate(-cx, -SCENE_H / 2);
  scenes[scene](p);
  ctx.restore();
}
