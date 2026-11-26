/*
 * 시그니처 세리머니 장면. 라이벌전이나 결승에서 클러치로 이기면, 클러치 결과 이펙트가 플레이 장면 다음에 이 장면으로 넘어가요.
 * 판은 CEL_W×CEL_H(클러치 플레이 장면과 같은 6:5)이고, 배경은 결정 장면의 경기장(sceneDraw의 arenaBg)을 키워 그려요.
 * 세리머니마다 자세·표정·효과가 달라요. 활과 화살, 덤벨처럼 흉내만 내는 소품은 빛나는 선이나 점선으로 그려요.
 * t는 장면이 뜬 뒤 지난 초예요. 장면은 3초 남짓 보여서, 끝나는 동작이 없는 세리머니(끄덕임, 덤벨)는 계속 되풀이해요.
 */
import type { Look } from "@/game";
import { shade, type Mood } from "@/shared/ui/sprite/Sprite";
import { ellipse, line, rrect, sparkle } from "@/shared/ui/sprite/coverArt";
import {
  SCENE_H,
  arenaBg,
  flash,
  floorShadow,
  glow,
  mixPt,
  onCanvas,
  scatter,
  smooth,
  speech,
  standAt,
  sweat,
  text,
  type FigureOpt,
  type Paint,
  type Spot,
} from "./sceneDraw";

type Ctx = CanvasRenderingContext2D;
type Pt = [number, number];

export const CEL_W = 240;
export const CEL_H = 200;
/** 경기장 배경(높이 SCENE_H)을 판 높이에 맞춰 키우는 배율 */
const K = CEL_H / SCENE_H;

/** 세리머니 종류. 이름을 모르는 예전 저장의 세리머니는 두 팔을 들고 환호해요(cheer). */
export type CelebrationKey = "bow" | "shush" | "sleep" | "nod" | "sky" | "dumbbell" | "ear" | "bench" | "cheer";

const BY_NAME: Record<string, CelebrationKey> = {
  "활시위 당기기": "bow",
  "쉿! 손가락": "shush",
  "베개 베고 잠자기": "sleep",
  "팔짱 끼고 끄덕끄덕": "nod",
  "가슴 두드리고 하늘 가리키기": "sky",
  "보이지 않는 덤벨 들기": "dumbbell",
  "관중에게 귀 기울이기": "ear",
  "상대 벤치 앞 세리머니": "bench",
};

/** 세리머니 이름(c.perks.celebration)에 맞는 장면 */
export const celebrationKey = (name: string): CelebrationKey => BY_NAME[name] ?? "cheer";

/** 화면 읽기 프로그램에 읽어 줄 장면 설명 */
export const CELEBRATION_LABEL: Record<CelebrationKey, string> = {
  bow: "관중석을 향해 보이지 않는 활시위를 당겨 빛나는 화살을 쏘는 장면",
  shush: "입술에 손가락을 대고 관중석을 조용하게 만드는 장면",
  sleep: "두 손을 모아 베개처럼 베고 눈을 감는 '이제 잘 시간' 장면",
  nod: "팔짱을 끼고 여유롭게 고개를 끄덕이는 장면",
  sky: "가슴을 두 번 두드리고 두 손으로 하늘을 가리키는 장면",
  dumbbell: "보이지 않는 덤벨을 번갈아 머리 위로 들어 올리는 장면",
  ear: "한 손을 귀에 대고 다른 손으로 관중의 함성을 더 크게 끌어내는 장면",
  bench: "상대 벤치 앞에서 두 팔에 힘을 주며 포효하는 장면",
  cheer: "두 팔을 번쩍 들고 환호하는 장면",
};

/** 움직임을 줄인 설정에서 멈춰 보여줄 순간(초): 세리머니가 가장 잘 보이는 자세예요. */
export const CELEBRATION_STILL: Record<CelebrationKey, number> = {
  bow: 1.2,
  shush: 1.6,
  sleep: 1.8,
  nod: 1.3,
  sky: 2.0,
  dumbbell: 1.55,
  ear: 2.0,
  bench: 1.0,
  cheer: 1.0,
};

/** 장면 속 사람: 생김새와 유니폼 색 */
export interface Who {
  look: Look;
  color: string;
}

/** 경기장 앵글을 고르는 seed. 상대 팀 이름으로 정하고, 관중석이 멀리 작게 보이는 엔드라인 앵글(2)은 빼요. */
export function celebrationSeed(opp: string): number {
  let h = 0;
  for (let i = 0; i < opp.length; i++) h = (h * 31 + opp.charCodeAt(i)) >>> 0;
  return [0, 1, 3][h % 3] + 4 * (Math.floor(h / 3) % 6);
}

/* ---------- 나 ---------- */

/** 내 자리: 판 가운데, 발끝은 바닥 가까이 */
const ME: Spot = { x: CEL_W / 2, s: 0.66, feet: 193, flip: false };
/** 내려놓은 두 손 (캐릭터 판 기준) */
const REST: [Pt, Pt] = [
  [42, 152],
  [118, 152],
];
/** 캐릭터 판의 점이 판에서 오는 자리 */
const at = (b: Pt, up = 0): Pt => onCanvas(ME, b, up);

function me(p: Paint, hands: [Pt, Pt], mood: Mood, extra: FigureOpt = {}, up = 0): void {
  floorShadow(p.ctx, ME, up);
  standAt(p, ME, up, hands, mood, p.num, extra);
}

/** 쭉 편 손가락 하나 (from 손등 → to 손끝, 판 좌표) */
function finger(ctx: Ctx, from: Pt, to: Pt, skin: string): void {
  line(ctx, [from, to], shade(skin, -0.35), 4.4);
  line(ctx, [from, to], skin, 3);
}

/** 정해 둔 순간들 사이를 부드럽게 이어 가는 손 위치: keys는 [초, 자리] 목록이에요. */
function keyed(t: number, keys: [number, Pt][]): Pt {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [t1, b] = keys[i];
    if (t < t1) {
      const [t0, a] = keys[i - 1];
      return mixPt(a, b, smooth(t, [t0, t1]));
    }
  }
  return keys[keys.length - 1][1];
}

/** 0에서 1로 갔다가 돌아오는 박자. rate는 1초에 오가는 횟수예요. */
const swing = (t: number, rate: number) => (1 - Math.cos(2 * Math.PI * rate * t)) / 2;

/* ---------- 경기장 ---------- */

/** 관중석 카메라 플래시: 자리(너비·높이 비율)마다 박자가 달라요. k는 세기(0~1)예요. */
const FLASHES = scatter(16, 57);

function crowdFlashes(ctx: Ctx, t: number, k: number): void {
  if (k <= 0) return;
  FLASHES.forEach(([u, v], i) => {
    const loop = 1.5 + (i % 3) * 0.4;
    const ph = ((t + v * 3.1 + i * 0.37) % loop) / 0.26;
    if (ph >= 1) return;
    const x = 8 + u * (CEL_W - 16);
    const y = 40 + v * 92;
    // 내 얼굴과 몸 위에는 터지지 않아요.
    if (Math.abs(x - ME.x) < 44 && y > 52) return;
    ctx.save();
    ctx.globalAlpha = (1 - ph) * Math.min(1, k);
    flash(ctx, x, y, 3 + 3 * (1 - ph) * Math.min(1.3, k));
    ctx.restore();
  });
}

/**
 * 세리머니 배경: 경기장을 판에 맞게 키우고, 나를 비추는 조명을 깔아요. 상대 벤치 세리머니면 내 뒤에 상대 벤치를 놓아요.
 * 움직이지 않아서 화면 쪽에서 한 번만 그려 두고 매번 그 위에 drawCelebration을 그려요. bench는 상대 선수들이에요.
 */
export function drawCelebrationBg(p: Paint, key: CelebrationKey, bench: Who[]): void {
  const { ctx } = p;
  ctx.save();
  ctx.scale(K, K);
  arenaBg({ ...p, w: CEL_W / K, cx: CEL_W / K / 2 });
  ctx.restore();
  glow(ctx, ME.x, 100, 120, "#FFE9A8", 0.2);
  ctx.save();
  ctx.globalAlpha = 0.3;
  ellipse(ctx, ME.x, ME.feet - 1, 76, 9, "#FFE9A8");
  ctx.restore();
  if (key === "bench") opponentBench(p, bench);
}

/**
 * 상대 벤치: 내 뒤로 상대 유니폼의 선수 넷이 앉아 있어요. 허리 아래는 벤치 앞 가림막에 가려요.
 * 하나는 수건을 머리에 뒤집어쓰고, 하나는 머리를 감싸 쥐고, 하나는 팔짱 낀 채 시무룩하고, 하나는 손으로 눈을 가려요.
 */
function opponentBench(p: Paint, bench: Who[]): void {
  const { ctx } = p;
  const seats: { x: number; hands: [Pt, Pt]; mood: Mood; towel?: boolean }[] = [
    { x: 22, hands: [[62, 128], [98, 128]], mood: "glum", towel: true },
    { x: 62, hands: [[64, 46], [96, 46]], mood: "nervous" },
    { x: 178, hands: [[100, 128], [60, 128]], mood: "glum" },
    { x: 218, hands: [[42, 152], [86, 66]], mood: "glum" },
  ];
  const color = bench[0]?.color ?? "#232A3B";
  seats.forEach((s, i) => {
    const who = bench[i % Math.max(1, bench.length)];
    const o: Spot = { x: s.x, s: 0.42, feet: 182, flip: i >= 2 };
    standAt(p, o, 0, s.hands, s.mood, null, { look: who?.look, color: who?.color });
    if (s.towel) {
      // 머리에 뒤집어쓴 수건: 얼굴만 내놓고 어깨까지 내려와요.
      const [hx, ht] = onCanvas(o, [80, 22]);
      ctx.fillStyle = "#F2F2F2";
      ctx.beginPath();
      ctx.moveTo(hx - 13, ht + 30);
      ctx.lineTo(hx - 13, ht + 9);
      ctx.quadraticCurveTo(hx, ht - 7, hx + 13, ht + 9);
      ctx.lineTo(hx + 13, ht + 30);
      ctx.lineTo(hx + 8.5, ht + 30);
      ctx.lineTo(hx + 8.5, ht + 11);
      ctx.quadraticCurveTo(hx, ht + 2, hx - 8.5, ht + 11);
      ctx.lineTo(hx - 8.5, ht + 30);
      ctx.closePath();
      ctx.fill();
      line(ctx, [[hx - 10, ht + 26], [hx - 10, ht + 12]], "#D4D4D4", 1);
    } else if (i === 1) sweat(ctx, s.x + 12, onCanvas(o, [80, 20])[1]);
  });
  // 벤치 앞 가림막: 상대 팀 색에 흰 줄
  rrect(ctx, -4, 147, CEL_W + 8, 30, 3, shade(color, -0.3));
  rrect(ctx, -4, 147, CEL_W + 8, 4, 2, shade(color, 0.25));
  rrect(ctx, -4, 160, CEL_W + 8, 2, 1, "rgba(255,255,255,0.45)");
}

/* ---------- 빛으로 그린 소품 ---------- */

/** 빛나는 선: 넓고 옅은 금빛 번짐 위에 밝은 심을 그어요. */
function lightStroke(ctx: Ctx, path: (c: Ctx) => void, width: number, alpha: number): void {
  if (alpha <= 0) return;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.globalAlpha = alpha * 0.4;
  ctx.strokeStyle = "#FFC93C";
  ctx.lineWidth = width * 3.2;
  ctx.beginPath();
  path(ctx);
  ctx.stroke();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = "#FFF6D2";
  ctx.lineWidth = width;
  ctx.beginPath();
  path(ctx);
  ctx.stroke();
  ctx.restore();
}

/** 화살 한 대: 꼬리(tail)에서 촉(head) 쪽으로 깃과 촉을 달아요. */
function arrow(ctx: Ctx, tail: Pt, head: Pt, alpha: number): void {
  const [dx, dy] = [head[0] - tail[0], head[1] - tail[1]];
  const d = Math.hypot(dx, dy) || 1;
  const [ux, uy] = [dx / d, dy / d];
  const back = (k: number, side: number): Pt => [tail[0] + ux * k - uy * side, tail[1] + uy * k + ux * side];
  lightStroke(ctx, (c) => {
    c.moveTo(...tail);
    c.lineTo(...head);
    // 촉
    c.moveTo(head[0] - ux * 6 - uy * 3.5, head[1] - uy * 6 + ux * 3.5);
    c.lineTo(...head);
    c.lineTo(head[0] - ux * 6 + uy * 3.5, head[1] - uy * 6 - ux * 3.5);
    // 깃
    for (const k of [0, 3.5]) {
      c.moveTo(...back(k, 0));
      c.lineTo(...back(k - 3.5, 3.5));
      c.moveTo(...back(k, 0));
      c.lineTo(...back(k - 3.5, -3.5));
    }
  }, 1.6, alpha);
}

/** 보이지 않는 덤벨: 손에 쥔 손잡이와 양쪽 원판을 점선으로만 그려요. */
function dumbbell(ctx: Ctx, [x, y]: Pt, alpha: number): void {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "rgba(255,255,255,0.13)";
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.lineWidth = 1.2;
  ctx.setLineDash([2.4, 2]);
  ctx.beginPath();
  ctx.moveTo(x - 11, y);
  ctx.lineTo(x + 11, y);
  for (const side of [-1, 1]) {
    ctx.roundRect(x + side * 13 - 2.5, y - 7, 5, 14, 1.5);
    ctx.roundRect(x + side * 17.5 - 1.5, y - 4.5, 3, 9, 1);
  }
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/** 퍼져 나가는 고리 (부딪힌 자리, 화살이 꽂힌 자리) */
function ring(ctx: Ctx, [x, y]: Pt, r: number, color: string, alpha: number, width = 2): void {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/** 떠오르며 사라지는 글자 */
function floatText(ctx: Ctx, s: string, [x, y]: Pt, since: number, life: number, size: number, color: string, rise = 18): void {
  if (since < 0 || since >= life) return;
  const k = since / life;
  ctx.save();
  ctx.globalAlpha = 1 - k * k;
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(10,12,24,0.75)";
  ctx.font = `900 ${size}px system-ui, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.strokeText(s, x, y - rise * k);
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = 1 - k * k;
  text(ctx, s, x, y - rise * k, size, color, 900);
  ctx.restore();
}

/* ---------- 세리머니 ---------- */

/** 활시위를 놓는 순간(초) */
const BOW_RELEASE = 1.45;
/** 화살이 날아가 관중석에 닿는 데 걸리는 시간(초) */
const BOW_FLIGHT = 0.3;
/** 다 당겼을 때 시위(턱 옆)에서 촉까지의 길이 */
const ARROW_LEN = 82;

/**
 * 활시위 당기기: 활을 쥔 손을 관중석 쪽(왼쪽)으로 쭉 뻗고, 시위를 당긴 손을 턱 옆에 붙여 겨눠요. 활과 화살은 빛으로만 보여요.
 * 시위를 놓으면 손이 뒤로 튕기고 시위가 떨리며, 빛 화살이 관중석에 꽂혀 반짝이가 터지고 플래시가 쏟아져요.
 */
function bowScene(p: Paint, t: number): void {
  const { ctx } = p;
  const raise = smooth(t, [0.05, 0.5]);
  const after = t - BOW_RELEASE;
  const shot = after >= 0;
  const hit = after - BOW_FLIGHT;
  crowdFlashes(ctx, t, hit >= 0 ? 1.3 : 0.45);

  const bowHand = mixPt(REST[0], [-1, 80], raise);
  const tremble = shot ? 0 : 0.6 * Math.sin(t * 38) * smooth(t, [0.6, 0.9]);
  const anchor = mixPt([106, 92], [110, 90], smooth(t, [0.6, 1.3]));
  const drawHand: Pt = shot ? mixPt(anchor, [132, 80], smooth(after, [0, 0.12])) : mixPt(REST[1], [anchor[0], anchor[1] + tremble], raise);
  me(p, [bowHand, drawHand], shot ? "smirk" : raise > 0.6 ? "focus" : "smile");

  // 활: 쥔 손이 가운데이고, 양 끝이 내 쪽으로 휘어요. 다 당긴 뒤에 빛으로 나타나요.
  const show = smooth(t, [0.4, 0.62]);
  const g = at(bowHand);
  const pull = shot ? 0 : smooth(t, [0.45, 1.3]);
  const top: Pt = [g[0] + 8 + 2 * pull, g[1] - 25 + pull];
  const bottom: Pt = [g[0] + 8 + 2 * pull, g[1] + 25 - pull];
  lightStroke(ctx, (c) => {
    c.moveTo(...top);
    c.quadraticCurveTo(g[0] - 14 - 3 * pull, g[1], ...bottom);
  }, 2.2, show);
  const wobble = shot ? 5 * Math.exp(-after * 9) * Math.sin(after * 70) : 0;
  const nock: Pt = shot ? [top[0] + wobble, g[1]] : at(drawHand);
  lightStroke(ctx, (c) => {
    c.moveTo(...top);
    c.lineTo(...nock);
    c.lineTo(...bottom);
  }, 0.9, show);

  // 화살: 당기는 동안 촉 끝에 빛이 모이고, 놓으면 관중석으로 날아가며 멀어질수록 작아져요.
  const target: Pt = [16, 70];
  if (!shot) {
    const d = Math.hypot(g[0] - nock[0], g[1] - nock[1]) || 1;
    const head: Pt = [g[0] + ((g[0] - nock[0]) / d) * 10, g[1] + ((g[1] - nock[1]) / d) * 10];
    arrow(ctx, nock, head, show);
    if (show > 0.5) {
      ctx.save();
      ctx.globalAlpha = pull;
      glow(ctx, head[0], head[1], 12, "#FFE27A", 0.8);
      sparkle(ctx, head[0], head[1], 3 + 2.5 * Math.abs(Math.sin(t * 9)), "#FFFFFF");
      ctx.restore();
    }
  } else if (hit < 0) {
    const from: Pt = [g[0] - 10, g[1]];
    const k = smooth(after, [0, BOW_FLIGHT]);
    const head = mixPt(from, target, k);
    const len = ARROW_LEN * (1 - 0.55 * k);
    const d = Math.hypot(target[0] - from[0], target[1] - from[1]) || 1;
    const tail: Pt = [head[0] + ((from[0] - target[0]) / d) * len, head[1] + ((from[1] - target[1]) / d) * len];
    lightStroke(ctx, (c) => {
      c.moveTo(...from);
      c.lineTo(...head);
    }, 1, 0.35);
    arrow(ctx, tail, head, 1);
  }
  // 꽂힌 자리: 빛 고리와 사방으로 튀는 반짝이
  if (hit >= 0) {
    const fade = 1 - smooth(hit, [0.5, 1.4]);
    glow(ctx, target[0], target[1], 34, "#FFE27A", 0.7 * fade);
    ring(ctx, target, 4 + hit * 60, "#FFF4C2", 1 - hit / 0.5, 2.4);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.3;
      const r = 6 + Math.min(1, hit / 0.4) * 26;
      ctx.save();
      ctx.globalAlpha = fade;
      sparkle(ctx, target[0] + Math.cos(a) * r, target[1] + Math.sin(a) * r * 0.8, 3.5, i % 2 ? "#FFE27A" : "#FFFFFF");
      ctx.restore();
    }
  }
}

/**
 * 쉿! 손가락: 주먹 쥔 손의 검지를 모은 입술에 대고 눈을 지그시 감아요. 다른 손은 낮게 내려 '진정해'라고 다독여요.
 * 시끄럽던 관중석이 점점 어두워지고 플래시도 멎어요. 관중석 곳곳에 말줄임표가 떠요.
 */
function shushScene(p: Paint, t: number): void {
  const { ctx } = p;
  const up = smooth(t, [0.05, 0.45]);
  const hush = smooth(t, [0.55, 1.35]);
  ctx.save();
  ctx.globalAlpha = 0.58 * hush;
  ctx.fillStyle = "#04060F";
  ctx.fillRect(0, 0, CEL_W, 142);
  ctx.restore();
  crowdFlashes(ctx, t, 1 - hush * 1.2);
  if (hush > 0.3)
    for (const [x, y] of [[36, 60], [206, 92], [28, 116], [196, 46]] as Pt[]) {
      ctx.save();
      ctx.globalAlpha = smooth(hush, [0.3, 1]) * 0.85;
      for (let i = 0; i < 3; i++) ellipse(ctx, x - 6 + i * 6, y, 1.7, 1.7, "#C9D1DC");
      ctx.restore();
    }
  const lh = mixPt(REST[0], [22, 126 + 3 * Math.sin(t * 8)], smooth(t, [0.25, 0.6]));
  const rh = mixPt(REST[1], [86, 97], up);
  me(p, [lh, rh], up > 0.8 ? "kiss" : "smirk");
  if (up > 0.8) finger(ctx, at([85, 90]), at([83, 79]), p.look.skin);
  // 말풍선 '쉿!'
  const pop = smooth(t, [0.55, 0.72]);
  if (pop > 0) {
    ctx.save();
    ctx.translate(176, 50);
    ctx.scale(0.5 + 0.5 * pop, 0.5 + 0.5 * pop);
    ctx.globalAlpha = pop;
    speech(ctx, 0, 0, 46, 24, "#FFFFFF");
    text(ctx, "쉿!", 0, 0.5, 13, "#1B1F2E", 900);
    ctx.restore();
  }
}

/**
 * 베개 베고 잠자기: 두 손을 모아 뺨 아래 베개처럼 대고 고개를 기울여 눈을 감아요('이제 잘 시간').
 * 경기장 불이 꺼지듯 어두워지고, 초승달과 별이 뜨고, 머리 위로 Z가 하나씩 떠올라요.
 */
function sleepScene(p: Paint, t: number): void {
  const { ctx } = p;
  const up = smooth(t, [0.05, 0.6]);
  const night = smooth(t, [0.5, 1.4]);
  ctx.save();
  ctx.globalAlpha = 0.62 * night;
  ctx.fillStyle = "#070B24";
  ctx.fillRect(0, 0, CEL_W, CEL_H);
  ctx.restore();
  crowdFlashes(ctx, t, 0.6 - night);
  if (night > 0) {
    ctx.save();
    ctx.globalAlpha = night;
    // 초승달: 바깥 원과 오른쪽으로 비킨 안쪽 원 사이
    const [mx, my, r] = [202, 34, 13];
    glow(ctx, mx, my, 34, "#FFF1B8", 0.35);
    ctx.fillStyle = "#FFF1B8";
    ctx.beginPath();
    ctx.arc(mx, my, r, 0.3 * Math.PI, 1.7 * Math.PI, false);
    ctx.arc(mx + 0.5 * r, my, 0.814 * r, 1.534 * Math.PI, 0.466 * Math.PI, true);
    ctx.closePath();
    ctx.fill();
    for (const [i, [u, v]] of scatter(9, 23).entries()) {
      const x = 10 + u * 220;
      const y = 10 + v * 70;
      if (Math.abs(x - mx) < 22 && Math.abs(y - my) < 22) continue;
      sparkle(ctx, x, y, 1.6 + 1.6 * Math.abs(Math.sin(t * 2.4 + i)), "#FFFFFF");
    }
    ctx.restore();
    glow(ctx, ME.x, 104, 84, "#BFD4FF", 0.2 * night);
  }
  const lh = mixPt(REST[0], [50, 84], up);
  const rh = mixPt(REST[1], [58, 76], up);
  const tilt = -(0.22 + 0.03 * Math.sin(t * 2.2)) * up;
  me(p, [lh, rh], up > 0.6 ? "sleep" : "smile", { tilt });
  // Z가 머리 위 오른쪽으로 하나씩 떠올라요.
  const base = at([104, 34]);
  for (let i = 0; i < 3; i++) {
    const start = 0.75 + i * 0.45;
    if (t < start) continue;
    const k = ((t - start) % 1.35) / 1.35;
    ctx.save();
    ctx.globalAlpha = Math.sin(Math.PI * k);
    text(ctx, "Z", base[0] + k * 26 + Math.sin(k * 6) * 3, base[1] - k * 36, 9 + k * 9, "#DCE6FF", 900);
    ctx.restore();
  }
}

/** 1초에 끄덕이는 횟수 */
const NOD_RATE = 1.8;
/** 팔짱을 다 끼고 끄덕이기 시작하는 때(초) */
const NOD_FROM = 0.45;

/**
 * 팔짱 끼고 끄덕끄덕: 팔짱을 끼고 한쪽 입꼬리를 올린 채 '그럴 줄 알았지' 하듯 천천히 고개를 끄덕여요.
 * 고개를 숙일 때마다 머리 옆에 움직임 선이 생기고, '끄덕'이 머리 위 양옆으로 번갈아 떠올라요.
 */
function nodScene(p: Paint, t: number): void {
  const { ctx } = p;
  crowdFlashes(ctx, t, 0.8);
  const cross = smooth(t, [0.05, 0.4]);
  const lh = mixPt(REST[0], [100, 128], cross);
  const rh = mixPt(REST[1], [60, 128], cross);
  const ph = Math.max(0, t - NOD_FROM) * NOD_RATE;
  const bow = 0.5 * Math.sin(Math.PI * ph) ** 2;
  me(p, [lh, rh], "smirk", { bow });
  const k = bow / 0.5;
  if (k > 0.2)
    for (const side of [-1, 1]) {
      const [x, y] = at([80 + side * 36, 44]);
      ctx.save();
      ctx.globalAlpha = (k - 0.2) / 0.8;
      line(ctx, [[x, y - 4], [x + side * 3, y + 2], [x, y + 8]], "#FFFFFF", 1.8);
      ctx.restore();
    }
  // 고개를 다 숙인 순간마다 '끄덕'
  for (let n = 0; n < 8; n++) {
    const since = t - (NOD_FROM + (n + 0.5) / NOD_RATE);
    if (since < 0) break;
    const side = n % 2 ? 1 : -1;
    floatText(ctx, "끄덕", [ME.x + side * 50, 50], since, 0.8, 12, "#FFE27A");
  }
}

/** 가슴을 두드리는 손의 자리: 가슴(왼쪽 가슴, 화면 오른쪽), 당긴 자리, 하늘을 가리키는 자리 */
const CHEST: Pt = [96, 116];
const PULL: Pt = [116, 106];
const SKY_L: Pt = [43, 45];
const SKY_R: Pt = [117, 45];
/** 주먹이 가슴에 닿는 때(초) */
const THUMPS = [0.55, 0.95];

/**
 * 가슴 두드리고 하늘 가리키기: 주먹으로 가슴을 두 번 '쿵, 쿵' 두드리고, 두 손 검지로 하늘을 가리켜요.
 * 가리키는 순간 하늘에서 빛줄기가 내려와 나를 비추고, 그 안으로 반짝이가 천천히 내려앉아요.
 */
function skyScene(p: Paint, t: number): void {
  const { ctx } = p;
  const rh = keyed(t, [[0, REST[1]], [0.35, CHEST], [0.45, PULL], [0.55, CHEST], [0.78, PULL], [0.95, CHEST], [1.15, CHEST], [1.5, SKY_R]]);
  const lh = keyed(t, [[0, REST[0]], [1.15, REST[0]], [1.5, SKY_L]]);
  const point = smooth(t, [1.3, 1.5]);
  const light = smooth(t, [1.35, 1.9]);
  if (light > 0) {
    ctx.save();
    const g = ctx.createLinearGradient(0, 0, 0, ME.feet);
    g.addColorStop(0, `rgba(255,246,210,${0.55 * light})`);
    g.addColorStop(1, `rgba(255,246,210,${0.08 * light})`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(ME.x - 18, 0);
    ctx.lineTo(ME.x + 18, 0);
    ctx.lineTo(ME.x + 62, ME.feet);
    ctx.lineTo(ME.x - 62, ME.feet);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    glow(ctx, ME.x, 0, 60, "#FFFFFF", 0.6 * light);
    for (const [i, [u, v]] of scatter(10, 91).entries()) {
      const y = ((t * (14 + v * 10) + v * 200) % 190) + 2;
      const x = ME.x + (u - 0.5) * (36 + y * 0.45);
      ctx.save();
      ctx.globalAlpha = light * (0.5 + 0.5 * Math.sin(t * 5 + i));
      sparkle(ctx, x, y, 2.4, "#FFFFFF");
      ctx.restore();
    }
  }
  crowdFlashes(ctx, t, 0.5 + 0.5 * light);
  me(p, [lh, rh], point > 0 ? "beam" : "focus");
  // 가슴을 칠 때마다 퍼지는 고리와 '쿵'
  for (const hit of THUMPS) {
    const s = t - hit;
    if (s < 0 || s > 0.4) continue;
    ring(ctx, at(CHEST), 5 + s * 45, "#FFE27A", 1 - s / 0.4, 2.2);
  }
  THUMPS.forEach((hit, i) => floatText(ctx, "쿵", at([136 + i * 8, 98 - i * 10]), t - hit, 0.55, 13, "#FFFFFF", 10));
  if (point > 0.5) {
    finger(ctx, at([118, 38]), at([119, 26]), p.look.skin);
    finger(ctx, at([42, 38]), at([41, 26]), p.look.skin);
  }
}

/** 1초에 드는 횟수 (두 손을 합쳐서). 한 손은 그 절반만큼 들어요. */
const PRESS = 1.6;
const PRESS_FROM = 0.3;
const LOW_L: Pt = [24, 88];
const HIGH_L: Pt = [43, 45];
const LOW_R: Pt = [136, 88];
const HIGH_R: Pt = [117, 45];

/**
 * 보이지 않는 덤벨 들기: 어깨 옆에서 머리 위로 덤벨을 번갈아 밀어 올려요. 덤벨은 점선으로만 보이고, 얼굴은 잔뜩 힘을 줘요.
 * 한쪽을 다 올릴 때마다 그 손 위로 '+1'이 떠오르고 땀방울이 튀어요.
 */
function dumbbellScene(p: Paint, t: number): void {
  const { ctx } = p;
  crowdFlashes(ctx, t, 0.8);
  const on = smooth(t, [0.05, 0.35]);
  const kL = swing(Math.max(0, t - PRESS_FROM), PRESS / 2);
  const lh = mixPt(REST[0], mixPt(LOW_L, HIGH_L, kL), on);
  const rh = mixPt(REST[1], mixPt(LOW_R, HIGH_R, 1 - kL), on);
  me(p, [lh, rh], "strain");
  dumbbell(ctx, at([lh[0], lh[1] - 4]), on);
  dumbbell(ctx, at([rh[0], rh[1] - 4]), on);
  // 다 올린 순간: 왼손이 홀수 번째, 오른손이 짝수 번째로 올라가요.
  for (let n = 1; n < 12; n++) {
    const since = t - (PRESS_FROM + n / PRESS);
    if (since < 0) break;
    const side = n % 2 ? -1 : 1;
    const top = at(side < 0 ? HIGH_L : HIGH_R);
    floatText(ctx, "+1", [top[0] + side * 6, top[1] - 16], since, 0.6, 12, "#FFE27A", 14);
    if (since < 0.35) {
      ctx.save();
      ctx.globalAlpha = 1 - since / 0.35;
      const head = at([80 + side * 26, 40]);
      sweat(ctx, head[0] + side * since * 30, head[1] - since * 14);
      ctx.restore();
    }
  }
}

/**
 * 관중에게 귀 기울이기: 한 손을 기울인 귀 뒤에 대고, 다른 손을 아래위로 흔들며 '더 크게!'를 외쳐요.
 * 관중석의 함성이 물결로 귀에 밀려들고, 함성 막대가 점점 차오르며 플래시가 쏟아져요.
 */
function earScene(p: Paint, t: number): void {
  const { ctx } = p;
  const up = smooth(t, [0.05, 0.4]);
  const loud = smooth(t, [0.5, 2.2]);
  crowdFlashes(ctx, t, 0.3 + 1.0 * loud);
  const beck = swing(Math.max(0, t - 0.4), 1.6);
  const lh = mixPt(REST[0], mixPt([8, 86], [16, 58], beck), up);
  const rh = mixPt(REST[1], [110, 69], up);
  me(p, [lh, rh], loud > 0.45 ? "beam" : "smirk", { tilt: 0.14 * up });
  // 귀로 밀려드는 함성: 바깥에서 귀 쪽으로 좁혀 오는 물결
  const ear = at([106, 70]);
  for (let i = 0; i < 4; i++) {
    const r = 52 - ((t * 42 + i * 13) % 52);
    if (r < 10) continue;
    ctx.save();
    ctx.globalAlpha = Math.min(1, (1.25 - r / 52) * up * (0.45 + 0.75 * loud));
    ctx.strokeStyle = "#FFE27A";
    ctx.lineWidth = 2.6;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(ear[0], ear[1], r, -0.8, 0.8);
    ctx.stroke();
    ctx.restore();
  }
  // 함성 막대: 아래 초록에서 위 빨강까지 여덟 칸
  const lit = Math.round(8 * (0.15 + 0.85 * loud) + (loud > 0.9 ? Math.sin(t * 20) : 0));
  rrect(ctx, 8, 76, 14, 84, 4, "rgba(6,8,16,0.72)");
  for (let i = 0; i < 8; i++) {
    const c = i < 4 ? "#59D17A" : i < 6 ? "#F5C443" : "#E8505B";
    ctx.save();
    ctx.globalAlpha = i < lit ? 1 : 0.18;
    rrect(ctx, 11, 150 - i * 10, 8, 7, 1.5, c);
    ctx.restore();
  }
}

/**
 * 상대 벤치 앞 세리머니: 고개 떨군 상대 벤치 앞에서 두 팔에 힘을 주고(더블 바이셉) 이를 악물고 포효해요.
 * 힘줄 때마다 머리 둘레로 포효하는 선이 뻗어요. 벤치는 배경에 그려 둬요.
 */
function benchScene(p: Paint, t: number): void {
  const { ctx } = p;
  crowdFlashes(ctx, t, 1);
  const on = smooth(t, [0.05, 0.35]);
  const pulse = Math.max(0, Math.sin(t * 2 * Math.PI * 1.4)) * on;
  const lh = mixPt(REST[0], mixPt([28, 72], [24, 64], pulse), on);
  const rh = mixPt(REST[1], mixPt([132, 72], [136, 64], pulse), on);
  me(p, [lh, rh], "strain");
  if (on > 0.5) {
    const [hx, hy] = at([80, 52]);
    ctx.save();
    ctx.globalAlpha = 0.5 + 0.5 * pulse;
    for (let i = 0; i < 7; i++) {
      const a = Math.PI * (1.05 + (i / 6) * 0.9);
      const [c, s] = [Math.cos(a), Math.sin(a)];
      const r0 = 26;
      const r1 = 32 + 7 * pulse;
      line(ctx, [[hx + c * r0, hy + s * r0], [hx + c * r1, hy + s * r1]], "#FFE27A", 2.2);
    }
    ctx.restore();
  }
}

/** 이름을 모르는 세리머니: 두 팔을 번쩍 들고 박자에 맞춰 뛰어요. */
function cheerScene(p: Paint, t: number): void {
  crowdFlashes(p.ctx, t, 1);
  const on = smooth(t, [0.05, 0.35]);
  const b = swing(t, 1.6);
  const lh = mixPt(REST[0], mixPt([26, 60], [24, 52], b), on);
  const rh = mixPt(REST[1], mixPt([134, 60], [136, 52], b), on);
  me(p, [lh, rh], "beam", {}, 5 * b * on);
}

const SCENES: Record<CelebrationKey, (p: Paint, t: number) => void> = {
  bow: bowScene,
  shush: shushScene,
  sleep: sleepScene,
  nod: nodScene,
  sky: skyScene,
  dumbbell: dumbbellScene,
  ear: earScene,
  bench: benchScene,
  cheer: cheerScene,
};

/** 세리머니 한 장면. 배경(drawCelebrationBg) 위에 그려요. */
export function drawCelebration(p: Paint, key: CelebrationKey, t: number): void {
  SCENES[key](p, t);
}
