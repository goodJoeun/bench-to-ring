type Ctx = CanvasRenderingContext2D;

/** Plank joints get wider and farther apart toward the courtside camera. */
export function hardwood(ctx: Ctx, width: number, top: number, bottom: number, night = false) {
  const depth = bottom - top;
  const varnish = ctx.createLinearGradient(0, top, 0, bottom);
  varnish.addColorStop(0, night ? "#745439" : "#b98557");
  varnish.addColorStop(0.44, night ? "#896649" : "#e2b581");
  varnish.addColorStop(1, night ? "#634832" : "#cd9867");
  ctx.fillStyle = varnish;
  ctx.fillRect(0, top, width, depth);
  for (let row = 0; row < 8; row++) {
    const y = top + depth * (row / 8) ** 1.65;
    const next = top + depth * ((row + 1) / 8) ** 1.65;
    const span = 35 + 12 * row;
    let plank = 0;
    for (let x = -span * ((row * 0.38) % 1); x < width; x += span, plank++) {
      ctx.fillStyle = (row + plank * 3) % 5 < 2 ? "rgba(255,228,180,0.095)" : "rgba(108,59,37,0.045)";
      ctx.fillRect(x, y, span, next - y);
      ctx.fillStyle = "rgba(95,60,42,0.17)";
      ctx.fillRect(x, y, 0.7, next - y);
    }
    ctx.fillStyle = "rgba(114,76,56,0.16)";
    ctx.fillRect(0, y, width, 0.7);
  }
}

/** A courtside portrait, with quiet stands behind the player's face. */
export function portraitCourt(ctx: Ctx, width: number, height: number, team: string, compact: boolean, withShadow: boolean) {
  const baseline = height * 0.60;
  const roof = ctx.createLinearGradient(0, 0, 0, baseline);
  roof.addColorStop(0, "#1a243a");
  roof.addColorStop(1, "#44546a");
  ctx.fillStyle = roof;
  ctx.fillRect(0, 0, width, baseline);
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#485369";
  ctx.beginPath();
  for (let x = -20; x < width; x += 60) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 32, 21);
    ctx.lineTo(x + 60, 0);
  }
  ctx.moveTo(0, 21);
  ctx.lineTo(width, 21);
  ctx.stroke();

  for (let x = 24; x < width; x += 124) {
    const bloom = ctx.createRadialGradient(x, 22, 1, x, 22, 35);
    bloom.addColorStop(0, "rgba(255,234,184,0.28)");
    bloom.addColorStop(1, "rgba(255,234,184,0)");
    ctx.fillStyle = bloom;
    ctx.fillRect(x - 35, 0, 70, 57);
    ctx.fillStyle = "#ffe9bb";
    ctx.fillRect(x - 5, 20, 11, 2.5);
  }

  const fans = ["#515d70", "#81746b", "#626c7c", "#686277", "#59687a"];
  for (let row = 0; row < 4; row++) {
    const y = baseline - 54 + row * 11;
    ctx.fillStyle = "#2c374a";
    ctx.fillRect(0, y + 5, width, 4);
    for (let x = (row % 2) * 8, seat = 0; x < width; x += 17, seat++) {
      if ((seat + row * 2) % 8 === 0) continue;
      ctx.fillStyle = fans[(seat * 3 + row) % fans.length];
      ctx.beginPath();
      ctx.arc(x, y - 2, 2.2, 0, Math.PI * 2);
      ctx.moveTo(x - 4.5, y + 5);
      ctx.quadraticCurveTo(x, y - 5, x + 4.5, y + 5);
      ctx.fill();
    }
  }
  ctx.fillStyle = "#202d40";
  ctx.fillRect(0, baseline - 13, width, 13);
  ctx.fillStyle = team;
  ctx.fillRect(0, baseline - 9, width, 4);
  courtFloor(ctx, width, height, baseline);
  if (!withShadow) return;
  playerShadow(ctx, compact ? 48 : 64, height - (compact ? 4 : 19), compact ? 24 : 39, compact ? 3 : 5);
}

/** 바닥 나무와 코트 선 */
function courtFloor(ctx: Ctx, width: number, height: number, baseline: number) {
  hardwood(ctx, width, baseline, height);
  ctx.strokeStyle = "rgba(255,248,225,0.78)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(33, baseline);
  ctx.lineTo(-18, height);
  ctx.moveTo(62, baseline);
  ctx.lineTo(112, height);
  ctx.moveTo(67, baseline + 8);
  ctx.ellipse(45, baseline + 8, 22, 5, 0, 0, Math.PI * 2);
  ctx.stroke();
}

/** 선수 발밑의 흐린 그림자: (x, y)가 가운데, 가로·세로 반지름 */
function playerShadow(ctx: Ctx, x: number, y: number, rx: number, ry: number) {
  const shadow = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  shadow.addColorStop(0, "rgba(63,42,38,0.32)");
  shadow.addColorStop(1, "rgba(63,42,38,0)");
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(rx, ry);
  ctx.fillStyle = shadow;
  ctx.fillRect(-1, -1, 2, 2);
  ctx.restore();
}

/* ---------- 은퇴 엔딩: 레거시만큼 화려해지는 배경 ---------- */

/**
 * 엔딩 배경을 그리는 데 필요한 것: 마지막 팀 색, 화려함 단계, 등번호, 우승 반지 수.
 * 단계(level)는 0 동네 체육관 → 1 텅 빈 관중석 → 2 꽉 차가는 관중석 → 3 조명과 플래시 → 4 영구 결번 배너
 * → 5 금빛 명예의 전당 → 6 불꽃놀이와 금빛 꽃가루 → 7 GOAT: 금빛 햇살과 관중의 휴대폰 불빛이에요. 단계가 오르면 앞 단계 것을 모두 가져요.
 */
export interface LegacyStage {
  team: string;
  level: number;
  num: number;
  rings: number;
}

/** 엔딩에서 선수 캐릭터가 서는 자리(CourtStage 왼쪽 칸 가운데)와, 바닥에서 발끝까지 */
const PX = 64;
const FEET_UP = 19;

/** 그릴 때마다 같은 자리에 흩뿌리는 점 */
function dots(n: number, seed: number): [number, number][] {
  let s = seed;
  const next = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  return Array.from({ length: n }, () => [next(), next()]);
}

function mixHex(a: string, b: string, k: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (sh: number) => Math.round(((pa >> sh) & 255) * (1 - k) + ((pb >> sh) & 255) * k);
  return `#${((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1)}`;
}

function star(ctx: Ctx, x: number, y: number, r: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const d = i % 2 ? r * 0.45 : r;
    ctx.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d);
  }
  ctx.closePath();
  ctx.fill();
}

function twinkle(ctx: Ctx, x: number, y: number, r: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.quadraticCurveTo(x, y, x, y + r);
  ctx.quadraticCurveTo(x, y, x - r, y);
  ctx.quadraticCurveTo(x, y, x, y - r);
  ctx.fill();
}

/** 천장에 매단 배너: 아래 끝이 V자로 파였어요. (x, top)이 위 가운데예요. */
function banner(ctx: Ctx, x: number, top: number, w: number, h: number, body: string, trim: string) {
  const path = (inset: number) => {
    ctx.beginPath();
    ctx.moveTo(x - w / 2 + inset, top);
    ctx.lineTo(x + w / 2 - inset, top);
    ctx.lineTo(x + w / 2 - inset, top + h - inset);
    ctx.lineTo(x, top + h - 6 - inset * 0.4);
    ctx.lineTo(x - w / 2 + inset, top + h - inset);
    ctx.closePath();
  };
  ctx.fillStyle = trim;
  path(0);
  ctx.fill();
  ctx.fillStyle = body;
  path(2);
  ctx.fill();
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.fillRect(x - w / 2, top, w, 2);
}

/** 프로 무대를 밟지 못한 선수: 햇살 드는 학교 체육관. 관중석 없이 창과 벽 매트만 있어요. */
function schoolGym(ctx: Ctx, width: number, height: number, baseline: number) {
  const wall = ctx.createLinearGradient(0, 0, 0, baseline);
  wall.addColorStop(0, "#e8dcc4");
  wall.addColorStop(1, "#cdb994");
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, width, baseline);
  for (let x = 14; x < width; x += 76) {
    ctx.fillStyle = "#9c8b6f";
    ctx.fillRect(x - 2, 12, 56, 38);
    ctx.fillStyle = "#eef5f3";
    ctx.fillRect(x, 14, 52, 34);
    ctx.fillStyle = "#d3e2e0";
    ctx.beginPath();
    ctx.moveTo(x, 40);
    ctx.lineTo(x + 52, 22);
    ctx.lineTo(x + 52, 48);
    ctx.lineTo(x, 48);
    ctx.fill();
    ctx.fillStyle = "#9c8b6f";
    ctx.fillRect(x + 25, 14, 2, 34);
    // 창에서 바닥으로 비스듬히 드는 햇살
    ctx.fillStyle = "rgba(255,246,214,0.16)";
    ctx.beginPath();
    ctx.moveTo(x, 48);
    ctx.lineTo(x + 52, 48);
    ctx.lineTo(x + 92, baseline);
    ctx.lineTo(x + 40, baseline);
    ctx.fill();
  }
  // 벽 아래 보호 매트
  ctx.fillStyle = "#5f7894";
  ctx.fillRect(0, baseline - 34, width, 30);
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  for (let x = 0; x < width; x += 30) ctx.fillRect(x, baseline - 34, 1.5, 30);
  ctx.fillStyle = "#4b6078";
  ctx.fillRect(0, baseline - 6, width, 6);
  courtFloor(ctx, width, height, baseline);
}

/** 엔딩 배경에서 움직이지 않는 부분. 단계마다 관중·조명·배너가 늘고 빛깔이 금빛으로 바뀌어요. */
export function legacyCourt(ctx: Ctx, width: number, height: number, o: LegacyStage) {
  const { level, team } = o;
  const baseline = height * 0.6;
  if (level <= 0) {
    schoolGym(ctx, width, height, baseline);
    playerShadow(ctx, PX, height - FEET_UP, 39, 5);
    return;
  }
  const gold = level >= 5;
  // 지붕: 단계가 오를수록 깊은 남색에서 보랏빛, 금빛 노을로
  const roof = ctx.createLinearGradient(0, 0, 0, baseline);
  const top = ["#1a243a", "#1a243a", "#18213a", "#151c36", "#141a34", "#1b1736", "#1c1236", "#22103a"][level];
  const low = ["#44546a", "#44546a", "#40506a", "#3a4767", "#36436a", "#4a3f62", "#5a3f5c", "#7a4a3c"][level];
  roof.addColorStop(0, top);
  roof.addColorStop(1, low);
  ctx.fillStyle = roof;
  ctx.fillRect(0, 0, width, baseline);

  // 천장 트러스
  ctx.lineWidth = 2;
  ctx.strokeStyle = gold ? "#6b5a48" : "#485369";
  ctx.beginPath();
  for (let x = -20; x < width; x += 60) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 32, 21);
    ctx.lineTo(x + 60, 0);
  }
  ctx.moveTo(0, 21);
  ctx.lineTo(width, 21);
  ctx.stroke();

  // 조명: 단계 3부터 두 배로 늘고 더 크게 번져요. 금빛 단계는 조명도 금빛이에요.
  const lampGap = level >= 3 ? 62 : 124;
  const bloomR = level >= 3 ? 46 : 35;
  const lampColor = gold ? "255,214,120" : "255,234,184";
  for (let x = 24; x < width; x += lampGap) {
    const bloom = ctx.createRadialGradient(x, 22, 1, x, 22, bloomR);
    bloom.addColorStop(0, `rgba(${lampColor},${level >= 3 ? 0.38 : 0.28})`);
    bloom.addColorStop(1, `rgba(${lampColor},0)`);
    ctx.fillStyle = bloom;
    ctx.fillRect(x - bloomR, 0, bloomR * 2, bloomR + 22);
    ctx.fillStyle = gold ? "#ffe3a0" : "#ffe9bb";
    ctx.fillRect(x - 5, 20, 11, 2.5);
  }

  // 천장 배너 (단계 4부터): 선수 머리 위에 영구 결번 배너, 그 옆으로 우승 배너를 반지 수만큼
  if (level >= 4) {
    for (let i = 0; i < Math.min(o.rings, 8); i++) {
      const x = 62 + i * 22;
      banner(ctx, x, 22, 18, 30, "#B8841C", "#F5C443");
      star(ctx, x, 34, 5, "#FFF1A8");
      ctx.fillStyle = "rgba(255,241,168,0.85)";
      ctx.fillRect(x - 5, 42, 10, 1.6);
    }
    const jx = 30;
    banner(ctx, jx, 22, 28, 46, team, gold ? "#F5C443" : "#F4F4F4");
    if (gold) star(ctx, jx, 31, 4.5, "#F5C443");
    ctx.fillStyle = "#FFFFFF";
    ctx.font = '800 15px "Arial Narrow", sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(o.num), jx, gold ? 46 : 42);
    ctx.fillStyle = gold ? "#F5C443" : "rgba(255,255,255,0.75)";
    ctx.fillRect(jx - 8, 55, 16, 1.6);
  }

  // 관중석: 단계마다 빈자리가 줄고, 우리 팀 색 옷이 늘어요. 단계 3부터 한 줄 더 높이 차요.
  const density = [0, 0.42, 0.72, 1, 1, 1, 1, 1][level];
  const teamShare = [0, 0.1, 0.3, 0.5, 0.55, 0.55, 0.6, 0.6][level];
  const fans = ["#515d70", "#81746b", "#626c7c", "#686277", "#59687a"];
  const rows = level >= 3 ? 5 : 4;
  const seats = dots(400, 11);
  for (let row = 0; row < rows; row++) {
    const y = baseline - 54 + (row - (rows - 4)) * 11;
    ctx.fillStyle = gold ? "#2f2a3c" : "#2c374a";
    ctx.fillRect(0, y + 5, width, 4);
    for (let x = (row % 2) * 8, seat = 0; x < width; x += 17, seat++) {
      const [u, v] = seats[(seat * 5 + row * 37) % seats.length];
      if (u > density) continue;
      const shirt = v < teamShare ? (v < teamShare * 0.75 ? team : "#F4F4F4") : fans[(seat * 3 + row) % fans.length];
      // 뒷줄일수록 어둑해요. 텅 빈 관중석(단계 1)은 조명도 덜 받아 더 어두워요.
      ctx.fillStyle = mixHex(shirt, "#1a2030", (level <= 1 ? 0.5 : 0.3) - row * 0.05);
      ctx.beginPath();
      ctx.arc(x, y - 2, 2.2, 0, Math.PI * 2);
      ctx.moveTo(x - 4.5, y + 5);
      ctx.quadraticCurveTo(x, y - 5, x + 4.5, y + 5);
      ctx.fill();
    }
  }
  // 관중석 앞 벽과 팀 색 띠(단계 2부터), 금빛 단계는 금테를 둘러요.
  ctx.fillStyle = "#202d40";
  ctx.fillRect(0, baseline - 13, width, 13);
  if (level >= 2) {
    ctx.fillStyle = team;
    ctx.fillRect(0, baseline - 9, width, 4);
  }
  if (gold) {
    ctx.fillStyle = "#F5C443";
    ctx.fillRect(0, baseline - 13, width, 1.5);
    ctx.fillRect(0, baseline - 1.5, width, 1.5);
  }
  courtFloor(ctx, width, height, baseline);

  // 선수를 비추는 두 줄기 조명과 발밑 빛 웅덩이 (단계 3부터)
  if (level >= 3) {
    const beam = gold ? "255,214,120" : "255,246,220";
    ctx.save();
    ctx.globalAlpha = gold ? 0.2 : 0.13;
    ctx.fillStyle = `rgb(${beam})`;
    for (const sx of [PX - 46, PX + 74]) {
      ctx.beginPath();
      ctx.moveTo(sx - 7, 0);
      ctx.lineTo(sx + 7, 0);
      ctx.lineTo(PX + 30, height - FEET_UP);
      ctx.lineTo(PX - 30, height - FEET_UP);
      ctx.fill();
    }
    ctx.restore();
    const pool = ctx.createRadialGradient(PX, height - FEET_UP, 2, PX, height - FEET_UP, 70);
    pool.addColorStop(0, `rgba(${beam},${gold ? 0.5 : 0.32})`);
    pool.addColorStop(1, `rgba(${beam},0)`);
    ctx.save();
    ctx.translate(0, height - FEET_UP);
    ctx.scale(1, 0.22);
    ctx.translate(0, -(height - FEET_UP));
    ctx.fillStyle = pool;
    ctx.fillRect(PX - 70, height - FEET_UP - 70, 140, 140);
    ctx.restore();
  }
  playerShadow(ctx, PX, height - FEET_UP, 39, 5);
}

/** 엔딩 배경에서 움직이는 부분(단계 3부터). t는 화면에 나온 뒤 지난 초예요. 움직이지 않는 배경 위, 선수 캐릭터 뒤에 그려요. */
export function legacyCourtFx(ctx: Ctx, width: number, height: number, o: LegacyStage, t: number) {
  const { level, team } = o;
  if (level < 3) return;
  const baseline = height * 0.6;
  // 단계 3부터 관중석이 다섯 줄이에요(legacyCourt).
  const standTop = baseline - 65;
  const chest: [number, number] = [PX, height - 95];

  // GOAT: 선수 뒤에서 천천히 도는 금빛 햇살
  if (level >= 7) {
    const r = Math.hypot(width, height);
    const glow = ctx.createRadialGradient(chest[0], chest[1], 6, chest[0], chest[1], r * 0.55);
    glow.addColorStop(0, "rgba(255,220,120,0.42)");
    glow.addColorStop(1, "rgba(255,220,120,0)");
    ctx.save();
    ctx.fillStyle = glow;
    ctx.beginPath();
    for (let i = 0; i < 16; i++) {
      const a = t * 0.12 + (i * Math.PI) / 8;
      ctx.moveTo(chest[0], chest[1]);
      ctx.arc(chest[0], chest[1], r, a, a + Math.PI / 16);
      ctx.closePath();
    }
    ctx.fill();
    ctx.restore();
  }

  // 관중석 카메라 플래시 (단계가 오를수록 많이)
  const flashes = dots(3 + level * 2, 23);
  flashes.forEach(([u, v], i) => {
    const k = ((t + i * 0.37) % 2.2) / 0.22;
    if (k > 1) return;
    const x = u * width;
    const y = standTop + v * 44;
    const a = 1 - k;
    const g = ctx.createRadialGradient(x, y, 0, x, y, 10);
    g.addColorStop(0, `rgba(255,255,255,${0.7 * a})`);
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - 10, y - 10, 20, 20);
    twinkle(ctx, x, y, 3 + 3 * a, `rgba(255,255,255,${a})`);
  });

  // GOAT: 관중석을 채운 휴대폰 불빛
  if (level >= 7)
    dots(46, 71).forEach(([u, v], i) => {
      const a = 0.35 + 0.65 * Math.max(0, Math.sin(t * 2.2 + i * 1.7));
      ctx.fillStyle = `rgba(255,250,225,${a})`;
      ctx.fillRect(u * width, standTop + v * 46, 1.6, 2.2);
    });

  // 불꽃놀이 (단계 6부터): 천장 아래에서 터져 퍼졌다 떨어지며 사라져요. 하나는 늘 선수 머리 위 칸에서 터져요.
  if (level >= 6) {
    const spots = level >= 7 ? 4 : 2;
    const colors = ["#FFD66B", mixHex(team, "#FFFFFF", 0.45), "#FFFFFF", "#FF8FA3", "#8FE3FF"];
    const where = dots(spots * 4, 5);
    for (let s = 0; s < spots; s++) {
      const period = 2.8;
      const tau = (t + s * (period / spots)) % period;
      const round = Math.floor((t + s * (period / spots)) / period);
      const [u, v] = where[(s * 4 + round) % where.length];
      const bx = s === 0 ? 40 + u * 60 : u * width;
      const by = 30 + v * 40;
      if (tau < 0.35) {
        // 솟아오르는 불꽃 줄기
        const k = tau / 0.35;
        const y = baseline - (baseline - by) * k;
        ctx.fillStyle = "rgba(255,230,170,0.9)";
        ctx.fillRect(bx - 1, y, 2, 8);
        continue;
      }
      const k = (tau - 0.35) / 1.5;
      if (k > 1) continue;
      const spread = 30 * (1 - Math.exp(-4 * k)) * (level >= 7 ? 1.2 : 1);
      const drop = 12 * k * k;
      const color = colors[(s + round) % colors.length];
      ctx.save();
      ctx.globalAlpha = 1 - k;
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * Math.PI * 2;
        const x = bx + Math.cos(a) * spread;
        const y = by + Math.sin(a) * spread + drop;
        ctx.fillStyle = i % 3 ? color : "#FFFFFF";
        ctx.beginPath();
        ctx.arc(x, y, 1.7, 0, Math.PI * 2);
        ctx.fill();
        // 꼬리
        ctx.strokeStyle = color;
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(bx + Math.cos(a) * spread * 0.6, by + Math.sin(a) * spread * 0.6 + drop * 0.6);
        ctx.stroke();
      }
      if (k < 0.15) twinkle(ctx, bx, by, 10, `rgba(255,255,255,${1 - k / 0.15})`);
      ctx.restore();
    }
  }

  // 금빛 반짝이 (단계 5부터): 선수 둘레에서 천천히 떠올라요.
  if (level >= 5) {
    const n = 10 + (level - 5) * 8;
    dots(n, 41).forEach(([u, v], i) => {
      const x = i % 2 ? PX + (u - 0.5) * 120 : u * width;
      const y = height - ((t * (10 + v * 10) + v * height) % height);
      const r = 1.5 + 2.5 * (0.5 + 0.5 * Math.sin(t * 3 + i));
      twinkle(ctx, x, y, r, i % 3 ? "#FFE58A" : "#FFFFFF");
    });
  }

  // 금빛 꽃가루 (단계 6부터): 위에서 팔랑이며 계속 내려요.
  if (level >= 6) {
    const n = level >= 7 ? 34 : 20;
    const colors = ["#F5C443", "#FFE58A", "#FFFFFF", team];
    dots(n, 97).forEach(([u, v], i) => {
      const y = -6 + ((t * (22 + v * 18) + v * height) % (height + 12));
      const x = u * width + Math.sin(t * 1.6 + i) * 6;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(t * 2.4 + i);
      ctx.scale(1, 0.3 + 0.7 * Math.abs(Math.cos(t * 5 + i)));
      ctx.fillStyle = colors[i % colors.length];
      ctx.fillRect(-2.5, -1.5, 5, 3);
      ctx.restore();
    });
  }
}
