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
  if (!withShadow) return;
  const shadow = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  shadow.addColorStop(0, "rgba(63,42,38,0.32)");
  shadow.addColorStop(1, "rgba(63,42,38,0)");
  ctx.save();
  ctx.translate(compact ? 48 : 64, height - (compact ? 4 : 19));
  ctx.scale(compact ? 24 : 39, compact ? 3 : 5);
  ctx.fillStyle = shadow;
  ctx.fillRect(-1, -1, 2, 2);
  ctx.restore();
}
