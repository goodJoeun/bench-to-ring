import { fmtNum, playerLook, titleHistory, type AwardKey, type Career, type Look } from "@/game";
import { emblemOf } from "@/components/common/emblem";
import { NO_TEAM_COLOR } from "@/components/common/format";
import { LOGOS } from "@/components/common/logos.generated";
import { drawSprite } from "@/components/common/Sprite";
import { PATTERNS, SHAPES, monoSize } from "@/components/common/TeamBadge";
import { SITE_NAME, SITE_URL } from "@/lib/site";

/*
 * 은퇴 선수 기록 카드: 이름, 최고 오버롤, 우승 트로피, 통산 기록, 주요 상, 거쳐간 팀을 한 장의 그림(PNG)으로 그려요.
 * 브라우저 캔버스에 직접 그려서 서버 없이 저장·공유해요. 크기는 1080x1440(3:4)이에요.
 */

export const CARD_W = 1080;
export const CARD_H = 1440;

/** 카드에 보여줄 상 (이 순서로, 받은 것만 4개까지) */
const PILLS: [AwardKey, string][] = [
  ["mvp_nba", "NBA MVP"],
  ["fmvp", "파이널 MVP"],
  ["mvp", "리그 MVP"],
  ["dpoy", "올해의 수비수"],
  ["scoring", "득점왕"],
  ["roy", "신인왕"],
  ["allleague", "베스트 팀"],
  ["allstar", "올스타"],
  ["sixth", "식스맨상"],
  ["mip", "기량발전상"],
];
const PILLS_MAX = 4;
const TEAMS_MAX = 5;
const TROPHIES_MAX = 12;

/** 트로피 모양: NBA 우승(금), 다른 프로 리그 우승(은), 아마추어 우승(동), 국가대표 금메달 */
export type TrophyKind = "nba" | "pro" | "amateur" | "medal";

export interface CardData {
  name: string;
  num: number;
  pos: string;
  nat: string;
  legacy: string;
  peak: number;
  rings: number;
  /** 첫 시즌 ~ 은퇴 연도 */
  years: string;
  /** 15시즌 · 5개 구단 · 31세 은퇴 */
  line: string;
  trophies: TrophyKind[];
  /** 트로피가 넘쳐서 못 그린 수 */
  moreTrophies: number;
  big: [string, string][];
  small: [string, string][];
  pills: string[];
  teams: { name: string; seasons: number }[];
  look: Look;
  /** 유니폼 색 (마지막 소속팀) */
  color: string;
}

/** 커리어에서 카드에 들어갈 값을 뽑아요. */
export function cardData(c: Career): CardData {
  const s = c.summary!;
  // 군 복무 시즌은 팀 줄에서 빼요. 프로 시즌이 없으면 아마추어 팀이라도 보여줘요.
  const played = c.hist.filter((h) => !h.mil);
  const pro = played.filter((h) => h.pro);
  const teamSeasons = new Map<string, number>();
  for (const h of pro.length ? pro : played) teamSeasons.set(h.team, (teamSeasons.get(h.team) ?? 0) + 1);
  // 오래 뛴 팀부터 고르고, 고른 팀은 처음 뛴 순서대로 보여줘요.
  const order = [...teamSeasons.keys()];
  const top = new Set([...teamSeasons].sort((a, b) => b[1] - a[1] || order.indexOf(a[0]) - order.indexOf(b[0])).slice(0, TEAMS_MAX).map(([t]) => t));
  const teams = order.filter((t) => top.has(t)).map((name) => ({ name, seasons: teamSeasons.get(name)! }));

  const titles = titleHistory(c);
  const rank: Record<TrophyKind, number> = { nba: 0, pro: 1, medal: 2, amateur: 3 };
  const trophies = titles
    .map((t): TrophyKind => (t.kind === "nat" ? "medal" : t.kind === "amateur" ? "amateur" : t.name.startsWith("NBA") ? "nba" : "pro"))
    .sort((a, b) => rank[a] - rank[b]);

  const ppg = s.gp ? (s.pts / s.gp).toFixed(1) : "0.0";
  const clubs = new Set(pro.map((h) => h.team)).size;
  const first = c.hist[0]?.year ?? s.retYear;
  return {
    name: s.name,
    num: s.num,
    pos: s.pos,
    nat: s.nat,
    legacy: s.legacy,
    peak: s.peak,
    rings: s.rings,
    years: `${first}–${s.retYear}`,
    line: [`프로 ${s.seasons}시즌`, clubs > 0 && `${clubs}개 구단`, `${s.retAge}세 은퇴`].filter(Boolean).join(" · "),
    trophies: trophies.slice(0, TROPHIES_MAX),
    moreTrophies: Math.max(0, trophies.length - TROPHIES_MAX),
    big: [
      [fmtNum(s.pts), "득점"],
      [fmtNum(s.reb), "리바운드"],
      [fmtNum(s.ast), "어시스트"],
    ],
    small: [
      [fmtNum(s.gp), "경기"],
      [ppg, "경기당 득점"],
      [`${fmtNum(s.personal)}개`, "개인상"],
    ],
    pills: PILLS.filter(([k]) => (s.awards[k] ?? 0) > 0)
      .slice(0, PILLS_MAX)
      .map(([k, label]) => (s.awards[k]! > 1 ? `${label} ${s.awards[k]}` : label)),
    teams,
    look: playerLook(c.p),
    color: c.team?.color ?? NO_TEAM_COLOR,
  };
}

/* ---------- 그리기 ---------- */

const C = {
  bg0: "#121A2B",
  bg1: "#0A0F1A",
  stripe: "rgba(255,255,255,.025)",
  gold: "#F5C542",
  gold2: "#C8961E",
  accent: "#EE6A2A",
  ink: "#F2F5FA",
  muted: "#93A0B3",
  line: "rgba(255,255,255,.12)",
};
const F = {
  display: '"Black Han Sans", "IBM Plex Sans KR", sans-serif',
  body: '"IBM Plex Sans KR", sans-serif',
  num: '"Saira Condensed", "IBM Plex Sans KR", sans-serif',
};

type Ctx = CanvasRenderingContext2D;

function text(ctx: Ctx, s: string, x: number, y: number, font: string, color: string, align: CanvasTextAlign = "left"): number {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.fillText(s, x, y);
  return ctx.measureText(s).width;
}

/** 폭 안에 들어가도록 글자 크기를 줄여서 써요. */
function fitText(ctx: Ctx, s: string, x: number, y: number, family: string, weight: number, size: number, min: number, maxW: number, color: string): void {
  let px = size;
  ctx.font = `${weight} ${px}px ${family}`;
  while (px > min && ctx.measureText(s).width > maxW) {
    px -= 2;
    ctx.font = `${weight} ${px}px ${family}`;
  }
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.fillText(s, x, y, maxW);
}

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

const METAL: Record<"gold" | "silver" | "bronze", [string, string, string]> = {
  gold: ["#FFF0B3", "#F5C542", "#A87A12"],
  silver: ["#FFFFFF", "#C9D0DA", "#7D8794"],
  bronze: ["#FFD9B8", "#D08A50", "#8A4E22"],
};

function metal(ctx: Ctx, kind: keyof typeof METAL, x: number, y: number, w: number): CanvasGradient {
  const g = ctx.createLinearGradient(x - w / 2, y, x + w / 2, y);
  const [hi, mid, lo] = METAL[kind];
  g.addColorStop(0, mid);
  g.addColorStop(0.35, hi);
  g.addColorStop(1, lo);
  return g;
}

/** 트로피 하나. (x, y)는 아래 가운데, h는 전체 높이예요. */
function drawTrophy(ctx: Ctx, kind: TrophyKind, x: number, y: number, h: number): void {
  ctx.save();
  if (kind === "medal") {
    const r = h * 0.25;
    const cy = y - r - 2;
    // 리본
    ctx.fillStyle = "#D23B3B";
    ctx.beginPath();
    ctx.moveTo(x - r * 0.95, y - h);
    ctx.lineTo(x - r * 0.1, y - h);
    ctx.lineTo(x + r * 0.35, cy - r * 0.6);
    ctx.lineTo(x - r * 0.3, cy - r * 0.4);
    ctx.fill();
    ctx.fillStyle = "#2F5FD0";
    ctx.beginPath();
    ctx.moveTo(x + r * 0.95, y - h);
    ctx.lineTo(x + r * 0.1, y - h);
    ctx.lineTo(x - r * 0.35, cy - r * 0.6);
    ctx.lineTo(x + r * 0.3, cy - r * 0.4);
    ctx.fill();
    ctx.fillStyle = metal(ctx, "gold", x, cy, r * 2);
    ctx.beginPath();
    ctx.arc(x, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(120,80,0,.6)";
    ctx.lineWidth = h * 0.025;
    ctx.beginPath();
    ctx.arc(x, cy, r * 0.68, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    return;
  }
  const s = kind === "amateur" ? h * 0.82 : h;
  const tone = kind === "nba" ? "gold" : kind === "pro" ? "silver" : "bronze";
  const top = y - s;
  const cw = s * 0.6; // 컵 너비
  const ch = s * 0.5; // 컵 높이
  // 받침
  ctx.fillStyle = "#3A2A1A";
  roundRect(ctx, x - s * 0.3, y - s * 0.14, s * 0.6, s * 0.14, s * 0.03);
  ctx.fill();
  const fill = metal(ctx, tone, x, top, cw);
  ctx.fillStyle = fill;
  roundRect(ctx, x - s * 0.22, y - s * 0.22, s * 0.44, s * 0.08, s * 0.02);
  ctx.fill();
  // 기둥
  ctx.fillRect(x - s * 0.05, top + ch - s * 0.02, s * 0.1, s * 0.24);
  // 손잡이
  ctx.strokeStyle = fill;
  ctx.lineWidth = s * 0.06;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(x + side * cw * 0.5, top + ch * 0.32, s * 0.12, s * 0.15, 0, side < 0 ? Math.PI * 0.5 : -Math.PI * 0.5, side < 0 ? Math.PI * 1.5 : Math.PI * 0.5);
    ctx.stroke();
  }
  // 컵
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(x - cw / 2, top);
  ctx.lineTo(x + cw / 2, top);
  ctx.bezierCurveTo(x + cw / 2, top + ch * 0.75, x + cw * 0.2, top + ch, x, top + ch);
  ctx.bezierCurveTo(x - cw * 0.2, top + ch, x - cw / 2, top + ch * 0.75, x - cw / 2, top);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,.35)";
  ctx.fillRect(x - cw / 2, top, cw, s * 0.04);
  ctx.restore();
}

const images = new Map<string, Promise<HTMLImageElement | null>>();
function loadImage(src: string): Promise<HTMLImageElement | null> {
  let p = images.get(src);
  if (!p) {
    p = new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
    images.set(src, p);
  }
  return p;
}

/** 팀 엠블럼 (너비 w, 높이 w*1.1). 로고가 있으면 흰 바탕 위에 로고를, 없으면 화면과 같은 자체 엠블럼을 그려요. */
async function drawBadge(ctx: Ctx, name: string, x: number, y: number, w: number): Promise<void> {
  const h = (w * 44) / 40;
  const logo = LOGOS[name];
  const img = logo ? await loadImage(logo) : null;
  if (img) {
    ctx.fillStyle = "#FFFFFF";
    roundRect(ctx, x, y + (h - w) / 2, w, w, w * 0.24);
    ctx.fill();
    const pad = w * 0.1;
    const box = w - pad * 2;
    const k = Math.min(box / img.naturalWidth, box / img.naturalHeight);
    const iw = img.naturalWidth * k;
    const ih = img.naturalHeight * k;
    ctx.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
    return;
  }
  const e = emblemOf(name);
  if (!e) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(w / 40, w / 40);
  const shape = new Path2D(SHAPES[e.kind]);
  ctx.fillStyle = e.fill;
  ctx.fill(shape);
  const pattern = PATTERNS[e.pattern];
  if (pattern) {
    ctx.save();
    ctx.clip(shape);
    ctx.fillStyle = e.accent;
    ctx.fill(new Path2D(pattern));
    ctx.restore();
  }
  ctx.save();
  ctx.translate(20, 22);
  ctx.scale(0.86, 0.86);
  ctx.translate(-20, -22);
  ctx.globalAlpha = 0.35;
  ctx.strokeStyle = e.ink;
  ctx.lineWidth = 1.2;
  ctx.stroke(shape);
  ctx.restore();
  ctx.strokeStyle = e.edge;
  ctx.lineWidth = 1.6;
  ctx.stroke(shape);
  ctx.font = e.latin ? `700 ${monoSize(e)}px ${F.num}` : `400 ${monoSize(e)}px ${F.display}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = e.edge;
  ctx.strokeText(e.mono, 20, 23);
  ctx.fillStyle = e.ink;
  ctx.fillText(e.mono, 20, 23);
  ctx.restore();
}

/** 카드에 쓰는 글꼴을 미리 불러와요. 안 불러오면 캔버스가 기본 글꼴로 그려요. */
async function loadFonts(d: CardData): Promise<void> {
  if (typeof document === "undefined" || !document.fonts) return;
  const all = [d.name, d.legacy, d.line, d.nat, ...d.pills, ...d.big.flat(), ...d.small.flat(), SITE_NAME, "PEAK OVR RINGS 우승 반지 시즌"].join(" ");
  await Promise.all(
    [`400 96px ${F.display}`, `700 30px ${F.body}`, `400 30px ${F.body}`, `700 90px ${F.num}`, `600 40px ${F.num}`].map((f) =>
      document.fonts.load(f, all).catch(() => []),
    ),
  );
}

/** 기록 카드를 그려 PNG로 돌려줘요. */
export async function drawCard(c: Career): Promise<Blob> {
  const d = cardData(c);
  await loadFonts(d);
  const canvas = document.createElement("canvas");
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext("2d")!;
  ctx.textBaseline = "alphabetic";
  const W = CARD_W;
  const mid = W / 2;

  // 바탕: 어두운 남색 + 사선 무늬 + 위쪽 금색 띠
  const bg = ctx.createLinearGradient(0, 0, 0, CARD_H);
  bg.addColorStop(0, C.bg0);
  bg.addColorStop(1, C.bg1);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, CARD_H);
  ctx.save();
  ctx.strokeStyle = C.stripe;
  ctx.lineWidth = 46;
  for (let x = -CARD_H; x < W; x += 130) {
    ctx.beginPath();
    ctx.moveTo(x, CARD_H);
    ctx.lineTo(x + CARD_H, 0);
    ctx.stroke();
  }
  ctx.restore();
  const band = ctx.createLinearGradient(0, 0, W, 0);
  band.addColorStop(0, C.gold2);
  band.addColorStop(0.5, C.gold);
  band.addColorStop(1, C.gold2);
  ctx.fillStyle = band;
  ctx.fillRect(0, 0, W, 10);

  // 위 줄: 게임 이름, 커리어 기간
  text(ctx, SITE_NAME, 64, 86, `700 30px ${F.body}`, C.muted);
  text(ctx, d.years, W - 64, 86, `600 34px ${F.num}`, C.muted, "right");

  // 가운데 선수 상자
  const box = 340;
  const bx = mid - box / 2;
  const by = 140;
  ctx.save();
  ctx.shadowColor = "rgba(245,197,66,.35)";
  ctx.shadowBlur = 40;
  const boxBg = ctx.createLinearGradient(0, by, 0, by + box);
  boxBg.addColorStop(0, "#F7F2E4");
  boxBg.addColorStop(1, "#E9DDBE");
  ctx.fillStyle = boxBg;
  roundRect(ctx, bx, by, box, box, 40);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = C.gold;
  ctx.lineWidth = 7;
  roundRect(ctx, bx, by, box, box, 40);
  ctx.stroke();
  ctx.fillStyle = "rgba(0,0,0,.12)";
  ctx.beginPath();
  ctx.ellipse(mid, by + box - 34, 80, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  drawSprite(ctx, d.look, d.color, 12, mid - 8 * 12, by + box - 24 * 12 - 30);

  // 왼쪽: 최고 오버롤, 포지션, 국적, 등번호
  const lx = 64;
  text(ctx, String(d.peak), lx, 290, `700 150px ${F.num}`, C.gold);
  text(ctx, "PEAK OVR", lx + 4, 330, `700 26px ${F.num}`, C.gold);
  text(ctx, d.pos, lx, 420, `700 64px ${F.num}`, C.ink);
  text(ctx, d.nat, lx + 2, 462, `400 28px ${F.body}`, C.muted);
  text(ctx, `No.${d.num}`, lx + 2, 506, `700 36px ${F.num}`, C.ink);

  // 오른쪽: 우승 반지
  const rx = W - 64;
  text(ctx, String(d.rings), rx, 290, `700 150px ${F.num}`, d.rings ? C.gold : C.muted, "right");
  text(ctx, "RINGS", rx - 4, 330, `700 26px ${F.num}`, d.rings ? C.gold : C.muted, "right");
  text(ctx, "우승 반지", rx - 2, 370, `400 28px ${F.body}`, C.muted, "right");

  // 이름, 수식어, 커리어 한 줄
  fitText(ctx, d.name, mid, 584, F.display, 400, 96, 48, W - 120, C.ink);
  fitText(ctx, d.legacy, mid, 638, F.body, 700, 36, 24, W - 140, C.accent);
  fitText(ctx, d.line, mid, 686, F.body, 400, 30, 22, W - 140, C.muted);

  // 트로피 줄
  let y = 806;
  if (d.trophies.length) {
    const step = 76;
    const n = d.trophies.length + (d.moreTrophies ? 1 : 0);
    let x = mid - ((n - 1) * step) / 2;
    for (const t of d.trophies) {
      drawTrophy(ctx, t, x, y, 78);
      x += step;
    }
    if (d.moreTrophies) text(ctx, `+${d.moreTrophies}`, x, y - 26, `700 34px ${F.num}`, C.gold, "center");
  } else {
    text(ctx, "우승 없이 걸어온 길", mid, y - 30, `400 28px ${F.body}`, C.muted, "center");
  }

  // 구분선
  const rule = (yy: number) => {
    ctx.fillStyle = C.line;
    ctx.fillRect(64, yy, W - 128, 2);
  };
  rule(842);

  // 통산 기록: 큰 줄, 작은 줄
  const col = (W - 128) / 3;
  y = 956;
  d.big.forEach(([v, label], i) => {
    const cx = 64 + col * i + col / 2;
    fitText(ctx, v, cx, y, F.num, 700, 96, 56, col - 24, C.ink);
    text(ctx, label, cx, y + 44, `700 28px ${F.body}`, C.gold, "center");
    if (i) {
      ctx.fillStyle = C.line;
      ctx.fillRect(64 + col * i, y - 80, 2, 200);
    }
  });
  y = 1070;
  d.small.forEach(([v, label], i) => {
    const cx = 64 + col * i + col / 2;
    text(ctx, v, cx, y, `600 46px ${F.num}`, C.ink, "center");
    text(ctx, label, cx, y + 36, `400 24px ${F.body}`, C.muted, "center");
  });
  rule(1134);

  // 주요 상: 금색 테두리 알약
  y = 1156;
  if (d.pills.length) {
    ctx.font = `700 28px ${F.body}`;
    const pw = d.pills.map((p) => ctx.measureText(p).width + 48);
    const gap = 16;
    const total = pw.reduce((t, w) => t + w, 0) + gap * (pw.length - 1);
    let x = mid - Math.min(total, W - 128) / 2;
    d.pills.forEach((p, i) => {
      if (x + pw[i] > W - 64) return;
      ctx.fillStyle = "rgba(245,197,66,.12)";
      roundRect(ctx, x, y, pw[i], 54, 27);
      ctx.fill();
      ctx.strokeStyle = C.gold;
      ctx.lineWidth = 2;
      ctx.stroke();
      text(ctx, p, x + pw[i] / 2, y + 37, `700 28px ${F.body}`, C.gold, "center");
      x += pw[i] + gap;
    });
  }

  // 거쳐간 팀: 엠블럼과 뛴 시즌 수
  y = d.pills.length ? 1238 : 1170;
  const tw = Math.min(170, (W - 128) / Math.max(1, d.teams.length));
  let tx = mid - (tw * d.teams.length) / 2;
  for (const t of d.teams) {
    await drawBadge(ctx, t.name, tx + tw / 2 - 30, y, 60);
    text(ctx, `${t.seasons}시즌`, tx + tw / 2, y + 66 + 28, `400 24px ${F.body}`, C.muted, "center");
    tx += tw;
  }

  // 아래: 사이트 주소
  text(ctx, SITE_URL.replace(/^https?:\/\//, ""), mid, CARD_H - 30, `700 26px ${F.body}`, C.muted, "center");

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob"))), "image/png"));
}
