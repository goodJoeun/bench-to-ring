import type { Look } from "@/game";
import { drawHead, shade, type Mood } from "@/components/common/Sprite";

/*
 * 표지 그림의 한 단계 장면을 캔버스에 그려요. 선수 판은 Sprite와 같은 160x240 단위이고, 소품은 판 밖까지 나가요.
 * 단계마다 열쇠 자세(keyframe)를 시간에 따라 이어 붙여 움직여요. t는 그 단계에 초점이 온 뒤 지난 초예요.
 */

type Ctx = CanvasRenderingContext2D;
type Pt = [number, number];

export type StageKey = "bench" | "debut" | "champ" | "nba" | "mvp";

/** 표지 주인공: 동양인 선수. 머리 모양은 단계마다 달라져요(HAIR). */
export const COVER_LOOK: Look = { kind: "asian", skin: "#F1CFA4", hair: "#111111", style: "curtain", beard: "none", eyes: "#2A1A10" };

/** 단계마다 머리 모양: 고교 까까머리 → 신인 앞머리 → 우승 땐 뾰족 머리에 헤어밴드 → 가르마 → 넘긴 머리 */
const HAIR: Record<StageKey, Partial<Look>> = {
  bench: { style: "buzz" },
  debut: { style: "straight" },
  champ: { style: "spiky", band: "#FFFFFF" },
  nba: { style: "curtain" },
  mvp: { style: "swept" },
};

/** 캔버스가 덮는 범위 (선수 판 왼쪽 위에서 바깥으로 left·top만큼 넓혀요) */
export const VIEW = { left: 40, top: 90, w: 240, h: 330 };

/** 한 단계에 머무는 시간(초). 동작은 이 안에 끝나고 마지막 자세로 멈춰요. */
export const STAGE_SEC = 3.4;

/* 그리기 도구 */

function ellipse(ctx: Ctx, x: number, y: number, rx: number, ry: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

function rrect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

function poly(ctx: Ctx, pts: Pt[], color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.fill();
}

function line(ctx: Ctx, pts: Pt[], color: string, width: number): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.stroke();
}

/** 네 갈래 반짝임 */
function sparkle(ctx: Ctx, x: number, y: number, r: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.quadraticCurveTo(x, y, x, y + r);
  ctx.quadraticCurveTo(x, y, x - r, y);
  ctx.quadraticCurveTo(x, y, x, y - r);
  ctx.fill();
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const ease = (v: number) => v * v * (3 - 2 * v);
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
/** t가 a에서 b로 가는 동안 0에서 1로 (부드럽게) */
const span = (t: number, a: number, b: number) => ease(clamp01((t - a) / (b - a)));

/* 자세 */

interface Pose {
  /** 윗몸 위치 (앉으면 아래로 내려가요) */
  x: number;
  y: number;
  /** 걸음: 양수면 왼발, 음수면 오른발을 들어요 */
  step: number;
  /** 고개 숙임 0~1 */
  bow: number;
  /** 유니폼 밑단을 잡아당긴 길이 */
  tug: number;
  /** 고개 기울임 (라디안, 양수면 오른쪽으로) */
  tilt: number;
  /** 왼손·오른손 (윗몸 기준 좌표) */
  lh: Pt;
  rh: Pt;
  /** 팔꿈치. 열쇠 자세에는 적지 않고, 손 위치와 팔 길이로 구해요(arm). */
  le: Pt;
  re: Pt;
}

const REST: Pick<Pose, "lh" | "rh"> = { lh: [42, 152], rh: [118, 152] };
const BASE: Pose = { x: 0, y: 0, step: 0, bow: 0, tug: 0, tilt: 0, ...REST, le: [0, 0], re: [0, 0] };

const SHOULDER = { l: [51, 100] as Pt, r: [109, 100] as Pt };
/** 위팔과 아래팔 길이. 손이 이보다 멀면 팔이 닿는 데까지만 뻗어요. */
const UPPER = 30;
const FORE = 27;

/** 어깨에서 손을 향해 팔을 뻗었을 때의 팔꿈치와 손. 팔꿈치는 몸 바깥쪽으로 굽혀요. */
function arm(s: Pt, target: Pt): [Pt, Pt] {
  const dx = target[0] - s[0];
  const dy = target[1] - s[1];
  const d = Math.hypot(dx, dy) || 1;
  const reach = Math.min(UPPER + FORE - 0.5, Math.max(Math.abs(UPPER - FORE) + 0.5, d));
  const ux = dx / d;
  const uy = dy / d;
  const hand: Pt = [s[0] + ux * reach, s[1] + uy * reach];
  const a = (UPPER * UPPER - FORE * FORE + reach * reach) / (2 * reach);
  const k = Math.sqrt(Math.max(0, UPPER * UPPER - a * a));
  const mx = s[0] + ux * a;
  const my = s[1] + uy * a;
  const e1: Pt = [mx - uy * k, my + ux * k];
  const e2: Pt = [mx + uy * k, my - ux * k];
  return [Math.abs(e1[0] - 80) >= Math.abs(e2[0] - 80) ? e1 : e2, hand];
}

/** 열쇠 자세들. 앞 자세에서 바뀌는 값만 적어요. */
function keys(first: Partial<Pose>, rest: [number, Partial<Pose>][]): [number, Pose][] {
  const out: [number, Pose][] = [[0, { ...BASE, ...first }]];
  for (const [t, patch] of rest) out.push([t, { ...out[out.length - 1][1], ...patch }]);
  return out;
}

/** 두 자세 사이. 늘 새 객체를 돌려줘서 열쇠 자세가 바뀌지 않아요. */
function mix(a: Pose, b: Pose, k: number): Pose {
  const p = (u: Pt, v: Pt): Pt => [lerp(u[0], v[0], k), lerp(u[1], v[1], k)];
  return {
    x: lerp(a.x, b.x, k),
    y: lerp(a.y, b.y, k),
    step: lerp(a.step, b.step, k),
    bow: lerp(a.bow, b.bow, k),
    tug: lerp(a.tug, b.tug, k),
    tilt: lerp(a.tilt, b.tilt, k),
    lh: p(a.lh, b.lh),
    rh: p(a.rh, b.rh),
    le: a.le,
    re: a.re,
  };
}

function poseAt(frames: [number, Pose][], t: number): Pose {
  for (let i = 1; i < frames.length; i++) {
    const [t1, b] = frames[i];
    if (t < t1) {
      const [t0, a] = frames[i - 1];
      return mix(a, b, ease((t - t0) / (t1 - t0)));
    }
  }
  const last = frames[frames.length - 1][1];
  return mix(last, last, 0);
}

/* 단계별 열쇠 자세 (손 위치만 적어요) */

const FRAMES: Record<StageKey, [number, Pose][]> = {
  // 벤치에 앉아 무릎 위에 손을 모으고 있다가, 어깨가 처지며 고개를 푹 숙여요.
  bench: keys({ y: 22, lh: [62, 150], rh: [98, 150] }, [
    [0.5, {}],
    [1.5, { bow: 1, y: 30, lh: [66, 154], rh: [94, 154] }],
  ]),
  // 옆줄에 서서 유니폼 밑단을 두 번 잡아당겨 가다듬고, 코트로 걸어 들어가요(걸음은 따로 더해요).
  debut: keys({ x: -18 }, [
    [0.3, {}],
    [0.6, { lh: [62, 148], rh: [98, 148] }],
    [0.8, { tug: 6, lh: [62, 154], rh: [98, 154] }],
    [1.0, { tug: 0, lh: [62, 148], rh: [98, 148] }],
    [1.2, { tug: 6, lh: [62, 154], rh: [98, 154] }],
    [1.4, { tug: 0, ...REST }],
  ]),
  // 오른손 가위를 그물에 올려 자르고, 잘라낸 그물을 든 채 두 팔을 들어요.
  champ: keys({}, [
    [0.2, {}],
    [0.7, { rh: [122, 46] }],
    [1.7, {}],
    [2.1, { rh: [120, 46], lh: [40, 46] }],
  ]),
  // 허리춤에 든 NBA 유니폼을 가슴 앞으로 펼쳐 들고 사진을 찍어요.
  nba: keys({ lh: [60, 150], rh: [100, 150] }, [
    [0.3, {}],
    [0.9, { lh: [56, 116], rh: [104, 116] }],
  ]),
  // 양복을 입고 가슴에 안은 트로피를 두 손으로 얼굴 옆까지 들어 올리고, 고개를 기울여 입을 맞춰요.
  mvp: keys({ lh: [70, 150], rh: [90, 150] }, [
    [0.3, {}],
    [1.1, { lh: [97, 118], rh: [121, 118] }],
    [1.5, { tilt: 0.16 }],
  ]),
};

/** 단계의 t초 자세. 걷기·손 흔들기처럼 되풀이하는 움직임을 더하고, 팔꿈치를 구해요. */
function pose(stage: StageKey, t: number): Pose {
  const p = poseAt(FRAMES[stage], t);
  if (stage === "debut") {
    const walk = clamp01((t - 1.5) / 1.2);
    p.x = lerp(-18, 16, ease(walk));
    p.step = walk > 0 && walk < 1 ? Math.sin(walk * Math.PI * 4) : 0;
    p.y -= Math.abs(p.step) * 2;
  }
  if (stage === "champ" && t > 2.1) p.rh = [p.rh[0] + Math.sin((t - 2.1) * 9) * 4, p.rh[1]];
  [p.le, p.lh] = arm(SHOULDER.l, p.lh);
  [p.re, p.rh] = arm(SHOULDER.r, p.rh);
  return p;
}

/** 단계별 표정: 벤치 집중 → 시무룩, 데뷔 긴장 → 각오, 우승 집중 → 감격의 눈물, NBA 활짝, MVP 뿌듯 */
function moodAt(stage: StageKey, t: number, p: Pose): Mood {
  switch (stage) {
    case "bench":
      return p.bow > 0.5 ? "glum" : "focus";
    case "debut":
      return t < 1.5 ? "nervous" : "focus";
    case "champ":
      return t < 1.7 ? "focus" : "moved";
    case "nba":
      return t < 0.9 ? "smile" : "beam";
    case "mvp":
      return t < 1.1 ? "smile" : "kiss";
  }
}

/* 선수 */

type Outfit = { kind: "jersey" | "tee" | "suit"; color: string };

const OUTFIT: Record<StageKey, Outfit> = {
  bench: { kind: "jersey", color: "#2F5DB0" },
  debut: { kind: "jersey", color: "#C8372D" },
  champ: { kind: "jersey", color: "#1F7A4D" },
  nba: { kind: "tee", color: "#3A4150" },
  mvp: { kind: "suit", color: "#232A3B" },
};

function drawArm(ctx: Ctx, skin: string, o: Outfit, s: Pt, e: Pt, h: Pt): void {
  if (o.kind === "suit") {
    // 소매는 손목까지, 그 끝에 셔츠 소맷부리
    const wrist: Pt = [lerp(h[0], e[0], 0.22), lerp(h[1], e[1], 0.22)];
    line(ctx, [s, e, wrist], o.color, 18);
    ellipse(ctx, wrist[0], wrist[1], 6.5, 6.5, "#F4F4F4");
  } else {
    line(ctx, [s, e, h], skin, 15);
    if (o.kind === "tee") line(ctx, [s, [lerp(s[0], e[0], 0.42), lerp(s[1], e[1], 0.42)]], o.color, 21);
  }
  ellipse(ctx, h[0], h[1], 8, 8.5, skin);
}

/** 팔이 몸 앞에 오는지: 손이 몸통 앞에 있거나 어깨 위로 올라가면 몸 앞에 그려요. */
const inFront = (h: Pt) => (h[0] > 50 && h[0] < 110) || h[1] < 95;

/** 서 있는 다리와 신발. 걸음(step)만큼 한쪽 발을 들어요. */
function drawStandingLegs(ctx: Ctx, skin: string, o: Outfit, p: Pose): void {
  for (const [lx, lift] of [
    [58, Math.max(0, p.step)],
    [86, Math.max(0, -p.step)],
  ] as const) {
    ctx.save();
    ctx.translate(p.x, -lift * 7);
    if (o.kind === "jersey") {
      rrect(ctx, lx, 176, 16, 40, 6, skin);
      rrect(ctx, lx - 1, 202, 18, 14, 3, "#F4F4F4");
      rrect(ctx, lx - 1, 206, 18, 3, 1, o.color);
    } else {
      const pants = o.kind === "suit" ? shade(o.color, -0.1) : "#6A86B5";
      rrect(ctx, lx - 2, 150, 20, 68, 5, pants);
    }
    const shoe = o.kind === "suit" ? "#17181C" : "#F4F4F4";
    rrect(ctx, lx - 8, 213, 26, 16, 7, shoe);
    rrect(ctx, lx - 9, 224, 28, 7, 3, o.kind === "suit" ? "#000000" : "#2A2A2A");
    ctx.restore();
  }
}

/** 벤치에 앉은 다리: 허벅지는 앞으로 짧게 보이고, 무릎 아래가 바닥까지 내려와요. */
function drawSittingLegs(ctx: Ctx, skin: string, o: Outfit): void {
  for (const lx of [58, 86]) {
    ellipse(ctx, lx + 8, 212, 10, 7, skin);
    rrect(ctx, lx, 212, 16, 12, 5, skin);
    rrect(ctx, lx - 1, 215, 18, 9, 3, "#F4F4F4");
    rrect(ctx, lx - 1, 218, 18, 2.5, 1, o.color);
    rrect(ctx, lx - 8, 220, 26, 10, 6, "#F4F4F4");
    rrect(ctx, lx - 9, 226, 28, 5, 2.5, "#2A2A2A");
  }
}

function drawShorts(ctx: Ctx, color: string): void {
  poly(
    ctx,
    [
      [47, 146],
      [113, 146],
      [117, 189],
      [84, 189],
      [80, 177],
      [76, 189],
      [43, 189],
    ],
    shade(color, -0.22),
  );
  const trim = shade(color, 0.75);
  line(
    ctx,
    [
      [48, 152],
      [45, 186],
    ],
    trim,
    3,
  );
  line(
    ctx,
    [
      [112, 152],
      [115, 186],
    ],
    trim,
    3,
  );
}

function drawTop(ctx: Ctx, o: Outfit, tug: number): void {
  const { color } = o;
  if (o.kind === "jersey") {
    const b = 151 + tug;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(53, 90);
    ctx.lineTo(67, 88);
    ctx.quadraticCurveTo(80, 106, 93, 88);
    ctx.lineTo(107, 90);
    ctx.quadraticCurveTo(103, 112, 116, 124);
    ctx.lineTo(114, b);
    ctx.lineTo(46, b);
    ctx.lineTo(44, 124);
    ctx.quadraticCurveTo(57, 112, 53, 90);
    ctx.fill();
    const trim = shade(color, 0.75);
    ctx.strokeStyle = trim;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(67, 88);
    ctx.quadraticCurveTo(80, 106, 93, 88);
    ctx.moveTo(107, 90);
    ctx.quadraticCurveTo(103, 112, 116, 124);
    ctx.moveTo(53, 90);
    ctx.quadraticCurveTo(57, 112, 44, 124);
    ctx.stroke();
    rrect(ctx, 45, b - 6, 70, 7, 2, shade(color, -0.35));
    return;
  }
  if (o.kind === "tee") {
    poly(
      ctx,
      [
        [50, 92],
        [68, 88],
        [92, 88],
        [110, 92],
        [113, 158],
        [47, 158],
      ],
      color,
    );
    line(
      ctx,
      [
        [68, 89],
        [80, 97],
        [92, 89],
      ],
      shade(color, -0.18),
      3,
    );
    return;
  }
  // 양복: 재킷, 흰 셔츠와 빨간 넥타이, 깃
  poly(
    ctx,
    [
      [48, 92],
      [66, 88],
      [94, 88],
      [112, 92],
      [116, 164],
      [44, 164],
    ],
    color,
  );
  poly(
    ctx,
    [
      [68, 89],
      [92, 89],
      [80, 128],
    ],
    "#F4F4F4",
  );
  poly(
    ctx,
    [
      [77, 95],
      [83, 95],
      [85, 120],
      [80, 127],
      [75, 120],
    ],
    "#C8372D",
  );
  const lapel = shade(color, 0.18);
  poly(
    ctx,
    [
      [66, 88],
      [80, 128],
      [62, 112],
    ],
    lapel,
  );
  poly(
    ctx,
    [
      [94, 88],
      [80, 128],
      [98, 112],
    ],
    lapel,
  );
  ellipse(ctx, 80, 140, 2.4, 2.4, shade(color, 0.35));
  ellipse(ctx, 80, 152, 2.4, 2.4, shade(color, 0.35));
}

function drawPlayer(ctx: Ctx, look: Look, stage: StageKey, p: Pose, mood: Mood): void {
  const o = OUTFIT[stage];
  const { skin } = look;
  if (stage === "bench") drawSittingLegs(ctx, skin, o);
  else drawStandingLegs(ctx, skin, o, p);

  ctx.save();
  ctx.translate(p.x, p.y);
  if (o.kind === "jersey") drawShorts(ctx, o.color);
  const arms: [Pt, Pt, Pt][] = [
    [SHOULDER.l, p.le, p.lh],
    [SHOULDER.r, p.re, p.rh],
  ];
  for (const [s, e, h] of arms) if (!inFront(h)) drawArm(ctx, skin, o, s, e, h);
  drawTop(ctx, o, p.tug);
  // 고개를 숙이면 머리가 내려오고 얼굴이 납작해 보여요. 기울이면 목을 축으로 돌아요.
  ctx.save();
  ctx.translate(p.tilt * 24, p.bow * 14);
  ctx.translate(80, 90);
  ctx.rotate(p.tilt);
  ctx.scale(1, 1 - p.bow * 0.16);
  ctx.translate(-80, -90);
  drawHead(ctx, look, mood);
  ctx.restore();
  for (const [s, e, h] of arms) if (inFront(h)) drawArm(ctx, skin, o, s, e, h);
  ctx.restore();
}

/* 소품 */

function drawBench(ctx: Ctx): void {
  rrect(ctx, -26, 204, 14, 27, 2, "#93602F");
  rrect(ctx, 172, 204, 14, 27, 2, "#93602F");
  rrect(ctx, -36, 194, 232, 13, 4, "#C28448");
  rrect(ctx, -36, 204, 232, 3, 1, "#6E4522");
  // 벤치 위 물병
  rrect(ctx, 150, 168, 13, 27, 4, "#7EC8EE");
  rrect(ctx, 152, 161, 9, 8, 2, "#2F5DB0");
}

/** 그물 줄: 밝은 바탕에서도 보이게 회색 테두리 위에 흰 줄을 그어요. */
function netLine(ctx: Ctx, pts: Pt[], width = 2): void {
  line(ctx, pts, "#9AA3AE", width + 2);
  line(ctx, pts, "#FFFFFF", width);
}

/** 농구 골대와 그물. 자른 뒤에는 왼쪽 반만 남아요. */
function drawHoop(ctx: Ctx, cut: boolean): void {
  rrect(ctx, 92, -86, 72, 48, 4, "#F7F7F7");
  ctx.strokeStyle = "#9AA3AE";
  ctx.lineWidth = 3;
  ctx.strokeRect(92, -86, 72, 48);
  ctx.strokeRect(112, -66, 32, 22);
  rrect(ctx, 126, -40, 4, 30, 1, "#9AA3AE");
  const top: Pt[] = [0, 1, 2, 3, 4, 5].map((i) => [100 + i * 8.8, -12]);
  const bot: Pt[] = [0, 1, 2, 3, 4, 5].map((i) => [108 + i * 5.6, 22]);
  const n = cut ? 3 : 5;
  for (let i = 0; i <= n; i++) {
    if (i < n) netLine(ctx, [top[i], bot[i + 1]]);
    if (i > 0) netLine(ctx, [top[i], bot[i - 1]]);
  }
  netLine(ctx, bot.slice(0, n + 1));
  line(
    ctx,
    [
      [98, -12],
      [146, -12],
    ],
    "#E2571E",
    5,
  );
}

/** 손에 든 그물 조각 */
function drawNetPiece(ctx: Ctx, h: Pt): void {
  const [x, y] = h;
  const zig: Pt[] = [];
  for (let i = 0; i <= 5; i++) zig.push([x + (i % 2 ? 9 : -9), y - 6 - i * 8]);
  netLine(ctx, zig, 3);
  netLine(
    ctx,
    [
      [x - 9, y - 6],
      [x + 9, y - 22],
      [x - 9, y - 38],
    ],
    3,
  );
}

function drawScissors(ctx: Ctx, h: Pt, open: number): void {
  ctx.save();
  ctx.translate(h[0], h[1] - 4);
  ctx.scale(1.5, 1.5);
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.rotate(side * open);
    line(
      ctx,
      [
        [0, 0],
        [0, -22],
      ],
      "#C9CED6",
      4,
    );
    ctx.restore();
  }
  ellipse(ctx, -5, 6, 4.5, 4.5, "#E8505B");
  ellipse(ctx, 5, 6, 4.5, 4.5, "#E8505B");
  ctx.restore();
}

const CONFETTI = ["#F5C443", "#E8505B", "#4FB3E8", "#7BD389"];

function drawConfetti(ctx: Ctx, t: number): void {
  for (let i = 0; i < 16; i++) {
    const phase = (i * 0.618) % 1;
    const x = -30 + ((i * 47) % 230) + Math.sin(t * 3 + i) * 6;
    const y = -90 + ((t * (50 + phase * 40) + phase * 320) % 320);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(t * 4 + i);
    rrect(ctx, -3, -5, 6, 10, 1.5, CONFETTI[i % 4]);
    ctx.restore();
  }
}

/** 두 손으로 위쪽 두 귀퉁이를 잡고 펼친 NBA 유니폼 */
function drawHeldJersey(ctx: Ctx, l: Pt, r: Pt): void {
  const [x0, y0] = l;
  const [x1] = r;
  const w = x1 - x0;
  const cx = (x0 + x1) / 2;
  const color = "#1D428A";
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x0 + w * 0.3, y0);
  ctx.quadraticCurveTo(cx, y0 + 16, x1 - w * 0.3, y0);
  ctx.lineTo(x1, y0);
  ctx.quadraticCurveTo(x1 - 2, y0 + 14, x1 + 6, y0 + 22);
  ctx.lineTo(x1 + 4, y0 + 58);
  ctx.lineTo(x0 - 4, y0 + 58);
  ctx.lineTo(x0 - 6, y0 + 22);
  ctx.quadraticCurveTo(x0 + 2, y0 + 14, x0, y0);
  ctx.fill();
  ctx.strokeStyle = "#FFFFFF";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(x0 + w * 0.3, y0 + 1);
  ctx.quadraticCurveTo(cx, y0 + 17, x1 - w * 0.3, y0 + 1);
  ctx.stroke();
  rrect(ctx, x0 - 4, y0 + 52, w + 8, 4, 1, "#C8102E");
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "700 24px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("1", cx, y0 + 34);
}

/** 카메라 플래시: 빛 둘레와 가운데 흰 점 */
function drawFlash(ctx: Ctx, x: number, y: number, a: number): void {
  if (a <= 0) return;
  ctx.save();
  ctx.globalAlpha = a;
  const g = ctx.createRadialGradient(x, y, 0, x, y, 36);
  g.addColorStop(0, "rgba(255,226,122,0.95)");
  g.addColorStop(1, "rgba(255,226,122,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, 36, 0, Math.PI * 2);
  ctx.fill();
  sparkle(ctx, x, y, 22, "#F5B820");
  sparkle(ctx, x, y, 12, "#FFFFFF");
  ctx.restore();
}

/** 공을 올린 금빛 MVP 트로피. 받침이 (cx, cy)에 와요. */
function drawTrophy(ctx: Ctx, cx: number, cy: number): void {
  rrect(ctx, cx - 16, cy - 8, 32, 9, 2, "#C98F1C");
  poly(
    ctx,
    [
      [cx - 9, cy - 8],
      [cx - 6, cy - 30],
      [cx + 6, cy - 30],
      [cx + 9, cy - 8],
    ],
    "#F5C443",
  );
  ellipse(ctx, cx, cy - 45, 16, 16, "#F5C443");
  line(
    ctx,
    [
      [cx - 16, cy - 45],
      [cx + 16, cy - 45],
    ],
    "#C98F1C",
    2,
  );
  line(
    ctx,
    [
      [cx, cy - 61],
      [cx, cy - 29],
    ],
    "#C98F1C",
    2,
  );
  ellipse(ctx, cx - 6, cy - 51, 4, 4, "#FFF1A8");
}

function drawGlow(ctx: Ctx, a: number): void {
  if (a <= 0) return;
  const g = ctx.createRadialGradient(80, 70, 0, 80, 70, 130);
  g.addColorStop(0, `rgba(255,215,96,${0.8 * a})`);
  g.addColorStop(1, "rgba(255,215,96,0)");
  ctx.fillStyle = g;
  ctx.fillRect(-40, -90, 240, 330);
}

/** 교체 팻말: 초록 판에 IN과 화살표 */
function drawSubSign(ctx: Ctx, a: number): void {
  if (a <= 0) return;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.translate(0, (1 - a) * 10);
  rrect(ctx, 108, -44, 62, 34, 8, "#1C9C5B");
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "700 20px sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("IN", 116, -26);
  poly(
    ctx,
    [
      [146, -34],
      [162, -27],
      [146, -20],
    ],
    "#FFFFFF",
  );
  ctx.restore();
}

/** 시무룩한 줄과 식은땀 */
function drawGloom(ctx: Ctx, p: Pose): void {
  if (p.bow <= 0) return;
  ctx.save();
  ctx.globalAlpha = p.bow;
  ctx.translate(p.x, p.y);
  line(
    ctx,
    [
      [30, 6],
      [30, 30],
    ],
    "#7B8CC8",
    4,
  );
  line(
    ctx,
    [
      [40, -2],
      [40, 26],
    ],
    "#7B8CC8",
    4,
  );
  line(
    ctx,
    [
      [20, 16],
      [20, 34],
    ],
    "#7B8CC8",
    4,
  );
  ellipse(ctx, 114, 50, 4, 6, "#8FD3F5");
  ctx.restore();
}

const FLASHES: [number, number, number][] = [
  [1.1, -18, 70],
  [1.6, 176, 46],
  [2.1, -8, 150],
  [2.6, 180, 128],
];

/** 한 단계 장면을 그려요. 캔버스는 VIEW 범위가 160x240 판 단위가 되게 맞춰 두고 불러요. */
export function drawStage(ctx: Ctx, stage: StageKey, t: number, base: Look = COVER_LOOK): void {
  const p = pose(stage, t);
  const look = { ...base, ...HAIR[stage] };
  const mood = moodAt(stage, t, p);
  const { skin } = look;
  switch (stage) {
    case "bench":
      drawBench(ctx);
      drawPlayer(ctx, look, stage, p, mood);
      drawGloom(ctx, p);
      return;
    case "debut":
      drawPlayer(ctx, look, stage, p, mood);
      drawSubSign(ctx, span(t, 1.4, 1.8));
      return;
    case "champ": {
      const cut = t >= 1.7;
      drawHoop(ctx, cut);
      drawPlayer(ctx, look, stage, p, mood);
      const h: Pt = [p.rh[0] + p.x, p.rh[1] + p.y];
      if (t > 0.6 && !cut) drawScissors(ctx, h, 0.12 + 0.22 * (0.5 + 0.5 * Math.sin(t * 24)));
      if (cut) {
        drawNetPiece(ctx, h);
        drawConfetti(ctx, t - 1.7);
      }
      return;
    }
    case "nba":
      drawPlayer(ctx, look, stage, p, mood);
      drawHeldJersey(ctx, [p.lh[0] + p.x, p.lh[1] + p.y], [p.rh[0] + p.x, p.rh[1] + p.y]);
      ellipse(ctx, p.lh[0] + p.x, p.lh[1] + p.y, 8, 8.5, skin);
      ellipse(ctx, p.rh[0] + p.x, p.rh[1] + p.y, 8, 8.5, skin);
      for (const [at, x, y] of FLASHES) if (t >= at) drawFlash(ctx, x, y, 1 - (t - at) / 0.4);
      return;
    case "mvp": {
      const lift = span(t, 1.1, 1.5);
      drawGlow(ctx, lift * (0.75 + 0.25 * Math.sin(t * 4)));
      drawPlayer(ctx, look, stage, p, mood);
      // 트로피 받침을 두 손이 잡고, 공이 얼굴 옆 입술에 닿아요.
      const bx = (p.lh[0] + p.rh[0]) / 2 + p.x;
      const by = (p.lh[1] + p.rh[1]) / 2 + p.y;
      drawTrophy(ctx, bx, by);
      ellipse(ctx, p.lh[0] + p.x, p.lh[1] + p.y, 8, 8.5, skin);
      ellipse(ctx, p.rh[0] + p.x, p.rh[1] + p.y, 8, 8.5, skin);
      if (lift > 0) {
        ctx.save();
        ctx.globalAlpha = lift;
        const tw = (k: number) => 0.6 + 0.4 * Math.sin(t * 6 + k);
        sparkle(ctx, 24, 0, 13 * tw(0), "#FFE27A");
        sparkle(ctx, 140, -20, 11 * tw(2), "#FFE27A");
        sparkle(ctx, 12, 96, 9 * tw(4), "#FFE27A");
        sparkle(ctx, 152, 100, 10 * tw(1), "#FFE27A");
        ctx.restore();
      }
      return;
    }
  }
}
