/*
 * 결정 시트 위에 띄우는 장면 그림. 장면(SceneKey)마다 배경, 소품, 내 캐릭터의 자세·표정·옷을 정해 캔버스 한 장에 그려요.
 * 높이는 SCENE_H로 고정이고 너비는 시트 너비를 그대로 써요. 가운데에서 좌우 160px 안에 주인공과 소품을 두고, 나머지는 배경만 이어져요.
 * 배경도 그림이라 밝은·어두운 화면 테마와 상관없이 같은 색이에요.
 */
import type { Look, SceneKey } from "@/game";
import { shade, type Mood } from "@/shared/ui/sprite/Sprite";
import { basketball as ball } from "@/shared/ui/sprite/athleteArt";
import { hardwood } from "@/shared/ui/sprite/courtArt";
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

export function text(ctx: Ctx, s: string, x: number, y: number, size: number, color: string, weight = 800): void {
  ctx.font = `${weight} ${size}px system-ui, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(s, x, y);
}

/** 가장자리가 흐려지는 둥근 빛 */
export function glow(ctx: Ctx, x: number, y: number, r: number, color: string, alpha: number): void {
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
export function scatter(n: number, seed: number): Pt[] {
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
  mic: [[42, 152], [99, 111]],
  write: [[46, 146], [101, 141]],
  unwell: [[50, 148], [69, 121]],
  bag: [[42, 152], [128, 136]],
  dribble: [[42, 152], [122, 146]],
  dunk: [[30, 84], [128, 48]],
  dunk2: [[82, 54], [118, 46]],
  dunkR: [[30, 120], [124, 46]],
  chest: [[62, 122], [98, 122]],
  /** 악수: 오른손을 허리 높이에서 옆으로 내밀어요. */
  shake: [[42, 152], [128, 146]],
} satisfies Record<string, [Pt, Pt]>;
type HandKey = keyof typeof HANDS;

export interface FigureOpt extends PosedExtra {
  scale?: number;
  /** 발끝 높이. 캔버스보다 아래면 다리가 잘린 클로즈업이 돼요. */
  feet?: number;
  flip?: boolean;
  look?: Look;
  color?: string;
}

/** 캐릭터를 x(가운데)에 세우고, 캔버스 위 두 손 위치를 돌려줘요. */
function figure(p: Paint, x: number, hands: HandKey, mood: Mood, o: FigureOpt = {}): { l: Pt; r: Pt; head: Pt } {
  return figureAt(p, x, HANDS[hands], mood, o);
}

/** figure와 같되 두 손 위치(캐릭터 판 기준)를 바로 받아요. 손이 매 순간 움직이는 장면에서 써요. */
function figureAt(p: Paint, x: number, [l, r]: readonly [Pt, Pt], mood: Mood, o: FigureOpt = {}): { l: Pt; r: Pt; head: Pt } {
  const { ctx } = p;
  const s = o.scale ?? S;
  const top = (o.feet ?? FEET) - 231 * s;
  const dir = o.flip ? -1 : 1;
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
export function sweat(ctx: Ctx, x: number, y: number): void {
  poly(ctx, [[x, y - 7], [x + 4, y + 1], [x - 4, y + 1]], "#7EC8EE");
  ellipse(ctx, x, y + 2, 4, 4, "#7EC8EE");
  ellipse(ctx, x - 1.2, y + 1, 1.3, 1.3, "#FFFFFF");
}

/** 내 머리 꼭대기 근처(캐릭터 판 기준 머리 위) */
/** 캐릭터 판의 점(bx, by)이 캔버스에서 오는 자리. 캐릭터가 x에 서 있을 때예요. */
const bp = (x: number, bx: number, by: number): Pt => [x + (bx - 80) * S, FEET - 231 * S + by * S];
const headTop = (x: number, s = S): Pt => [x, FEET - 231 * s + 18 * s];

/* ---------- 소품 ---------- */

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

export function speech(ctx: Ctx, x: number, y: number, w: number, h: number, fill: string, tailRight = false): void {
  rrect(ctx, x - w / 2, y - h / 2, w, h, h / 2, fill);
  const tx = tailRight ? x + w / 4 : x - w / 4;
  poly(ctx, [[tx - 5, y + h / 2 - 2], [tx + 5, y + h / 2 - 2], [tx + (tailRight ? 8 : -8), y + h / 2 + 8]], fill);
}

export function flash(ctx: Ctx, x: number, y: number, r: number): void {
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

/** 손잡이 달린 금빛 우승컵. (x, y)가 받침 바닥 가운데이고, 높이는 62에 k를 곱한 만큼이에요. */
function cup(ctx: Ctx, x: number, y: number, k = 1): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);
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
    rrect(ctx, x - 2, 12, 74, 45, 1, night ? "#252d43" : "#a3afbb");
    rrect(ctx, x, 14, 70, 40, 1, night ? "#121A33" : "#e8f2f4");
    if (!night) poly(ctx, [[x, 45], [x + 70, 24], [x + 70, 54], [x, 54]], "#c9dadd");
    rrect(ctx, x, 31, 70, 2, 0, night ? "#343e54" : "#a8bbc5");
    rrect(ctx, x + 34, 14, 2, 40, 1, night ? "#3A4566" : "#C7D2E0");
    if (night) for (const [sx, sy] of scatter(3, x + 7)) sparkle(ctx, x + 6 + sx * 58, 18 + sy * 30, 1.8, "#FFF4C2");
  }
  band(p, 76, 101, night ? "#293449" : "#768d98");
  for (let x = (p.cx % 35) - 35; x < w; x += 35) {
    rrect(ctx, x + 1, 78, 32, 22, 2, night ? "#334158" : "#829da5");
  }
  band(p, 100, 104, night ? "#1E2640" : "#546873");
  hardwood(ctx, w, 104, SCENE_H, night);
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
  band(p, floorY - 4, floorY, shade(wall[1], -0.17));
  const reach = p.cx - 45;
  poly(p.ctx, [[reach - 130, 0], [reach - 56, 0], [reach + 30, floorY], [reach - 73, floorY]], "rgba(255,248,221,0.09)");
  for (let x = (p.cx % 64) - 128; x < p.w + 64; x += 64) {
    line(p.ctx, [[x, floorY + 1], [x + (x - p.cx) * 0.35, SCENE_H]], "rgba(30,35,48,0.11)", 0.8);
  }
}

/** 바깥: 하늘, 먼 건물, 땅 */
function skyBg(p: Paint, sky: [string, string], ground: [string, string], city = "#9FB3C8"): void {
  const { ctx, w } = p;
  band(p, 0, 112, grad(ctx, 0, 112, sky));
  for (let x = ((p.cx - 200) % 46) - 46, i = 0; x < w; x += 46, i++) {
    const h = 26 + ((i * 37) % 30);
    rrect(ctx, x, 112 - h, 38, h + 2, 2, city);
    rrect(ctx, x + 5, 108 - h, 15, 5, 0, shade(city, -0.09));
    rrect(ctx, x + 30, 113 - h, 8, h - 1, 0, shade(city, -0.12));
    for (let y = 119 - h; y < 105; y += 8) {
      for (let col = 0; col < 3; col++) rrect(ctx, x + 4 + col * 8, y, 5, 2, 0, shade(city, 0.23));
    }
  }
  band(p, 110, SCENE_H, grad(ctx, 110, SCENE_H, ground));
}

/**
 * 경기장 배경. 결정마다 정해지는 seed로 앵글 4가지(정면 관중석, 코트 옆 낮은 앵글, 엔드라인에서 본 코트, 위층 관중석)와
 * 조명 색 3가지(따뜻한 빛, 차가운 빛, 우리 팀 색), 관중석 카메라 플래시를 섞어 그려요. 바닥 높이는 어느 앵글이든 같아서 소품 자리는 그대로예요.
 * crowd를 주면 관중 옷 색을 자리(x)마다 정해요. bright가 아니면 조명을 끄고 어둑하게 그려요.
 */
export function arenaBg(p: Paint, bright = true, crowd?: (x: number) => string[]): void {
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

  const courtside = (edge: number) => {
    const haze = ctx.createLinearGradient(0, 22, 0, edge);
    haze.addColorStop(0, "rgba(21,34,60,0.54)");
    haze.addColorStop(0.66, "rgba(32,46,65,0.36)");
    haze.addColorStop(1, "rgba(37,48,63,0.18)");
    band(p, 18, edge, haze);
    band(p, edge - 2, edge, "#586174");
    hardwood(ctx, w, edge, SCENE_H);
  };

  if (angle === 0) {
    // 정면 관중석: 고른 네 줄
    for (let row = 0; row < 4; row++)
      for (let x = (row % 2) * 7 - 6, i = 0; x < w; x += 14, i++) spectator(ctx, x, 46 + row * 15, 5.4, fan(x, i, row), -0.35 + row * 0.08, i + row);
    courtside(104);
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
    courtside(108);
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
    courtside(82);
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
    courtside(104);
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

/**
 * 덩크 콘테스트의 덩크 세 가지. 손 자세, 몸 기울기, 골대가 놓이는 쪽(side: 1이면 오른쪽), 공에서 림까지의 거리를 정해요.
 * - one: 오른손 하나로 림에 내리꽂아요. 왼팔은 옆으로 뻗어 균형을 잡아요.
 * - two: 두 손으로 머리 위에 든 공을 꽂아요.
 * - reverse: 골대 반대쪽으로 몸을 크게 젖힌 채 오른팔을 뒤로 넘겨 꽂아요. 몸을 따라 도는 회전 화살표가 붙어요.
 */
const DUNKS = [
  { kind: "one", hands: "dunk", lean: 0.16, side: 1, rim: [6, 9], mood: "focus" },
  { kind: "two", hands: "dunk2", lean: 0.32, side: 1, rim: [8, 14], mood: "focus" },
  { kind: "reverse", hands: "dunkR", lean: -0.3, side: 1, rim: [8, 10], mood: "beam" },
] as const satisfies { kind: string; hands: HandKey; lean: number; side: 1 | -1; rim: Pt; mood: Mood }[];

function drawDunk(p: Paint, d: (typeof DUNKS)[number]): void {
  const { ctx, cx } = p;
  arenaBg(p);
  const { side } = d;
  const x = d.kind === "reverse" ? cx - 20 : side > 0 ? cx - 34 : cx + 30;
  const feet = 124;
  const s = 0.5;
  // 뛰어오른 선수가 바닥에 남긴 그림자
  ellipse(ctx, x + 6 * side, 146, 22, 4, "rgba(0,0,0,0.35)");
  // 손 위치를 몸 기울기만큼 돌려서 공 자리를 구하고, 림은 공 바로 아래 앞에 둬요.
  const top = feet - 231 * s;
  const rot = ([qx, qy]: Pt): Pt => {
    const [dx, dy] = [qx - x, qy - feet];
    return [x + dx * Math.cos(d.lean) - dy * Math.sin(d.lean), feet + dx * Math.sin(d.lean) + dy * Math.cos(d.lean)];
  };
  const [hl, hr] = HANDS[d.hands].map(([bx, by]) => rot([x + (bx - 80) * s, top + by * s]));
  const ballAt: Pt = d.kind === "two" ? [(hl[0] + hr[0]) / 2 + 3, (hl[1] + hr[1]) / 2 - 9] : [hr[0] + 4, hr[1] - 1];
  const rim: Pt = [ballAt[0] + d.rim[0], ballAt[1] + d.rim[1]];
  // 기둥과 팔은 골대 바깥쪽에, 백보드는 위로 조금 잘려요.
  const px = rim[0] + side * 37;
  rrect(ctx, px - 3, rim[1] - 30, 6, FEET - rim[1] + 30, 2, "#4A5361");
  rrect(ctx, px - 6, FEET - 40, 12, 40, 4, "#2F5DB0");
  poly(ctx, [[rim[0] + side * 10, rim[1] - 28], [px, rim[1] - 26], [px, rim[1] - 19], [rim[0] + side * 10, rim[1] - 17]], "#4A5361");
  ctx.save();
  ctx.translate(rim[0], rim[1]);
  ctx.scale(0.8, 0.8);
  hoop(ctx, 0, 0, false);
  ctx.restore();
  // 뛰어오른 궤적: 골대 반대쪽 아래로 남는 바람 선
  for (const [sx, sy] of [[-20, -74], [-26, -52], [-20, -30]] as const) line(ctx, [[x + sx * side, feet + sy], [x + (sx - 20) * side, feet + sy + 18]], "rgba(255,255,255,0.75)", 2.5);
  ctx.save();
  ctx.translate(x, feet);
  ctx.rotate(d.lean);
  ctx.translate(-x, -feet);
  figure(p, x, d.hands, d.mood, { scale: s, feet });
  ctx.restore();
  ball(ctx, ballAt[0], ballAt[1], 7.5);
  // 리버스: 젖힌 몸 왼쪽을 따라 위로 도는 회전 화살표
  if (d.kind === "reverse") {
    const [bx, by] = rot([x, top + 120 * s]);
    const r = 46;
    const [a0, a1] = [0.8 * Math.PI, 1.38 * Math.PI];
    ctx.strokeStyle = "#FFE58A";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(bx, by, r, a0, a1);
    ctx.stroke();
    const [ex, ey] = [bx + Math.cos(a1) * r, by + Math.sin(a1) * r];
    poly(ctx, [[ex + 7, ey - 2], [ex - 3, ey - 6], [ex - 2, ey + 5]], "#FFE58A");
  }
  // 림에 꽂히는 충격선
  for (const a of [-2.4, -1.9, -0.5, -0.1]) line(ctx, [[rim[0] + Math.cos(a) * 20, rim[1] + Math.sin(a) * 14], [rim[0] + Math.cos(a) * 28, rim[1] + Math.sin(a) * 20]], "#FFE58A", 2.5);
  // 심사위원 점수판: 골대 반대쪽 바닥
  for (const [i, dx] of (side > 0 ? [-150, -122, -94] : [70, 98, 126]).entries()) {
    const up = i === 1 ? 4 : 0;
    rrect(ctx, cx + dx, 112 - up, 24, 18, 3, "#FFFFFF");
    text(ctx, "10", cx + dx + 12, 121 - up, 11, "#E8505B", 900);
    rrect(ctx, cx + dx + 10, 130 - up, 4, 16, 1, "#C9D1DC");
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

/** 무대: 어두운 막과 스포트라이트 */
function stageBg(p: Paint, spot: number, top: [string, string] = ["#2B1846", "#3E2163"]): void {
  const { ctx, w } = p;
  band(p, 0, SCENE_H, grad(ctx, 0, SCENE_H, top));
  for (let x = (p.cx % 32) - 32; x < w; x += 32) {
    poly(ctx, [[x, 0], [x + 10, 0], [x + 16, 112], [x - 2, 112]], shade(top[0], -0.33));
    poly(ctx, [[x + 13, 0], [x + 16, 0], [x + 24, 112], [x + 18, 112]], shade(top[1], 0.08));
  }
  band(p, 3, 6, "#292a36");
  hardwood(ctx, w, 112, SCENE_H, true);
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
    const { ctx, cx, w } = p;
    wallBg(p, ["#f2dfbc", "#ceb897"], ["#aa8363", "#80634f"]);
    // 오후 햇빛이 왼쪽 창에서 칠판과 책상 위로 비쳐요.
    const left = cx - 104;
    const right = cx + 158;
    rrect(ctx, left, 10, right - left, 68, 2, "#725642");
    rrect(ctx, left + 3, 13, right - left - 6, 59, 1, "#314d4d");
    poly(ctx, [[left + 3, 13], [left + 113, 13], [left + 65, 72], [left + 3, 72]], "#425e59");
    rrect(ctx, left - 2, 73, right - left + 4, 4, 1, "#b49670");
    rrect(ctx, right - 32, 69, 12, 3, 1, "#e9e5cb");
    text(ctx, "D−1", right - 42, 35, 17, "#f0ead2");
    line(ctx, [[right - 64, 46], [right - 24, 44]], "#ddc28d", 1.2);
    for (let x = left - 74; x > -76; x -= 74) {
      rrect(ctx, x, 13, 61, 54, 1, "#a69376");
      rrect(ctx, x + 3, 16, 55, 47, 0, "#dce6de");
      poly(ctx, [[x + 3, 54], [x + 58, 33], [x + 58, 63], [x + 3, 63]], "#b8ccc9");
      rrect(ctx, x + 29, 16, 3, 47, 0, "#f0e1c3");
    }
    const h = figure(p, cx - 34, "write", "nervous", { outfit: "tee", bow: 0.23, tilt: -0.06, scale: 0.88, feet: 183 });
    // 앞쪽 책상이 하반신을 가려 상반신과 펼쳐 놓은 문제집이 함께 보여요.
    band(p, 109, SCENE_H, "#846047");
    poly(ctx, [[0, 123], [w, 103], [w, 127], [0, 150]], "#c4996c");
    line(ctx, [[0, 147], [w, 125]], "#e2b57e", 2);
    const book = cx - 7;
    poly(ctx, [[book - 54, 111], [book - 16, 106], [book, 110], [book + 32, 101], [book + 49, 119], [book + 4, 132], [book - 48, 127]], "#6a5548");
    poly(ctx, [[book - 54, 109], [book - 18, 104], [book, 108], [book + 4, 129], [book - 46, 124]], "#f6eacb");
    poly(ctx, [[book, 108], [book + 32, 99], [book + 48, 117], [book + 4, 129]], "#fff4d9");
    for (let i = 0; i < 4; i++) {
      line(ctx, [[book - 44 + i, 111 + i * 3], [book - 13 + i, 109 + i * 3]], "#b3a78e", 0.9);
      line(ctx, [[book + 8 + i, 109 + i * 3], [book + 29 + i, 104 + i * 3]], "#a49b88", 0.9);
    }
    line(ctx, [[h.r[0] - 4, h.r[1] - 5], [h.r[0] + 7, h.r[1] + 8]], "#9a5636", 2.5);
    line(ctx, [[h.r[0] + 7, h.r[1] + 8], [h.r[0] + 9, h.r[1] + 10]], "#4a4140", 1.3);
    for (const [i, cover] of ["#486077", "#95664c", "#596e60"].entries()) {
      const x = cx + 73 - i * 2;
      const y = 107 - i * 6;
      rrect(ctx, x, y, 41, 6, 1, cover);
      rrect(ctx, x + 5, y + 1, 35, 3, 0, "#e1d5b7");
    }
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

  dunk(p) {
    // 덩크는 결정마다 원핸드·투핸드·리버스 가운데 하나예요.
    drawDunk(p, DUNKS[Math.floor(p.seed / 7) % DUNKS.length]);
  },

  studio(p) {
    const { ctx, cx, w } = p;
    wallBg(p, ["#262a42", "#49445a"], ["#594959", "#302e40"]);
    // 세트 뒤 흡음판과 조명 레일.
    for (let x = (cx % 52) - 52; x < w; x += 52) {
      rrect(ctx, x, 35, 47, 67, 1, "#363649");
      rrect(ctx, x + 2, 36, 2, 65, 0, "#545064");
    }
    band(p, 11, 14, "#191d2e");
    for (const x of [cx - 94, cx + 45]) {
      poly(ctx, [[x, 13], [x + 17, 13], [x + 45, 98], [x - 41, 111]], "rgba(255,222,175,0.10)");
      rrect(ctx, x - 3, 6, 24, 8, 2, "#1e2332");
      rrect(ctx, x, 12, 18, 3, 1, "#ffdfb4");
    }
    rrect(ctx, cx - 147, 34, 48, 16, 2, "#6a3443");
    text(ctx, "ON AIR", cx - 123, 42, 9, "#ffe2d1");
    const h = figure(p, cx - 26, "mic", "smile", { outfit: "tee", scale: 0.9, feet: 191 });
    const [mx, my] = h.r;
    line(ctx, [[mx + 2, my + 3], [mx - 2, my - 9]], "#262735", 4);
    ellipse(ctx, mx - 3, my - 12, 4.6, 5.6, "#4d5160");
    line(ctx, [[mx - 6, my - 12], [mx, my - 14]], "#b1b0aa", 1.2);
    // 전경의 방송 카메라. 뷰파인더와 렌즈 후드가 출연자를 향해요.
    const cam = cx + 91;
    for (const offset of [-26, 4, 32]) {
      line(ctx, [[cam, 93], [cam + offset, 153]], "#191f2c", 5);
      line(ctx, [[cam, 98], [cam + offset * 0.8, 140]], "#5e6270", 1.2);
    }
    rrect(ctx, cam - 10, 86, 21, 13, 3, "#202432");
    rrect(ctx, cam - 21, 55, 51, 33, 3, "#202737");
    poly(ctx, [[cam - 20, 60], [cam - 29, 61], [cam - 40, 55], [cam - 40, 84], [cam - 29, 77], [cam - 20, 79]], "#141c2a");
    rrect(ctx, cam - 40, 59, 3, 20, 1, "#6596ab");
    rrect(ctx, cam - 9, 49, 21, 7, 2, "#1b2130");
    rrect(ctx, cam - 6, 52, 15, 3, 1, "#73717e");
    rrect(ctx, cam + 1, 63, 21, 14, 1, "#475365");
    rrect(ctx, cam + 4, 65, 15, 9, 1, "#98aaac");
    ellipse(ctx, cam + 23, 59, 2, 2, "#f47461");
  },

  press(p) {
    const { ctx, cx, w } = p;
    // 후원사 로고 벽
    wallBg(p, ["#3d495e", "#657080"], ["#414856", "#343945"]);
    const banner = shade(p.color, -0.45);
    for (let y = 8, row = 0; y < 101; y += 21, row++) {
      for (let x = (cx % 56) - 56; x < w; x += 56) {
        const light = (Math.round((x - cx) / 56) + row) % 2 === 0;
        rrect(ctx, x, y, 55, 20, 0, light ? "#cdd3d3" : banner);
        const mark = light ? "#85919b" : shade(banner, 0.34);
        poly(ctx, [[x + 15,y + 13],[x + 23,y + 6],[x + 29,y + 6],[x + 21,y + 13]], mark);
        rrect(ctx, x + 29, y + 10, 10, 2, 0, mark);
      }
    }
    figure(p, cx - 6, "rest", "nervous", { outfit: "tee", scale: 0.83, feet: 180 });
    desk(p, cx - 150, cx + 150, 112, "#232A3B", "#2F3648");
    // 마이크 다발
    for (const [dx, c] of [[-54, "#a85858"], [-28, "#496e8e"], [28, "#b99852"], [53, "#507563"]] as const) {
      line(ctx, [[cx + dx * 0.4, 112], [cx + dx, 92]], "#1A1D24", 3);
      rrect(ctx, cx + dx - 5, 84, 10, 12, 4, "#1A1D24");
      rrect(ctx, cx + dx - 6, 94, 12, 6, 2, c);
    }
  },

  phone(p) {
    const { ctx, cx, w } = p;
    band(p, 0, SCENE_H, grad(ctx, 0, SCENE_H, ["#202a44", "#555165"]));
    // 유리 너머의 번화가. 불 켜진 층과 가로등이 낮은 채도로 멀어져요.
    const lights = ["#dcac86", "#8eb9bd", "#cd898b"];
    for (let x = (cx % 28) - 28, i = 0; x < w; x += 28, i++) {
      const top = 41 + (i * 29) % 45;
      rrect(ctx, x, top, 26, 116 - top, 0, i % 2 ? "#303748" : "#363b50");
      for (let row = 0; row < 3; row++) {
        if ((i + row) % 3 !== 1) rrect(ctx, x + 5 + (row % 2) * 7, top + 5 + row * 7, 5, 2, 0, lights[(i + row) % 3]);
      }
    }
    band(p, 108, SCENE_H, "#353847");
    for (const x of [cx - 108, cx + 129]) {
      glow(ctx, x, 98, 19, "#edb58d", 0.25);
      rrect(ctx, x, 96, 6, 2, 1, "#f2c89e");
      rrect(ctx, x - 2, 109, 10, 1, 0, "#a78679");
    }
    // 선수가 손에 든 전화와 화면에 올라온 글을 한 컷에 보여줘요.
    const h = figure(p, cx - 40, "hold", "nervous", { outfit: "tee", scale: 0.91, feet: 187, bow: 0.23 });
    const x = (h.l[0] + h.r[0]) / 2;
    rrect(ctx, x - 8, h.r[1] - 15, 16, 21, 3, "#829399");
    rrect(ctx, x - 5, h.r[1] - 12, 3, 4, 1, "#323a4a");
    ctx.save();
    ctx.translate(cx + 68, 73);
    ctx.rotate(0.07);
    rrect(ctx, -34, -62, 68, 125, 8, "#232837");
    rrect(ctx, -31, -59, 62, 118, 6, "#eae7de");
    rrect(ctx, -10, -56, 20, 3, 2, "#464a57");
    for (let i = 0; i < 3; i++) {
      const y = -37 + i * 30;
      ellipse(ctx, -20, y, 4, 4, ["#a76f64", "#658892", "#b2986b"][i]);
      rrect(ctx, -11, y - 3, 30, 3, 1, "#626979");
      rrect(ctx, -11, y + 4, 21, 2, 1, "#b2b1ae");
      rrect(ctx, -24, y + 13, 46, 1, 0, "#cccbc5");
    }
    rrect(ctx, -8, 52, 16, 2, 1, "#949795");
    ctx.restore();
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
    skyBg(p, ["#e4b6b0", "#f5d9c0"], ["#c59883", "#a88177"], "#b49b9d");
    for (const [sx, sy] of scatter(6, 5)) {
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
    skyBg(p, ["#546176", "#98a7b2"], ["#637383", "#505f71"], "#70808f");
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
    for (let x = (cx % 62) - 62; x < p.w; x += 62) {
      poly(ctx, [[x, 0], [x + 18, 0], [x + 8, 85], [x + 14, 112], [x, 112]], "#e9d6bd");
    }
    band(p, 111, SCENE_H, "#d1b99f");
    poly(ctx, [[cx - 43, 111], [cx + 7, 111], [cx + 44, 150], [cx - 82, 150]], "#f1e8d8");
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
    const { ctx, cx, w } = p;
    wallBg(p, ["#243044", "#515062"], ["#584b50", "#413b44"]);
    const win = cx - 147;
    rrect(ctx, win - 4, 8, 97, 68, 2, "#1b2535");
    rrect(ctx, win, 12, 89, 58, 0, "#354963");
    ellipse(ctx, win + 65, 24, 6, 6, "#e9d9ad");
    ellipse(ctx, win + 68, 22, 5.5, 5.5, "#354963");
    for (let i = 0; i < 8; i++) {
      const top = 44 + (i * 7) % 15;
      rrect(ctx, win + i * 11, top, 11, 70 - top, 0, "#243445");
      if (i % 3 !== 1) rrect(ctx, win + i * 11 + 4, top + 4, 2, 2, 0, "#c7ae82");
    }
    rrect(ctx, win + 42, 12, 3, 58, 0, "#65707b");
    rrect(ctx, win - 6, 70, 101, 4, 1, "#7b7880");
    // 침대 머리판과 옆 탁자. 스탠드 빛이 침구에 닿아요.
    const lamp = cx + 94;
    glow(ctx, lamp, 56, 79, "#efbd82", 0.53);
    rrect(ctx, cx - 98, 78, 155, 39, 4, "#58474b");
    rrect(ctx, cx - 95, 80, 149, 3, 1, "#91716b");
    rrect(ctx, lamp - 27, 91, 59, 39, 2, "#5b4644");
    rrect(ctx, lamp - 29, 89, 63, 4, 1, "#bd9670");
    line(ctx, [[lamp, 61], [lamp, 87]], "#bdae91", 2.6);
    ellipse(ctx, lamp, 87, 10, 2, "#d1bb95");
    poly(ctx, [[lamp - 12, 39], [lamp + 12, 39], [lamp + 21, 61], [lamp - 21, 61]], "#e5bb82");
    poly(ctx, [[lamp - 10, 40], [lamp + 6, 40], [lamp + 10, 60], [lamp - 17, 60]], "#f8daa1");
    ellipse(ctx, lamp, 61, 21, 2, "#ffebc1");
    poly(ctx, [[cx - 119, 115], [cx - 81, 93], [cx - 38, 94], [cx - 62, 115]], "#e6dccc");
    figure(p, cx - 28, "unwell", "glum", { outfit: "tee", scale: 0.88, feet: 183, bow: 0.45, tilt: 0.12 });
    poly(ctx, [[0, 129], [cx - 74, 118], [cx - 48, 107], [cx - 12, 116], [cx + 30, 110], [cx + 81, 138], [Math.min(w, cx + 92), 150], [0, 150]], "#8395a6");
    poly(ctx, [[cx - 75, 119], [cx - 48, 108], [cx - 12, 117], [cx + 29, 111], [cx + 43, 119], [cx - 19, 127]], "#b7c3c7");
    poly(ctx, [[cx - 52, 122], [cx - 20, 127], [cx + 25, 119], [cx - 12, 137]], "#677c91");
    // 탁자 위 디지털 체온계 화면.
    rrect(ctx, lamp - 54, 76, 42, 14, 3, "#c6c4bc");
    rrect(ctx, lamp - 51, 78, 31, 10, 1, "#2c4143");
    text(ctx, "38.5°", lamp - 35, 83, 9, "#ffe7af");
    ellipse(ctx, lamp - 16, 83, 1.5, 1.5, "#a85d54");
  },

  tired(p) {
    const { ctx, cx, w } = p;
    // 원정 경기장 라커룸: 줄지은 사물함과 벤치
    wallBg(p, ["#C9D3DF", "#B7C3D2"], ["#7A8494", "#6A7484"]);
    for (let x = ((cx - 20) % 34) - 34, i = 0; x < w; x += 34, i++) {
      rrect(ctx, x, 10, 32, 98, 2, i % 2 ? "#576c80" : "#495f72");
      poly(ctx, [[x + 2, 12], [x + 30, 12], [x + 30, 29], [x + 2, 44]], "rgba(216,229,228,0.12)");
      rrect(ctx, x + 3, 100, 25, 2, 0, "#374956");
      rrect(ctx, x + 22, 49, 6, 15, 1, "#384757");
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
    // 벤치에 내려놓은 원정 가방과 물병.
    const bag = cx + 49;
    line(ctx, [[bag - 10, 113], [bag - 5, 103], [bag + 8, 103], [bag + 13, 113]], "#394253", 3);
    rrect(ctx, bag - 22, 110, 48, 19, 5, "#394859");
    poly(ctx, [[bag - 19, 113], [bag + 16, 111], [bag + 22, 115], [bag - 17, 117]], "#63778a");
    rrect(ctx, bag + 6, 113, 4, 15, 1, "#243343");
    rrect(ctx, bag + 34, 109, 9, 20, 2, "#adc3c8");
    rrect(ctx, bag + 36, 105, 5, 5, 1, "#465969");
    const [hx, hy] = headTop(x);
    sweat(ctx, hx + 28, hy + 12);
  },

  wellness(p) {
    const { ctx, cx } = p;
    wallBg(p, ["#EAF4E4", "#D8EBD0"], ["#C9B79C", "#B8A486"]);
    rrect(ctx, cx - 135, 16, 72, 52, 2, "#b6bdad");
    rrect(ctx, cx - 132, 19, 66, 46, 0, "#d9e6dc");
    poly(ctx, [[cx - 132, 50], [cx - 66, 31], [cx - 66, 65], [cx - 132, 65]], "#b5cdc2");
    rrect(ctx, cx - 101, 19, 3, 46, 0, "#eee8d8");
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

  pickup(p) {
    const { ctx, cx } = p;
    gymBg(p);
    hoop(ctx, cx + 104, 49);
    figure(p, cx + 31, "cheer", "focus", { look: MATE, color: "#88544e", scale: 0.51, feet: 132 });
    const h = figure(p, cx - 40, "dribble", "focus", { tilt: -0.07 });
    ball(ctx, h.r[0] + 3, h.r[1] + 21, 9);
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
    band(p, 10, 102, grad(ctx, 10, 102, ["#8eb9d1", "#e0e2ce"]));
    band(p, 85, 102, "#8f9da2");
    for (let x = (cx % 53) - 53; x < w; x += 53) rrect(ctx, x, 93, 22, 1.5, 0, "#dcdace");
    ctx.save();
    ctx.translate(cx + 70, 46);
    ctx.rotate(-0.22);
    rrect(ctx, -40, -7, 80, 14, 7, "#FFFFFF");
    poly(ctx, [[-6, 0], [10, 0], [-14, 28], [-22, 28]], "#E7EBF0");
    poly(ctx, [[-6, 0], [10, 0], [-14, -26], [-22, -26]], "#E7EBF0");
    poly(ctx, [[-36, -4], [-28, -4], [-38, -18], [-44, -18]], "#E8505B");
    for (let i = 0; i < 5; i++) ellipse(ctx, 8 + i * 6, -1, 1.6, 1.6, "#4FB3E8");
    ctx.restore();
    for (let x = ((cx - 30) % 90) - 90; x < w; x += 90) {
      rrect(ctx, x, 10, 4, 92, 0, "#7b8b98");
      rrect(ctx, x + 4, 10, 2, 92, 0, "#dae0df");
      poly(ctx, [[x + 7, 10], [x + 23, 10], [x + 87, 67], [x + 87, 83]], "rgba(255,255,255,0.10)");
    }
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
    hardwood(ctx, w, 108, SCENE_H);
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
    cup(ctx, cx + 80, 104);
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
    hardwood(ctx, p.w, 112, SCENE_H);
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
  for (let y = 24; y < 81; y += 7) rrect(ctx, cx + 38, y, 6, 1, 0, "#566f7f");
  poly(ctx, [[cx + 70, 20], [cx + 83, 20], [cx + 81, 38], [cx + 89, 45], [cx + 88, 49], [cx + 82, 52], [cx + 76, 49], [cx + 70, 52], [cx + 65, 48], [cx + 71, 37]], "#c3d9db");
  poly(ctx, [[cx + 66, 54], [cx + 75, 55], [cx + 87, 53], [cx + 86, 59], [cx + 81, 65], [cx + 80, 82], [cx + 72, 82], [cx + 73, 65]], "#c3d9db");
  line(ctx, [[cx + 86, 81], [cx + 88, 65], [cx + 92, 58]], "#839daa", 2);
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
  for (const [x, h] of [[-152, 30], [-136, 46], [-118, 24], [-100, 52], [-80, 36]]) {
    rrect(ctx, cx + x, 88 - h, 14, h, 1, dim ? "#5A4A5E" : "#7F98B5");
    for (let y = 92 - h; y < 85; y += 7) rrect(ctx, cx + x + 3, y, 7, 2, 0, dim ? "#ab907e" : "#aebec7");
  }
  for (let i = 0; i < 4; i++) rrect(ctx, cx - 156, 16 + i * 5, 102, 2, 0, dim ? "#a88e80" : "#b5c1c6");
  rrect(ctx, cx - 106, 16, 3, 72, 0, "#8999a4");
  rrect(ctx, cx - 162, 90, 114, 3, 1, "#6d7884");
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
  poly(ctx, [[cx + 54, 42], [cx + 64, 28], [cx + 72, 33], [cx + 82, 24], [cx + 86, 42]], "#879c99");
  ellipse(ctx, cx + 118, 36, 5, 5, "#d2a170");
  poly(ctx, [[cx + 105, 53], [cx + 115, 44], [cx + 127, 49], [cx + 127, 54]], "#a89a82");
  rrect(ctx, cx + 30, 86, 120, 30, 10, "#7A9CC6");
  rrect(ctx, cx + 24, 100, 132, 26, 10, "#6A8CB6");
  rrect(ctx, cx + 35, 103, 48, 10, 4, "#89a7bd");
  rrect(ctx, cx + 86, 103, 53, 10, 4, "#819db5");
  poly(ctx, [[cx + 40, 98], [cx + 46, 83], [cx + 63, 88], [cx + 61, 100]], "#b7987c");
  rrect(ctx, cx + 30, 124, 8, 14, 2, "#5E3E22");
  rrect(ctx, cx + 142, 124, 8, 14, 2, "#5E3E22");
}


/* ---------- 입단 기자회견 (축하 팝업) ---------- */

/** 입단 기자회견 그림의 높이. 두 사람이 전신으로 서요. */
export const SIGNING_H = 196;
/** 구단 관계자(단장): 희끗한 넘긴 머리 */
const OFFICIAL: Look = { kind: "white", skin: "#E8C3A0", hair: "#9A9A9A", style: "swept", beard: "none", eyes: "#3A2A1C" };
const OFFICIAL_SUIT = "#232A3B";
/** 카메라 플래시가 터지는 자리(너비 비율, 높이)와 한 바퀴(FLASH_LOOP초) 안에서 터지는 때 */
const SIGN_FLASHES: [number, number, number][] = [
  [0.08, 150, 0.1],
  [0.92, 132, 0.35],
  [0.2, 60, 0.6],
  [0.8, 48, 0.85],
  [0.04, 96, 1.15],
  [0.96, 172, 1.4],
  [0.28, 168, 1.7],
  [0.7, 156, 1.95],
];
const FLASH_LOOP = 2.4;
/** 화면 전체가 하얗게 번쩍이는 때 (한 바퀴 안에서) */
const SHUTTERS = [0.1, 1.15];

/**
 * 입단 기자회견: 로고 배경판(화면 쪽에서 캔버스 뒤에 깔아요) 앞 무대에서, 새 팀 유니폼을 입은 내 선수와 정장 차림 구단 관계자가
 * 가운데서 악수하며 카메라를 봐요. t(초)에 따라 카메라 플래시가 여기저기서 터지고, 셔터가 터질 때 화면이 하얗게 번쩍여요.
 */
export function drawSigning(p: Paint, t: number): void {
  const { ctx, cx, w } = p;
  const H = SIGNING_H;
  // 무대 바닥: 팀 색 카펫
  band(p, H - 22, H, grad(ctx, H - 22, H, [shade(p.color, -0.35), shade(p.color, -0.55)]));
  rrect(ctx, 0, H - 23, w, 3, 0, shade(p.color, 0.3));
  const o = { scale: 0.74, feet: H - 8 };
  // 두 사람이 가운데서 손을 맞잡을 만큼 떨어져 서요(내민 손이 몸 가운데서 36px쯤 나가요).
  const gap = 36;
  const me = figure(p, cx - gap, "shake", "beam", o);
  const gm = figure(p, cx + gap, "shake", "smile", { ...o, flip: true, look: OFFICIAL, color: OFFICIAL_SUIT, outfit: "suit" });
  // 가슴의 등번호
  const top = o.feet - 231 * o.scale;
  text(ctx, String(p.num), cx - gap, top + 128 * o.scale, 22, shade(p.color, 0.8), 900);
  // 맞잡은 두 손
  const [hx, hy] = [(me.r[0] + gm.r[0]) / 2, (me.r[1] + gm.r[1]) / 2];
  ellipse(ctx, hx - 2, hy, 7, 6, shade(OFFICIAL.skin, -0.04));
  ellipse(ctx, hx + 2, hy + 1, 7, 6, p.look.skin);
  // 플래시와 셔터
  const k = t % FLASH_LOOP;
  for (const [fx, fy, at] of SIGN_FLASHES) {
    const a = 1 - (k - at) / 0.3;
    if (k < at || a <= 0) continue;
    ctx.save();
    ctx.globalAlpha = a;
    flash(ctx, fx * w, fy, 12 + 8 * a);
    ctx.restore();
  }
  for (const at of SHUTTERS) {
    const a = 0.32 * (1 - (k - at) / 0.14);
    if (k < at || a <= 0) continue;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, w, H);
    ctx.restore();
  }
}

/* ---------- 우승 세레모니 (축하 팝업) ---------- */

/** 우승 세레모니 그림의 높이. 결정 장면의 경기장 배경을 그대로 써서 높이도 같아요. */
export const PARTY_H = SCENE_H;

/** 같이 우승한 동료 후보. seed로 네 명을 골라요. */
const SQUAD: Look[] = [
  { kind: "black", skin: "#6E4128", hair: "#161210", style: "afro", beard: "goatee", eyes: "#2A1A10" },
  { kind: "white", skin: "#F4D5BE", hair: "#C99A4E", style: "swept", beard: "stubble", eyes: "#4C7DB8" },
  { kind: "hispanic", skin: "#C98F62", hair: "#1B1B1B", style: "fade", beard: "mustache", eyes: "#4A2E1A" },
  { kind: "black", skin: "#3F2617", hair: "#161210", style: "braids", beard: "none", eyes: "#2A1A10", band: "#FFFFFF" },
  { kind: "asian", skin: "#F6DABA", hair: "#111111", style: "spiky", beard: "none", eyes: "#2A1A10" },
  { kind: "black", skin: "#8A5634", hair: "#161210", style: "bald", beard: "full", eyes: "#3A2416" },
  { kind: "white", skin: "#EBC3A3", hair: "#A4522A", style: "buzz", beard: "none", eyes: "#5B8A5A" },
];
const SQUAD_NUMS = [0, 3, 5, 7, 8, 11, 13, 21, 23, 24, 30, 33];

/** 동료 네 명의 생김새와 등번호. 고교·대학(young)이면 수염을 깎아요. */
function squad(seed: number, mine: number, young: boolean): { look: Look; num: number }[] {
  const nums = SQUAD_NUMS.filter((n) => n !== mine);
  return [0, 1, 2, 3].map((i) => {
    // 3은 SQUAD 수(7)와 서로소라 네 명이 겹치지 않아요.
    const look = SQUAD[(seed + i * 3) % SQUAD.length];
    return { look: young ? { ...look, beard: "none" } : look, num: nums[(seed + i * 5) % nums.length] };
  });
}

/** 트로피를 들어 올리는 동안(초). 다 들어 올리는 순간 동료들이 뛰어오르고 꽃가루 대포가 터져요. */
const LIFT: [number, number] = [0.25, 0.85];
/** 동료들이 박수에서 환호로 바뀌는 동안(초) */
const ERUPT: [number, number] = [0.7, 1.0];
/** 1초에 뛰어오르는 횟수 */
const BEAT = 1.9;
/** 박자에 맞춰 0(바닥)과 1(가장 높이) 사이를 오가요. ph는 박자 어긋남(0~1)이에요. */
const beat = (t: number, ph: number) => Math.abs(Math.sin(Math.PI * (t * BEAT + ph)));
export const mixPt = (a: Pt, b: Pt, k: number): Pt => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
export const smooth = (t: number, [a, b]: [number, number]) => {
  const v = Math.max(0, Math.min(1, (t - a) / (b - a)));
  return v * v * (3 - 2 * v);
};

/** 동료들이 뛰기 전 박수 치는 손: 가슴 앞에서 두 손을 모았다 벌려요. */
function clapHands(t: number, ph: number): [Pt, Pt] {
  const open = 7 * Math.abs(Math.sin((t + ph) * 13));
  return [
    [72 - open, 112],
    [88 + open, 112],
  ];
}

/** 관중석 카메라 플래시: 너비 비율, 높이, 한 바퀴(PARTY_FLASH_LOOP초) 안에서 터지는 때 */
const PARTY_FLASHES: [number, number, number][] = [
  [0.07, 52, 0.15],
  [0.93, 40, 0.5],
  [0.22, 30, 0.95],
  [0.8, 74, 1.3],
  [0.12, 86, 1.65],
  [0.9, 88, 1.95],
];
const PARTY_FLASH_LOOP = 2.2;

/** 꽃가루: 정해진 자리에서 내려와 화면 아래로 빠지면 다시 위에서 내려와요. */
const RAIN = scatter(46, 77);
/** 꽃가루 대포 조각: 쏘는 각도와 빠르기 비율 */
const BURST = scatter(24, 131);

function confetto(ctx: Ctx, x: number, y: number, spin: number, flip: number, color: string, ribbon: boolean): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(spin);
  // 뒤집히며 떨어지는 종이: 세로로 납작해졌다 펴져요.
  ctx.scale(1, 0.25 + 0.75 * Math.abs(flip));
  if (ribbon) line(ctx, [[-6, -2], [-2, 2], [2, -2], [6, 2]], color, 1.8);
  else rrect(ctx, -3, -2, 6, 4, 1, color);
  ctx.restore();
}

/** 움직이는 장면 속 한 사람의 자리: 가운데 x, 크기, 발끝, 좌우 반전, 뛰는 높이(px)와 박자 어긋남 */
export interface Spot {
  x: number;
  s: number;
  feet: number;
  flip: boolean;
  hop?: number;
  ph?: number;
}

/** 박자에 맞춰 뛰어오른 높이(px). on(0~1)만큼만 뛰어요. */
const airOf = (o: Spot, t: number, on: number) => (o.hop ?? 0) * beat(t, o.ph ?? 0) * on;

/** 캐릭터 판의 점이 캔버스에서 오는 자리. up만큼 뛰어올라 있을 때예요. */
export const onCanvas = (o: Spot, [bx, by]: Pt, up = 0): Pt => [o.x + (bx - 80) * o.s * (o.flip ? -1 : 1), o.feet - up - 231 * o.s + by * o.s];

/** 한 사람을 손 위치대로 세우고, num이 있으면 유니폼 가슴에 등번호를 달아요(앞으로 든 팔이 번호를 가려요). */
export function standAt(p: Paint, o: Spot, up: number, hands: [Pt, Pt], mood: Mood, num: number | null, extra: FigureOpt = {}): void {
  figureAt(p, o.x, hands, mood, { ...extra, scale: o.s, feet: o.feet - up, flip: o.flip, num: num ?? undefined });
}

/** 발밑 그림자: 뛰어오르면(up) 작고 옅어져요. */
export function floorShadow(ctx: Ctx, o: Spot, up: number): void {
  const k = 1 - (up / 14) * 0.35;
  ctx.save();
  ctx.globalAlpha = 0.32 * k;
  ellipse(ctx, o.x, o.feet - 1, 30 * o.s * k, 5 * o.s * k, "#0B0F1C");
  ctx.restore();
}

/**
 * 우승 세레모니의 배경: 결정 장면의 경기장(seed로 앵글·조명이 바뀌어요)에 금빛 조명 두 줄기가 우리 팀 쪽으로 모여요.
 * 움직이지 않아서 화면 쪽에서 한 번만 그려 두고 매번 그 위에 drawParty를 그려요.
 */
export function drawPartyBg(p: Paint): void {
  const { ctx, cx } = p;
  arenaBg(p);
  ctx.save();
  ctx.globalAlpha = 0.17;
  for (const side of [-1, 1]) poly(ctx, [[cx + side * 160, 0], [cx + side * 124, 0], [cx + side * 18, SCENE_H], [cx + side * 104, SCENE_H]], "#FFE9A8");
  ctx.globalAlpha = 0.3;
  ellipse(ctx, cx, 141, 150, 11, "#FFE9A8");
  ctx.restore();
}

/**
 * 우승 세레모니: 가운데의 내 선수가 우승컵을 한 손으로 높이 들어 올리고, 같은 유니폼의 동료 넷이 둘러싸요.
 * 들어 올리기 전에는 다 같이 박수를 치다가, 컵이 머리 위로 올라가는 순간 동료들이 두 팔을 들고 박자에 맞춰 뛰어오르고
 * 양쪽 꽃가루 대포가 터져요. 그 뒤로 꽃가루가 계속 내리고 관중석에서 카메라 플래시가 터져요. t는 그림이 뜬 뒤 지난 초예요.
 * 가까운 동료 하나는 감격해 울고, 하나는 컵에 손을 뻗고, 바깥쪽 하나는 수건을 머리 위로 돌려요.
 */
export function drawParty(p: Paint, t: number, young = false): void {
  const { ctx, w, cx, color } = p;
  const H = SCENE_H;
  const lift = smooth(t, LIFT);
  const erupt = smooth(t, ERUPT);
  const [mA, mB, mC, mD] = squad(p.seed, p.num, young);
  // 좁은 화면이면 동료들 사이를 좁혀요.
  const kx = Math.max(0.78, Math.min(1, (w - 24) / 336));

  // 관중석 플래시
  const fk = t % PARTY_FLASH_LOOP;
  for (const [fx, fy, when] of PARTY_FLASHES) {
    const a = 1 - (fk - when) / 0.28;
    if (fk < when || a <= 0) continue;
    ctx.save();
    ctx.globalAlpha = a;
    flash(ctx, fx * w, fy, 4 + 4 * a);
    ctx.restore();
  }

  const spot = (dx: number, s: number, feet: number, flip: boolean, hop: number, ph: number): Required<Spot> => ({ x: cx + dx * kx, s, feet, flip, hop, ph });
  const C = spot(-106, 0.44, 132, false, 11, 0.25);
  const D = spot(106, 0.44, 132, true, 11, 0.75);
  const A = spot(-56, 0.49, 139, false, 7, 0);
  const B = spot(56, 0.49, 139, true, 4, 0.5);
  const ME = spot(0, 0.53, 147, false, 0, 0);
  const air = (o: Spot) => airOf(o, t, erupt);
  const at = (o: Spot, b: Pt): Pt => onCanvas(o, b, air(o));

  // 내 손: 허리춤에서 두 손으로 든 컵을 오른손으로 머리 옆까지 들어 올리고, 왼손은 주먹을 쥐고 흔들어요.
  const myL = mixPt([64, 140], mixPt([34, 80], [24, 56], beat(t, 0.1)), lift);
  const myR = mixPt([96, 140], [112, 47 + 3 * Math.sin(t * 5)], lift);
  const grip = at(ME, mixPt([80, 140], myR, lift));
  const cupK = 0.56;

  // 컵 뒤로 번지는 금빛
  glow(ctx, grip[0], grip[1] - 22, 74, "#FFE27A", (0.32 + 0.1 * Math.sin(t * 4)) * (0.35 + 0.65 * lift));

  for (const o of [C, D, A, B, ME]) floorShadow(ctx, o, air(o));

  const stand = (o: Spot, hands: [Pt, Pt], mood: Mood, mate: { look: Look; num: number } | null) =>
    standAt(p, o, air(o), hands, mood, mate ? mate.num : p.num, { look: mate?.look });
  const cheerMood: Mood = erupt > 0.5 ? "beam" : "smile";
  /** 박수 치던 손(박자 어긋남 ph)이 환호하는 손(l, r)으로 바뀌어요. */
  const rally = (ph: number, l: Pt, r: Pt): [Pt, Pt] => {
    const [cl, cr] = clapHands(t, ph);
    return [mixPt(cl, l, erupt), mixPt(cr, r, erupt)];
  };

  // 바깥쪽 둘(뒤): 왼쪽은 수건을 머리 위로 돌리고, 오른쪽은 두 주먹을 번갈아 치켜들어요.
  const towel = t * 9;
  const cHands = rally(0.2, [38 + 9 * Math.cos(towel), 58 + 5 * Math.sin(towel)], mixPt([112, 80], [116, 48], beat(t, C.ph)));
  stand(C, cHands, cheerMood, mC);
  {
    const h = at(C, cHands[0]);
    const swing: Pt = [Math.cos(towel) * 15, Math.sin(towel) * 6 - 5];
    const end = mixPt([h[0] + 2, h[1] + 13], [h[0] + swing[0], h[1] + swing[1]], erupt);
    const mid: Pt = [(h[0] + end[0]) / 2 + Math.cos(towel + 1.6) * 3, (h[1] + end[1]) / 2 + Math.sin(towel + 1.6) * 3];
    line(ctx, [h, mid, end], "#F4F4F4", 5);
    line(ctx, [mixPt(h, mid, 0.5), mid, mixPt(mid, end, 0.6)], shade(color, 0.35), 1.4);
  }
  const dBeat = beat(t, D.ph);
  stand(D, rally(0.6, mixPt([34, 84], [24, 54], dBeat), mixPt([136, 54], [126, 84], dBeat)), cheerMood, mD);

  // 가까운 둘: 왼쪽은 두 팔을 번쩍 들고 감격해 울고, 오른쪽은 안쪽 손을 컵 쪽으로 뻗어요.
  const aBeat = beat(t, A.ph);
  stand(A, rally(0.4, mixPt([30, 76], [22, 54], aBeat), mixPt([130, 76], [138, 54], aBeat)), erupt > 0.5 ? "moved" : "smile", mA);
  stand(B, rally(0.8, mixPt([34, 84], [26, 58], beat(t, B.ph)), [126, 50 + 2 * Math.sin(t * 6)]), cheerMood, mB);

  // 나: 컵 손잡이 아래 기둥을 쥔 손은 컵 위에 다시 그려요.
  stand(ME, [myL, myR], lift > 0.6 ? "beam" : "smile", null);
  cup(ctx, grip[0], grip[1] + 14 * cupK, cupK);
  const hand = 8 * ME.s;
  if (lift < 0.5) {
    const [lx, ly] = at(ME, myL);
    ellipse(ctx, lx, ly, hand, hand * 1.06, p.look.skin);
  }
  const [rx, ry] = at(ME, myR);
  ellipse(ctx, rx, ry, hand, hand * 1.06, p.look.skin);
  if (lift > 0) {
    ctx.save();
    ctx.globalAlpha = lift;
    const tw = (k: number) => 0.55 + 0.45 * Math.sin(t * 6 + k);
    sparkle(ctx, grip[0] - 20, grip[1] - 34, 7 * tw(0), "#FFFFFF");
    sparkle(ctx, grip[0] + 18, grip[1] - 40, 6 * tw(2), "#FFF4C2");
    sparkle(ctx, grip[0] + 24, grip[1] - 12, 5 * tw(4), "#FFFFFF");
    ctx.restore();
  }

  const colors = [color, "#F5C443", "#FFFFFF", shade(color, 0.5), "#FFE58A"];

  // 꽃가루 대포: 컵이 올라간 순간 양쪽 아래 구석에서 안쪽 위로 쏘아 올려요. 꼭대기를 지나면 천천히 팔랑이며 내려와요.
  const shot = t - LIFT[1];
  if (shot > 0 && shot < 2.4) {
    const fade = Math.min(1, (2.4 - shot) / 0.5);
    if (shot < 0.18) {
      ctx.save();
      ctx.globalAlpha = 1 - shot / 0.18;
      for (const x of [4, w - 4]) {
        glow(ctx, x, H - 6, 40, "#FFF4C2", 0.9);
        sparkle(ctx, x, H - 8, 14, "#FFFFFF");
      }
      ctx.restore();
    }
    ctx.save();
    ctx.globalAlpha = fade;
    BURST.forEach(([u, v], i) => {
      const side = i % 2 ? -1 : 1;
      const ang = (55 + u * 27) * (Math.PI / 180);
      const speed = 205 + v * 90;
      const [vx, vy] = [Math.cos(ang) * speed * side, -Math.sin(ang) * speed];
      const g = 300;
      const apex = -vy / g;
      const up = Math.min(shot, apex);
      const down = Math.max(0, shot - apex);
      const x = (side > 0 ? 6 : w - 6) + vx * up + vx * 0.25 * down + Math.sin(shot * 5 + i) * 5 * Math.min(1, down);
      const y = H - 6 + vy * up + 0.5 * g * up * up + 34 * down;
      confetto(ctx, x, y, shot * 7 + i, Math.cos(shot * 9 + i), colors[i % colors.length], i % 5 === 0);
    });
    ctx.restore();
  }

  // 내리는 꽃가루: 대포가 터진 뒤부터 위에서 계속 내려와요.
  confettiRain(ctx, w, t, shot, colors);
}

/** 위에서 계속 내리는 꽃가루. since는 내리기 시작한 뒤 지난 초(0보다 작으면 아직), t는 흔들림에 쓰는 시각이에요. */
function confettiRain(ctx: Ctx, w: number, t: number, since: number, colors: string[]): void {
  if (since <= 0) return;
  RAIN.forEach(([u, v], i) => {
    const fall = since * (30 + v * 26) - v * 110;
    if (fall < 0) return;
    const y = -8 + (fall % (SCENE_H + 16));
    const x = u * w + Math.sin(t * 1.7 + i) * 7;
    confetto(ctx, x, y, t * 2.6 + i, Math.cos(t * 6 + i * 1.3), colors[i % colors.length], i % 6 === 0);
  });
}

/* ---------- 개인 수상: 트로피 받기 (축하 팝업) ---------- */

/** 트로피를 받는 상: 시즌 MVP(NBA MVP와 다른 리그의 정규리그 MVP)와 파이널 MVP. 트로피 모양과 무대가 달라요. */
export type AwardKind = "mvp" | "fmvp";

/** 트로피를 받는 그림의 높이 */
export const AWARD_H = SCENE_H;

/** 금빛 공: 왼쪽 위에서 빛을 받고 이음선이 있어요. */
function goldBall(ctx: Ctx, x: number, y: number, r: number): void {
  ellipse(ctx, x, y, r, r, "#D99A22");
  ellipse(ctx, x - r * 0.1, y - r * 0.1, r * 0.88, r * 0.88, "#F5C443");
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.strokeStyle = "#B9831A";
  ctx.lineWidth = r * 0.11;
  ctx.beginPath();
  ctx.moveTo(x - r, y);
  ctx.quadraticCurveTo(x, y + r * 0.2, x + r, y);
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x - r * 0.13, y, x, y + r);
  ctx.moveTo(x - r * 0.6, y - r * 0.8);
  ctx.bezierCurveTo(x + r * 0.07, y - r * 0.33, x + r * 0.07, y + r * 0.27, x - r * 0.67, y + r * 0.73);
  ctx.moveTo(x + r * 0.6, y - r * 0.8);
  ctx.bezierCurveTo(x + r * 0.13, y - r * 0.27, x + r * 0.27, y + r * 0.33, x + r * 0.73, y + r * 0.67);
  ctx.stroke();
  ctx.restore();
  ellipse(ctx, x - r * 0.42, y - r * 0.45, r * 0.26, r * 0.18, "#FFF6C8");
}

/** 시즌 MVP 트로피: 나무 받침 위 금빛 기둥에 금빛 공을 올렸어요. (x, y)가 받침 바닥 가운데이고, 높이는 69에 k를 곱한 만큼이에요. */
function mvpTrophy(ctx: Ctx, x: number, y: number, k = 1): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);
  rrect(ctx, -15, -12, 30, 12, 2, "#5A3A22");
  rrect(ctx, -15, -12, 30, 3, 1.5, "#7A5234");
  rrect(ctx, -8, -8, 16, 5, 1, "#E2A93B");
  rrect(ctx, -11, -16, 22, 4, 1.5, "#C98F1C");
  poly(ctx, [[-6, -16], [6, -16], [3.5, -40], [-3.5, -40]], "#F5C443");
  poly(ctx, [[-4.5, -17], [-2.6, -17], [-1.6, -39], [-2.6, -39]], "#FFF1A8");
  ellipse(ctx, 0, -41, 8, 2.6, "#C98F1C");
  goldBall(ctx, 0, -55, 14);
  ctx.restore();
}

/**
 * 파이널 MVP 트로피: 검은 받침과 은빛 기둥 위에 금테 림과 은빛 그물을 얹고, 그 림에 금빛 공이 막 들어가 앉았어요.
 * (x, y)가 받침 바닥 가운데이고, 높이는 63에 k를 곱한 만큼이에요.
 */
function fmvpTrophy(ctx: Ctx, x: number, y: number, k = 1): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);
  rrect(ctx, -16, -12, 32, 12, 2, "#1E2230");
  rrect(ctx, -16, -9, 32, 3, 1, "#C9D1DC");
  rrect(ctx, -9, -16, 18, 4, 1.5, "#9AA3AE");
  poly(ctx, [[-4, -16], [4, -16], [2.5, -27], [-2.5, -27]], "#C9D1DC");
  const rim = -44;
  ctx.strokeStyle = "#C98F1C";
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.ellipse(0, rim, 14, 4, 0, Math.PI, Math.PI * 2);
  ctx.stroke();
  goldBall(ctx, 0, rim - 8, 11);
  // 그물: 림에서 기둥 머리로 모이는 은빛 줄
  for (let i = 0; i <= 5; i++) {
    const top: Pt = [-14 + (28 * i) / 5, rim + 1];
    if (i < 5) line(ctx, [top, [-3 + (6 * (i + 1)) / 5, -27]], "#DDE3EA", 1.3);
    if (i > 0) line(ctx, [top, [-3 + (6 * (i - 1)) / 5, -27]], "#DDE3EA", 1.3);
  }
  ctx.strokeStyle = "#F5C443";
  ctx.beginPath();
  ctx.ellipse(0, rim, 14, 4, 0, 0, Math.PI);
  ctx.stroke();
  ctx.restore();
}

/** 상마다 트로피: 그리기, 손으로 쥐는 기둥 높이(받침 바닥에서), 전체 높이 */
const TROPHIES: Record<AwardKind, { draw: (ctx: Ctx, x: number, y: number, k: number) => void; grip: number; h: number }> = {
  mvp: { draw: mvpTrophy, grip: 28, h: 69 },
  fmvp: { draw: fmvpTrophy, grip: 21, h: 63 },
};

/** 내 선수가 오른손을 뻗어 트로피를 받기까지(초) */
const REACH: [number, number] = [0.1, 0.35];
/** 시상자가 내민 트로피가 내 손으로 옮겨 오는 동안(초) */
const HANDOVER: [number, number] = [0.35, 0.95];
/** 받은 트로피를 높이 들어 올리는 동안(초). 다 들면 반짝이가 사방으로 터져요. */
const RAISE: [number, number] = [1.0, 1.5];
/** 시상자가 한 걸음 물러나 박수 치는 동안(초) */
const STEP_BACK: [number, number] = [0.95, 1.35];
const SHINE_SEC = 0.7;

/** 무대: 시즌 MVP는 기자회견 무대, 파이널 MVP는 결승이 끝난 경기장의 시상대예요. 내 선수와 시상자, 동료 둘의 자리 */
function awardStage(p: Paint, kind: AwardKind) {
  const kx = Math.max(0.78, Math.min(1, (p.w - 24) / 336));
  const at = (dx: number, s: number, feet: number, flip: boolean, hop = 0, ph = 0): Spot => ({ x: p.cx + dx * kx, s, feet, flip, hop, ph });
  return kind === "mvp"
    ? { me: at(-30, 0.55, 146, false), giver: at(34, 0.53, 144, true), mates: [at(-122, 0.42, 126, false), at(124, 0.42, 126, true)], stepX: 20 * kx }
    : { me: at(-28, 0.5, 136, false), giver: at(30, 0.48, 135, true), mates: [at(-124, 0.44, 132, false, 9, 0.25), at(126, 0.44, 132, true, 9, 0.75)], stepX: 20 * kx };
}

/**
 * 트로피를 받는 그림의 배경. 움직이지 않아서 화면 쪽에서 한 번만 그려 두고 매번 그 위에 drawAward를 그려요.
 * 시즌 MVP: 어두운 남색 무대 막에 큰 MVP 글자, 내 자리를 비추는 스포트라이트.
 * 파이널 MVP: 우승 세레모니와 같은 경기장(같은 seed면 같은 앵글)에 금테 두른 시상대와 조명.
 */
export function drawAwardBg(p: Paint, kind: AwardKind): void {
  const { ctx, cx } = p;
  const { me } = awardStage(p, kind);
  if (kind === "mvp") {
    stageBg(p, me.x, ["#0E1B3A", "#183064"]);
    text(ctx, "MVP", cx + 8, 36, 46, "rgba(255,255,255,0.12)", 900);
    return;
  }
  arenaBg(p);
  ctx.save();
  ctx.globalAlpha = 0.18;
  poly(ctx, [[me.x - 14, 0], [me.x + 14, 0], [me.x + 62, SCENE_H], [me.x - 62, SCENE_H]], "#FFF4C2");
  ctx.restore();
  rrect(ctx, cx - 96, 133, 192, 20, 3, "#1B2033");
  rrect(ctx, cx - 96, 133, 192, 3, 1.5, "#F5C443");
  text(ctx, "FINALS MVP", cx, 143, 8, "rgba(245,196,67,0.9)", 900);
}

/**
 * 트로피 받기: 정장 차림 시상자가 두 손으로 내민 트로피를 내 선수가 받아(HANDOVER) 오른손으로 높이 들어 올려요(RAISE).
 * 들어 올리는 순간 트로피에서 반짝이가 사방으로 터지고 금빛이 번져요. 시상자는 한 걸음 물러나 박수를 쳐요.
 * 시즌 MVP는 왼손을 가슴에 얹고 감격해 울며, 기자들 카메라 플래시가 계속 터지고 뒤에서 동료 둘이 박수를 쳐요.
 * 파이널 MVP는 왼손 주먹을 흔들며 환하게 웃고, 꽃가루가 계속 내리는 가운데 동료 둘이 뛰어올라요. t는 그림이 뜬 뒤 지난 초예요.
 */
export function drawAward(p: Paint, kind: AwardKind, t: number, young = false): void {
  const { ctx, w, color } = p;
  const { me, giver, mates, stepX } = awardStage(p, kind);
  const trophy = TROPHIES[kind];
  const tk = kind === "mvp" ? 0.56 : 0.6;
  const reach = smooth(t, REACH);
  const pass = smooth(t, HANDOVER);
  const raise = smooth(t, RAISE);
  const back = smooth(t, STEP_BACK);
  const [, , mL, mR] = squad(p.seed, p.num, young);

  // 플래시: 시즌 MVP는 기자석, 파이널 MVP는 관중석
  const fk = t % PARTY_FLASH_LOOP;
  const flashes = kind === "mvp" ? SIGN_FLASHES.map(([fx, fy, when]): [number, number, number] => [fx, fy * 0.62, when * 0.9]) : PARTY_FLASHES;
  for (const [fx, fy, when] of flashes) {
    const a = 1 - (fk - when) / 0.28;
    if (fk < when || a <= 0) continue;
    ctx.save();
    ctx.globalAlpha = a;
    flash(ctx, fx * w, fy, (kind === "mvp" ? 5 : 4) + 4 * a);
    ctx.restore();
  }

  // 내 손: 쉬던 손을 시상자 쪽으로 뻗어 트로피를 받고, 오른손으로 머리 옆까지 들어 올려요.
  const reachL = mixPt([42, 152], [100, 124], reach);
  const reachR = mixPt([118, 152], [126, 118], reach);
  // 시즌 MVP는 왼손을 가슴(심장 쪽)에 얹어요.
  const endL: Pt = kind === "mvp" ? [66, 110] : mixPt([34, 80], [24, 56], beat(t, 0.1));
  const myL = mixPt(reachL, endL, raise);
  // 트로피 받침이 머리에 얹히지 않게 머리 옆 조금 바깥으로 들어요.
  const myR = mixPt(reachR, [118, 50 + 3 * Math.sin(t * 5)], raise);
  const myGrip = onCanvas(me, mixPt(mixPt(myL, myR, 0.5), myR, raise));

  // 시상자 손: 트로피를 두 손으로 내밀었다가, 물러나며 박수를 쳐요.
  const g: Spot = { ...giver, x: giver.x + stepX * back };
  const [clapL, clapR] = clapHands(t, 0.3);
  const giverHands: [Pt, Pt] = [mixPt([100, 122], clapL, back), mixPt([124, 122], clapR, back)];
  const giverGrip = onCanvas(giver, [112, 122]);
  const grip = mixPt(giverGrip, myGrip, pass);
  const top: Pt = [grip[0], grip[1] + (trophy.grip - trophy.h * 0.62) * tk];

  // 트로피 뒤로 번지는 금빛
  glow(ctx, top[0], top[1], 70, "#FFE27A", (0.3 + 0.1 * Math.sin(t * 4)) * (0.25 + 0.75 * raise));

  // 동료 둘: 시즌 MVP는 뒤에서 박수, 파이널 MVP는 두 팔을 들고 뛰어요.
  const on = kind === "fmvp" ? smooth(t, [0.2, 0.5]) : 0;
  for (const o of [...mates, g, me]) floorShadow(ctx, o, airOf(o, t, on));
  mates.forEach((o, i) => {
    const mate = i ? mR : mL;
    const b = beat(t, o.ph ?? 0);
    const hands: [Pt, Pt] =
      kind === "mvp" ? clapHands(t, 0.45 * i) : [mixPt(clapHands(t, 0.2)[0], mixPt([30, 76], [22, 54], b), on), mixPt(clapHands(t, 0.2)[1], mixPt([130, 76], [138, 54], b), on)];
    standAt(p, o, airOf(o, t, on), hands, kind === "mvp" ? "smile" : "beam", mate.num, { look: mate.look });
  });

  standAt(p, g, 0, giverHands, "smile", null, { look: OFFICIAL, color: OFFICIAL_SUIT, outfit: "suit" });
  standAt(p, me, 0, [myL, myR], raise > 0.6 ? (kind === "mvp" ? "moved" : "beam") : "smile", p.num);

  // 트로피와 그것을 쥔 손(손이 트로피 앞에 와요)
  trophy.draw(ctx, grip[0], grip[1] + trophy.grip * tk, tk);
  const hand = (o: Spot, b: Pt, skin: string) => {
    const [hx, hy] = onCanvas(o, b);
    ellipse(ctx, hx, hy, 8 * o.s, 8.5 * o.s, skin);
  };
  if (pass < 0.5) {
    hand(giver, giverHands[0], OFFICIAL.skin);
    hand(giver, giverHands[1], OFFICIAL.skin);
  } else {
    if (raise < 0.5) hand(me, myL, p.look.skin);
    hand(me, myR, p.look.skin);
  }

  // 들어 올린 순간 사방으로 퍼지는 반짝이와 금빛 고리
  const shine = t - RAISE[1];
  if (shine > 0 && shine < SHINE_SEC) {
    const k = shine / SHINE_SEC;
    ctx.save();
    ctx.globalAlpha = 1 - k;
    ctx.strokeStyle = "#FFE27A";
    ctx.lineWidth = 3 * (1 - k) + 0.5;
    ctx.beginPath();
    ctx.arc(top[0], top[1], 8 + 46 * k, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + 0.3;
      const d = 12 + 52 * Math.sqrt(k);
      sparkle(ctx, top[0] + Math.cos(a) * d, top[1] + Math.sin(a) * d * 0.8, (i % 2 ? 4 : 6) * (1 - k * 0.5), i % 3 ? "#FFE27A" : "#FFFFFF");
    }
    ctx.restore();
  }
  if (raise > 0) {
    ctx.save();
    ctx.globalAlpha = raise;
    const tw = (k: number) => 0.55 + 0.45 * Math.sin(t * 6 + k);
    sparkle(ctx, top[0] - 22, top[1] - 6, 7 * tw(0), "#FFFFFF");
    sparkle(ctx, top[0] + 20, top[1] - 12, 6 * tw(2), "#FFF4C2");
    sparkle(ctx, top[0] + 24, top[1] + 18, 5 * tw(4), "#FFFFFF");
    ctx.restore();
  }

  // 파이널 MVP: 우승 세레모니에서 이어지는 꽃가루가 처음부터 내리고 있어요.
  if (kind === "fmvp") confettiRain(ctx, w, t, t + 4, [color, "#F5C443", "#FFFFFF", shade(color, 0.5), "#FFE58A"]);
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
