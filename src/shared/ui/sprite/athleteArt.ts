/** 공유 선수 그림. 캐릭터 판은 160×240, 어깨와 손은 장면의 자세 좌표를 써요. */
type Ctx = CanvasRenderingContext2D;
type Point = [number, number];

const ink = "#242532";
const outlines = new Map<string, Path2D>();

export function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [n >> 16, (n >> 8) & 255, n & 255];
}

export function shade(hex: string, amount: number): string {
  const channel = (v: number) => Math.max(0, Math.min(255, Math.round(amount < 0 ? v * (1 + amount) : v + (255 - v) * amount)));
  const [r, g, b] = rgb(hex).map(channel);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

/** 캐시에는 정해진 패턴만 넣고 색과 자세는 그릴 때 입혀요. */
function shape(ctx: Ctx, d: string, color: string, contour = false) {
  let path = outlines.get(d);
  if (!path) {
    path = new Path2D(d);
    outlines.set(d, path);
  }
  ctx.fillStyle = color;
  ctx.fill(path);
  if (contour) {
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1.45;
    ctx.lineJoin = "round";
    ctx.stroke(path);
  }
}

export function jersey(ctx: Ctx, color: string, tug = 0, number?: number) {
  ctx.save();
  ctx.translate(0, 88);
  ctx.scale(1, 0.91 + tug / 66);
  const trim = shade(color, 0.80);
  shape(ctx, "M49 9Q54 3 67 0Q79 16 93 0Q103 1 111 8Q105 22 117 37L106 56L109 64Q88 70 51 65L54 57L44 36Q54 23 49 9Z", color, true);
  shape(ctx, "M106 16Q105 30 116 37L106 54L98 62L107 44L95 49L105 36Z M54 56L70 60L59 62L84 65L52 64Z", shade(color, -0.28));
  shape(ctx, "M50 8L55 5Q61 24 47 38L44 36Q54 20 50 8Z M106 5L110 8Q106 24 117 36L114 39Q102 28 106 5Z M65 1L68 0Q81 13 92 0L96 1Q82 22 65 1Z", trim);
  shape(ctx, "M55 30Q66 20 77 23L65 25Z M61 50L85 54L68 54Z", shade(color, 0.20));
  shape(ctx, "M56 24L71 16L83 18L68 19Z M96 24L100 17L100 23Z M53 41L61 44L70 44L65 46Z", shade(color, 0.15));
  shape(ctx, "M57 20L60 19L63 20L62 24L59 25L57 23Z", trim);
  if (number !== undefined) {
    ctx.font = 'bold 21px "Arial Narrow", sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = trim;
    ctx.fillText(String(number), 80, 35);
  }
  // 직조 라벨과 옆선.
  shape(ctx, "M54 60L61 61L61 64L54 63Z", trim);
  shape(ctx, "M111 39L106 52L101 56Z", trim);
  ctx.restore();
}

export function shorts(ctx: Ctx, color: string) {
  ctx.save();
  ctx.translate(80, 141);
  ctx.scale(0.91, 0.85);
  ctx.translate(-80, -147);
  shape(ctx, "M49 147Q79 152 111 146L116 169L120 185Q108 192 86 192L79 173L74 192Q57 193 39 187L44 167Z", shade(color, -0.12), true);
  shape(ctx, "M71 154L82 158L76 174L68 187L72 164L58 173Z M105 155L114 173L117 184L101 188L107 175Z", shade(color, -0.39));
  shape(ctx, "M47 154L51 155L44 184L40 184Z M111 154L115 162L119 183L116 184Z M41 184Q56 190 75 187L74 191Q52 192 40 187Z M85 188Q105 188 118 181L120 185Q106 192 86 191Z", shade(color, 0.73));
  ctx.restore();
}

/** 티셔츠와 이동복. 어깨·목·손 위치는 경기 자세와 같은 좌표를 써요. */
export function travelShirt(ctx: Ctx, color: string) {
  shape(ctx, "M49 96Q52 90 67 87Q80 99 93 87Q106 89 111 96L109 117L104 135L109 151Q79 156 51 151L54 137L49 119Z", color, true);
  shape(ctx, "M102 103L109 99L106 122L100 130L104 132L101 142L108 149L91 151L96 142L83 141L98 136Z M54 130L67 135L55 133Z", shade(color, -0.28));
  shape(ctx, "M56 100L65 94L72 99L64 97Z M59 116L73 112L84 114L69 115Z M54 144L73 146L64 148L53 147Z", shade(color, 0.2));
  shape(ctx, "M65 88L68 87Q80 97 92 87L95 88Q82 105 65 88Z", shade(color, -0.42));
  shape(ctx, "M55 149Q81 152 105 148L106 150Q81 154 55 151Z", shade(color, -0.23));
}

export function trouserLegs(ctx: Ctx, color: string, formal: boolean, step: number) {
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(80 + side * 15, -Math.max(0, -side * step) * 7);
    ctx.scale(side, 1);
    shape(ctx, "M-17 148L14 147Q17 160 13 175L10 191L9 210L6 218L-8 218L-8 202L-10 185L-8 173Z", color, true);
    shape(ctx, "M-14 152L-7 155L-2 173L-5 184L4 189L-3 191L-2 209L-7 216L-9 189L-8 170Z", shade(color, -0.35));
    shape(ctx, "M7 158L13 154L8 177L1 186L4 176Z M-2 211L8 207L7 211L0 213Z", shade(color, 0.16));
    shape(ctx, "M-8 214L6 214L11 219L19 222Q24 224 22 228L10 230L-9 229L-10 223Z", formal ? "#343843" : "#dcdedb", true);
    shape(ctx, "M-9 225L1 226L20 224L22 227L12 230L-9 229Z", "#272e39");
    shape(ctx, "M-7 217L-2 217L1 222L10 219L14 221L3 225L-7 223Z", formal ? "#515666" : "#586777");
    ctx.restore();
  }
}

/** 자세가 바뀌어도 소매가 어깨에서 팔꿈치 방향으로 따라가요. */
export function sleeve(ctx: Ctx, start: Point, end: Point, color: string, full = false) {
  ctx.save();
  ctx.translate(...start);
  ctx.rotate(Math.atan2(end[1] - start[1], end[0] - start[0]));
  ctx.scale(Math.hypot(end[0] - start[0], end[1] - start[1]) / 24, 1);
  shape(ctx, "M-6 -5Q-4 -11 4 -10L24 -7L24 7L10 8L-3 8Z", color, true);
  shape(ctx, "M2 6L15 3L24 2L24 7L8 8Z", shade(color, -0.27));
  shape(ctx, "M20 -7L24 -7L24 7L21 7Z", full ? "#dedfda" : shade(color, 0.19));
  ctx.restore();
}

export function courtLegs(ctx: Ctx, skin: string, team: string, step = 0) {
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(80 + side * 20, -Math.max(0, -side * step) * 7);
    ctx.scale(side, 1);
    shape(ctx, "M-9 165Q-3 163 8 165L10 180Q11 186 8 190Q12 195 9 202L6 216L-3 216L-4 204Q-9 198 -7 189Z", skin, true);
    shape(ctx, "M6 184Q10 191 8 197L4 209L0 212L2 202L0 197Z", shade(skin, -0.20));
    shape(ctx, "M-7 178L5 178L1 184L-5 186Z M-4 192L3 189L0 196Z", shade(skin, 0.14));
    shape(ctx, "M-4 203Q2 205 9 202L7 217L-3 217Z", "#eee8df", true);
    shape(ctx, "M-4 205Q3 207 9 204L8 207Q2 210 -4 208Z", team);
    shape(ctx, "M-5 214Q0 217 6 213L10 217Q13 220 19 221Q24 223 23 228Q11 232 -8 229L-8 222Z", "#f3eee3", true);
    shape(ctx, "M-6 216L-1 216L1 222L10 219L15 222L4 227L-7 226Z", team);
    shape(ctx, "M-7 226Q7 229 23 225L23 229Q8 232 -8 229Z", "#363a45");
    shape(ctx, "M4 217L10 218L9 220L4 219Z M8 220L13 221L12 223L7 222Z", "#faf8ed");
    ctx.restore();
  }
}

function muscle(ctx: Ctx, start: Point, end: Point, width: number, skin: string) {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  ctx.save();
  ctx.translate(...start);
  ctx.rotate(Math.atan2(dy, dx));
  ctx.scale(Math.hypot(dx, dy) / 30, width / 9);
  shape(ctx, "M-4 -5Q0 -10 9 -8Q16 -9 24 -4L30 -4Q34 0 30 4L20 6Q12 9 4 8Q-5 8 -4 -5Z", skin);
  shape(ctx, "M1 -5Q5 -9 12 -6L6 -5L2 -2Z M13 -5L23 -3L16 -2Z", shade(skin, 0.18));
  shape(ctx, "M3 7Q16 6 21 2L30 1L30 4L20 6Q9 10 3 7Z", shade(skin, -0.21));
  ctx.restore();
}

export function bareArm(ctx: Ctx, skin: string, shoulder: Point, elbow: Point, hand: Point) {
  muscle(ctx, shoulder, elbow, 9, skin);
  muscle(ctx, elbow, hand, 6.8, skin);
  ctx.save();
  ctx.translate(...hand);
  ctx.rotate(Math.atan2(hand[1] - elbow[1], hand[0] - elbow[0]) - Math.PI / 2);
  shape(ctx, "M-4 -4Q0 -7 4 -4L6 1L5 7L2 9L-2 8L-5 4L-6 0Z", skin, true);
  shape(ctx, "M-4 1L-1 5L3 6L2 8L-2 7Z", shade(skin, -0.22));
  ctx.restore();
}

export function basketball(ctx: Ctx, x: number, y: number, radius = 9) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(radius / 15, radius / 15);
  ctx.rotate(-0.24);
  shape(ctx, "M0 -15A15 15 0 1 1 0 15A15 15 0 1 1 0 -15Z", "#e5813c", true);
  shape(ctx, "M12 -9A15 15 0 0 1 -12 9Q5 17 12 -9Z", "#aa5029");
  shape(ctx, "M-11 -6Q-6 -15 3 -12Q-4 -11 -9 -5Z", "#f9b975");
  ctx.beginPath();
  ctx.moveTo(-15, 0);
  ctx.quadraticCurveTo(0, 3, 15, 0);
  ctx.moveTo(0, -15);
  ctx.quadraticCurveTo(-2, 0, 0, 15);
  ctx.moveTo(-9, -12);
  ctx.bezierCurveTo(1, -5, 1, 4, -10, 11);
  ctx.moveTo(9, -12);
  ctx.bezierCurveTo(2, -4, 4, 5, 11, 10);
  ctx.strokeStyle = "#593628";
  ctx.lineWidth = 1.25;
  ctx.stroke();
  ctx.restore();
}
