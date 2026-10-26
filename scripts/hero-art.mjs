// 시작 화면 제목 옆 도트 그림: 벤치에 앉은 선수 → MVP 트로피를 든 선수.
// 도형(타원·사각형·다각형)을 칸 단위로 칠하고 둘레에 외곽선을 둘러 public/hero/bench-to-mvp.png로 저장해요.
// 화면에서는 image-rendering:pixelated로 키워 보여줘요. 그림을 고치면 `node scripts/hero-art.mjs`로 다시 만들어요.
import { mkdir } from "node:fs/promises";
import sharp from "sharp";

const W = 120;
const H = 80;
const px = new Array(W * H).fill(null);

const C = {
  line: "#2B1B16",
  skin: "#F7D2AE",
  skinShade: "#E5AC85",
  blush: "#F3A3A0",
  hair: "#3D2B26",
  hairHi: "#634740",
  eye: "#1F1514",
  mouth: "#B8434A",
  tongue: "#EE7C7C",
  jersey: "#2F5DB0",
  jerseyShade: "#224A91",
  trim: "#F4F6FA",
  shoe: "#F4F4F4",
  shoeShade: "#C9CED6",
  sole: "#3A3A44",
  towel: "#FAFAFA",
  towelShade: "#D3DAE4",
  wood: "#C28448",
  woodShade: "#93602F",
  woodDark: "#6E4522",
  gold: "#F5C443",
  goldShade: "#C98F1C",
  goldHi: "#FFF1A8",
  goldLine: "#9C6A10",
  bottle: "#7EC8EE",
  bottleShade: "#4C9BCB",
  gloom: "#7B8CC8",
  sweat: "#8FD3F5",
};

// 칸 중심 기준 도형. 모두 (x, y) => boolean
const ellipse = (cx, cy, rx, ry) => (x, y) => ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1;
const rect = (x0, y0, x1, y1) => (x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
const poly = (pts) => (x, y) => {
  const X = x + 0.5;
  const Y = y + 0.5;
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > Y !== yj > Y && X < ((xj - xi) * (Y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};
/** 두 점을 잇는 굵은 선(팔·다리) */
const limb = (x0, y0, x1, y1, r) => (x, y) => {
  const X = x + 0.5;
  const Y = y + 0.5;
  const dx = x1 - x0;
  const dy = y1 - y0;
  const t = Math.max(0, Math.min(1, ((X - x0) * dx + (Y - y0) * dy) / (dx * dx + dy * dy)));
  return (X - x0 - t * dx) ** 2 + (Y - y0 - t * dy) ** 2 <= r * r;
};
const and = (...fs) => (x, y) => fs.every((f) => f(x, y));
const or = (...fs) => (x, y) => fs.some((f) => f(x, y));
const not = (f) => (x, y) => !f(x, y);

const set = (x, y, c) => {
  if (x >= 0 && x < W && y >= 0 && y < H) px[y * W + x] = c;
};
/** 칠하기. outline이면 도형 바로 바깥 한 칸을 외곽선으로 둘러요(앞서 그린 것 위에도). */
function fill(shape, color, outline = true) {
  const mask = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (shape(x, y)) mask[y * W + x] = 1;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (mask[y * W + x]) set(x, y, color);
      else if (
        outline &&
        ((x > 0 && mask[y * W + x - 1]) ||
          (x < W - 1 && mask[y * W + x + 1]) ||
          (y > 0 && mask[(y - 1) * W + x]) ||
          (y < H - 1 && mask[(y + 1) * W + x]))
      )
        set(x, y, C.line);
    }
}
const paint = (shape, color) => fill(shape, color, false);
const dots = (list, color) => list.forEach(([x, y]) => set(x, y, color));
/** 반짝이: 십자 모양 별 */
function sparkle(x, y, r, color) {
  for (let i = -r; i <= r; i++) {
    set(x + i, y, color);
    set(x, y + i, color);
  }
  if (r >= 2) dots([[x - 1, y - 1], [x + 1, y - 1], [x - 1, y + 1], [x + 1, y + 1]], C.goldHi);
}

/* ───────── 왼쪽: 벤치에 앉은 선수 (가로 0~55) ───────── */
{
  const ox = 0;
  const X = (v) => ox + v;
  // 벤치 다리·판
  fill(rect(X(4), 62, X(7), 77), C.woodDark);
  fill(rect(X(48), 62, X(51), 77), C.woodDark);
  fill(rect(X(0), 56, X(55), 61), C.wood);
  paint(rect(X(0), 60, X(55), 61), C.woodShade);
  // 물병
  fill(rect(X(45), 45, X(50), 55), C.bottle);
  paint(rect(X(49), 46, X(50), 55), C.bottleShade);
  fill(rect(X(46), 42, X(49), 44), C.trim);
  // 다리(벤치 앞으로 내려온 정강이)와 신발
  fill(rect(X(20), 60, X(25), 70), C.skin);
  fill(rect(X(31), 60, X(36), 70), C.skin);
  paint(rect(X(24), 60, X(25), 70), C.skinShade);
  paint(rect(X(35), 60, X(36), 70), C.skinShade);
  fill(rect(X(18), 70, X(26), 74), C.shoe);
  fill(rect(X(30), 70, X(38), 74), C.shoe);
  paint(rect(X(18), 74, X(26), 74), C.sole);
  paint(rect(X(30), 74, X(38), 74), C.sole);
  // 반바지(앉아서 허벅지가 앞으로)
  fill(rect(X(17), 51, X(39), 59), C.jersey);
  paint(rect(X(17), 57, X(39), 59), C.jerseyShade);
  paint(rect(X(28), 53, X(28), 59), C.jerseyShade);
  // 몸통(구부정하게)
  fill(poly([[X(19), 36], [X(37), 36], [X(39), 53], [X(17), 53]]), C.jersey);
  paint(poly([[X(33), 36], [X(37), 36], [X(39), 53], [X(34), 53]]), C.jerseyShade);
  paint(poly([[X(24), 36], [X(32), 36], [X(28), 41]]), C.trim);
  paint(poly([[X(25), 36], [X(31), 36], [X(28), 39]]), C.skin);
  // 축 늘어진 팔, 무릎 위에 올린 손
  fill(limb(X(17), 39, X(19), 53, 2.4), C.skin);
  fill(limb(X(39), 39, X(37), 53, 2.4), C.skin);
  fill(ellipse(X(21), 55, 3, 2.6), C.skin);
  fill(ellipse(X(35), 55, 3, 2.6), C.skin);
  // 머리
  fill(ellipse(X(28), 24, 14, 13), C.skin);
  paint(and(ellipse(X(28), 24, 14, 13), (x, y) => y > 30 && x > X(35)), C.skinShade);
  // 머리 위에 걸친 수건
  fill(
    or(
      and(ellipse(X(28), 22, 16, 15), (x, y) => y < 20),
      rect(X(12), 16, X(16), 38),
      rect(X(40), 16, X(44), 38),
    ),
    C.towel,
  );
  paint(rect(X(12), 34, X(16), 38), C.towelShade);
  paint(rect(X(40), 34, X(44), 38), C.towelShade);
  paint(and(ellipse(X(28), 22, 16, 15), (x, y) => y < 20 && x > X(38)), C.towelShade);
  paint(rect(X(13), 26, X(13), 33), C.towelShade);
  // 수건 밑으로 삐져나온 앞머리
  fill(poly([[X(17), 19], [X(39), 19], [X(39), 22], [X(35), 25], [X(32), 21], [X(28), 25], [X(24), 21], [X(20), 25], [X(17), 22]]), C.hair);
  // 축 처진 눈(반쯤 감긴 눈꺼풀)과 입
  paint(rect(X(20), 28, X(24), 28), C.eye);
  paint(rect(X(32), 28, X(36), 28), C.eye);
  paint(rect(X(21), 29, X(23), 29), C.eye);
  paint(rect(X(33), 29, X(35), 29), C.eye);
  dots([[X(26), 34], [X(27), 33], [X(28), 33], [X(29), 34], [X(30), 34]], C.mouth);
  // 식은땀과 우울한 줄
  fill(poly([[X(46), 22], [X(48), 26], [X(46), 28], [X(44), 26]]), C.sweat);
  paint(rect(X(5), 6, X(5), 14), C.gloom);
  paint(rect(X(8), 3, X(8), 13), C.gloom);
  paint(rect(X(11), 7, X(11), 12), C.gloom);
}

/* ───────── 오른쪽: MVP 트로피를 든 선수 (가로 64~119) ───────── */
{
  const ox = 64;
  const X = (v) => ox + v;
  // 신발·다리
  fill(rect(X(20), 66, X(25), 72), C.skin);
  fill(rect(X(31), 66, X(36), 72), C.skin);
  paint(rect(X(24), 66, X(25), 72), C.skinShade);
  paint(rect(X(35), 66, X(36), 72), C.skinShade);
  fill(rect(X(18), 72, X(26), 77), C.shoe);
  fill(rect(X(30), 72, X(38), 77), C.shoe);
  paint(rect(X(18), 77, X(26), 77), C.sole);
  paint(rect(X(30), 77, X(38), 77), C.sole);
  // 반바지
  fill(poly([[X(18), 57], [X(38), 57], [X(39), 67], [X(29), 67], [X(28), 63], [X(27), 67], [X(17), 67]]), C.jersey);
  paint(poly([[X(33), 57], [X(38), 57], [X(39), 67], [X(33), 67]]), C.jerseyShade);
  // 번쩍 든 팔(머리 뒤로 올라가요)
  fill(or(limb(X(18), 47, X(9), 35, 2.6), limb(X(9), 35, X(19), 21, 2.4)), C.skin);
  fill(or(limb(X(38), 47, X(47), 35, 2.6), limb(X(47), 35, X(37), 21, 2.4)), C.skin);  // 몸통(가슴을 편 자세)
  fill(poly([[X(18), 44], [X(38), 44], [X(38), 58], [X(18), 58]]), C.jersey);
  paint(poly([[X(33), 44], [X(38), 44], [X(38), 58], [X(34), 58]]), C.jerseyShade);
  paint(poly([[X(23), 44], [X(33), 44], [X(28), 50]]), C.trim);
  paint(poly([[X(24), 44], [X(32), 44], [X(28), 48]]), C.skin);
  // 등번호 1
  paint(rect(X(28), 51, X(29), 56), C.trim);
  dots([[X(27), 52]], C.trim);
  // 머리
  fill(ellipse(X(28), 33, 14, 13), C.skin);
  paint(and(ellipse(X(28), 33, 14, 13), (x, y) => y > 39 && x > X(35)), C.skinShade);
  // 머리카락(삐죽한 앞머리)
  fill(
    or(
      and(ellipse(X(28), 30, 15, 12), (x, y) => y < 29),
      poly([[X(13), 27], [X(43), 27], [X(43), 32], [X(40), 30], [X(37), 34], [X(34), 29], [X(30), 33], [X(27), 29], [X(23), 33], [X(20), 29], [X(16), 33], [X(13), 32]]),
    ),
    C.hair,
  );
  paint(and(ellipse(X(28), 30, 15, 12), not(ellipse(X(28), 31, 14, 11)), (x, y) => y < 24 && x < X(26)), C.hairHi);
  dots([[X(20), 22], [X(21), 21], [X(22), 20], [X(23), 20]], C.hairHi);
  // 활짝 웃는 눈(^ ^)과 입
  dots([[X(20), 38], [X(21), 37], [X(22), 36], [X(23), 37], [X(24), 38]], C.eye);
  dots([[X(32), 38], [X(33), 37], [X(34), 36], [X(35), 37], [X(36), 38]], C.eye);
  fill(and(ellipse(X(28), 41, 4.5, 4), (x, y) => y >= 41), C.mouth);
  paint(and(ellipse(X(28), 44, 2.5, 1.6), (x, y) => y >= 43), C.tongue);
  paint(ellipse(X(18.5), 41.5, 2.2, 1.3), C.blush);
  paint(ellipse(X(37.5), 41.5, 2.2, 1.3), C.blush);
  // 트로피: 받침 위 금빛 농구공
  fill(rect(X(22), 20, X(34), 23), C.woodDark);
  paint(rect(X(22), 20, X(34), 20), C.wood);
  fill(rect(X(25), 16, X(31), 19), C.gold);
  paint(rect(X(30), 16, X(31), 19), C.goldShade);
  fill(ellipse(X(28), 9, 8, 8), C.gold);
  paint(and(ellipse(X(28), 9, 8, 8), not(ellipse(X(26.5), 7.5, 7, 7))), C.goldShade);
  paint(and(ellipse(X(28), 9, 8, 8), rect(X(28), 0, X(28), 20)), C.goldLine);
  paint(and(ellipse(X(28), 9, 8, 8), rect(0, 9, W, 9)), C.goldLine);
  paint(and(ellipse(X(28), 9, 8, 8), not(ellipse(X(16), 9, 9, 10)), ellipse(X(16), 9, 10, 11)), C.goldLine);
  paint(and(ellipse(X(28), 9, 8, 8), not(ellipse(X(40), 9, 9, 10)), ellipse(X(40), 9, 10, 11)), C.goldLine);
  dots([[X(24), 4], [X(25), 4], [X(23), 5]], C.goldHi);
  // 트로피를 잡은 두 손
  fill(ellipse(X(20.5), 20, 3, 3), C.skin);
  fill(ellipse(X(35.5), 20, 3, 3), C.skin);
  // 반짝이와 꽃가루
  sparkle(X(7), 6, 3, C.gold);
  sparkle(X(49), 3, 2, C.gold);
  sparkle(X(52), 22, 3, C.gold);
  sparkle(X(4), 26, 2, C.gold);
  dots([[X(12), 12], [X(45), 13], [X(2), 40], [X(53), 36], [X(48), 48], [X(8), 52]], C.goldShade);
  dots([[X(10), 33], [X(50), 30], [X(3), 14]], "#EE6A2A");
}

const out = Buffer.alloc(W * H * 4);
px.forEach((c, i) => {
  if (!c) return;
  const n = parseInt(c.slice(1), 16);
  out[i * 4] = n >> 16;
  out[i * 4 + 1] = (n >> 8) & 255;
  out[i * 4 + 2] = n & 255;
  out[i * 4 + 3] = 255;
});
await mkdir("public/hero", { recursive: true });
await sharp(out, { raw: { width: W, height: H, channels: 4 } }).png({ compressionLevel: 9, palette: true }).toFile("public/hero/bench-to-mvp.png");
console.log(`public/hero/bench-to-mvp.png (${W}×${H})`);
