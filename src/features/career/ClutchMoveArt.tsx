"use client";

import type { ClutchMove, Look } from "@/game";
import type { Mood } from "@/shared/ui/sprite/Sprite";
import { drawPosed, type PosedExtra } from "@/shared/ui/sprite/coverArt";

/**
 * 클러치 성공 이펙트 위에 그리는 플레이 장면. 고른 플레이마다 장면이 달라요.
 * 슛은 공이 그물을 통과하고, 덩크는 이를 악물고 림에 매달려 림과 백보드가 흔들리고,
 * 노룩 패스는 왼쪽 동료를 보며 패스하는 척해 수비를 끌어낸 뒤 비워진 오른쪽 동료에게 보지도 않고 찔러 줘요.
 * 수비는 블록슛·가로채기·끝까지 막아 림을 맞고 튕겨 나가는 장면, 차징 유도는 돌진한 상대에 부딪힌 내가 뒤로 넘어지고 심판이 공격자 파울 신호를 줘요.
 * 선수는 게임 캐릭터로 그려요. 나는 내 캐릭터에 우리 팀 유니폼, 상대는 상대 팀 유니폼을 입어요.
 * 크기는 실제 규격에 맞췄어요(1m = 46단위, 바닥 y=192): 림 높이 3.05m, 백보드 1.8×1.05m, 선수 키 2m.
 * 공과 림은 캐릭터가 머리와 손이 큰 체형이라 실제(공 0.24m, 림 0.45m)보다 키워, 손에 든 공이 손·머리 크기와 어울리게 했어요.
 * 공(지름 17)과 림(지름 26)의 비율은 실제와 비슷하게 두어 공이 림을 넉넉히 통과해요.
 * 장면은 1.25초 동안 움직이고, 결정적인 순간(hit)에 장면 이름이 튀어나와요. 그 순간에 맞춰 제목과 꽃가루가 이어져요.
 * 움직임을 줄인 설정이면 결정적인 순간의 한 장면만 멈춰 보여줘요.
 */
export const MOVE_INFO: Record<ClutchMove, { tag: string; hit: number }> = {
  shot: { tag: "SWISH", hit: 0.85 },
  three: { tag: "3 POINTER", hit: 0.85 },
  dunk: { tag: "SLAM DUNK", hit: 0.6 },
  drive: { tag: "BLOW BY", hit: 0.97 },
  pass: { tag: "NO LOOK", hit: 0.73 },
  lockdown: { tag: "LOCKDOWN", hit: 0.75 },
  block: { tag: "BLOCKED", hit: 0.56 },
  steal: { tag: "STEAL", hit: 0.6 },
  charge: { tag: "CHARGE", hit: 0.55 },
};

const LABEL: Record<ClutchMove, string> = {
  shot: "공이 림을 건드리지 않고 그물만 가르며 들어가는 장면",
  three: "3점 라인 밖에서 던진 공이 그물만 가르며 들어가는 장면",
  dunk: "이를 악물고 림에 매달려 내리꽂은 덩크에 림과 백보드가 흔들리는 장면",
  drive: "수비 둘을 제치고 들어가 레이업을 올리는 장면",
  pass: "왼쪽 동료에게 패스하는 척 수비를 끌어내고, 비워진 오른쪽 동료에게 보지도 않고 찔러 주는 노룩 패스 장면",
  lockdown: "끝까지 따라붙은 수비에 상대 슛이 림을 맞고 튕겨 나가는 장면",
  block: "상대 슛을 손바닥으로 쳐 내는 블록슛 장면",
  steal: "패스 길목에 손을 뻗어 공을 가로채는 장면",
  charge: "자리를 지키고 선 내가 돌진하는 상대에 부딪혀 뒤로 넘어지고, 심판이 휘슬을 불며 공격자 파울 신호를 주는 장면",
};
const FAILURE_TAG: Record<ClutchMove, string> = {
  shot: "RIM OUT", three: "RIM OUT", dunk: "DENIED", drive: "STRIPPED",
  pass: "INTERCEPTED", lockdown: "SCORED", block: "TOO LATE", steal: "MISSED", charge: "NO CALL",
};
const FAILURE_LABEL: Record<ClutchMove, string> = {
  shot: "슛이 림을 맞고 튕겨 나가는 장면",
  three: "3점슛이 림을 맞고 튕겨 나가는 장면",
  dunk: "덩크가 림에 막혀 튕겨 나가는 장면",
  drive: "돌파 중 드리블한 공을 수비에게 빼앗기는 장면",
  pass: "노룩 패스가 상대 수비에게 가로채이는 장면",
  lockdown: "밀착 수비를 뚫고 상대 슛이 들어가는 장면",
  block: "블록슛 시도가 늦어 상대 슛이 들어가는 장면",
  steal: "가로채기 시도가 빗나가 상대 패스가 이어지는 장면",
  charge: "몸을 부딪쳤지만 공격자 파울이 선언되지 않는 장면",
};

/** 장면에 나오는 사람들: 내 캐릭터와 유니폼 색, 상대 유니폼 색, 상대 생김새를 고르는 씨앗(상대 팀 이름) */
export interface ClutchCast {
  look: Look;
  color: string;
  oppColor?: string;
  seed?: string;
}

/** 상대 선수 생김새. 상대 팀 이름으로 순서를 정해서 같은 팀이면 같은 얼굴이 나와요. */
const OPP_LOOKS: Look[] = [
  { kind: "black", skin: "#5A3620", hair: "#161210", style: "fade", beard: "none", eyes: "#3A2416" },
  { kind: "white", skin: "#EBC6A8", hair: "#5A3A22", style: "spiky", beard: "stubble", eyes: "#3B6EA5" },
  { kind: "black", skin: "#8A5634", hair: "#161210", style: "afro", beard: "goatee", eyes: "#2A1A10" },
  { kind: "hispanic", skin: "#C98F62", hair: "#1B1B1B", style: "buzz", beard: "none", eyes: "#4A2E1A" },
];
/** 노룩 패스를 받는 동료와 미끼가 되는 동료 */
const MATE_LOOK: Look = { kind: "white", skin: "#F2D3BC", hair: "#C8A060", style: "curtain", beard: "none", eyes: "#3B6EA5" };
const DECOY_LOOK: Look = { kind: "black", skin: "#6B4128", hair: "#161210", style: "buzz", beard: "none", eyes: "#2A1A10" };
/** 심판 */
const REF_LOOK: Look = { kind: "white", skin: "#E8C2A4", hair: "#8A8A8A", style: "buzz", beard: "none", eyes: "#4A2E1A" };
const NAVY = "#232A3B";

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

type Pt = [number, number];
interface Who {
  look: Look;
  color: string;
}
interface Cast {
  me: Who;
  mate: Who;
  decoy: Who;
  opp: (i: number) => Who;
}

function castOf(c: ClutchCast): Cast {
  const oppColor = !c.oppColor || c.oppColor.toLowerCase() === c.color.toLowerCase() ? NAVY : c.oppColor;
  const base = hash(c.seed ?? "");
  return {
    me: { look: c.look, color: c.color },
    mate: { look: MATE_LOOK, color: c.color },
    decoy: { look: DECOY_LOOK, color: c.color },
    opp: (i) => ({ look: OPP_LOOKS[(base + i) % OPP_LOOKS.length], color: oppColor }),
  };
}

export function ClutchMoveArt({ move, cast, win, revealed }: { move: ClutchMove; cast: ClutchCast; win: boolean; revealed: boolean }) {
  return (
    <div className="mv" data-move={move} data-outcome={win ? "win" : "lose"} style={{ "--hit": `${MOVE_INFO[move].hit}s` } as React.CSSProperties}>
      <svg className="mv-scene" viewBox="0 0 240 200" role="img" aria-label={revealed ? win ? LABEL[move] : FAILURE_LABEL[move] : "클러치 플레이 진행 중"}>
        <line className="mv-floor" x1="0" y1="192.5" x2="240" y2="192.5" />
        {(win ? SCENES : FAILURE_SCENES)[move](castOf(cast))}
      </svg>
      {revealed && <span className="mv-tag" aria-hidden="true">{win ? MOVE_INFO[move].tag : FAILURE_TAG[move]}</span>}
    </div>
  );
}


/* ---------- 선수 ---------- */

/** 캐릭터 판(160x240)에서 캔버스로 그리는 범위. 손이 판 밖으로 뻗어도 잘리지 않게 넓혀요. */
const BOX = { left: 30, top: 20, w: 220, h: 260 };
/** 캐릭터 판 한 단위가 장면에서 차지하는 크기. 발끝까지 231이 92단위(키 2m)가 돼요. */
const S = 0.4;
const DENSITY = 2;
const urls = new Map<string, string>();

/** 손 위치와 표정을 정한 캐릭터 그림. 같은 그림은 한 번만 그려요. 서버에서는 그리지 않아요(이펙트는 화면에서만 떠요). */
function posedUrl(who: Who, lh: Pt, rh: Pt, mood: Mood, tilt: number, outfit?: PosedExtra["outfit"]): string | null {
  if (typeof document === "undefined") return null;
  const key = JSON.stringify([who, lh, rh, mood, tilt, outfit]);
  const hit = urls.get(key);
  if (hit) return hit;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(BOX.w * DENSITY);
  canvas.height = Math.round(BOX.h * DENSITY);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.setTransform(DENSITY, 0, 0, DENSITY, BOX.left * DENSITY, BOX.top * DENSITY);
  drawPosed(ctx, who.look, who.color, lh, rh, mood, { tilt, outfit });
  const url = canvas.toDataURL();
  urls.set(key, url);
  return url;
}

/**
 * 선수 한 명. 발끝 가운데가 (0,0)이에요. lh·rh는 캐릭터 판 좌표의 손 위치(어깨는 (51,100)·(109,100), 팔 길이 56)예요.
 * 장면에서 손은 ((x-80)×0.4, (y-231)×0.4)에 와요. 예: 슛 자세 오른손 (118,46)은 발에서 (15,-74).
 */
function Player({
  who,
  lh = [42, 152],
  rh = [118, 152],
  mood = "focus",
  tilt = 0,
  outfit,
  className,
}: {
  who: Who;
  lh?: Pt;
  rh?: Pt;
  mood?: Mood;
  tilt?: number;
  /** 기본은 유니폼. 심판은 "ref"예요. */
  outfit?: PosedExtra["outfit"];
  className?: string;
}) {
  const href = posedUrl(who, lh, rh, mood, tilt, outfit);
  if (!href) return null;
  return <image className={className} href={href} x={-(80 + BOX.left) * S} y={-(231 + BOX.top) * S} width={BOX.w * S} height={BOX.h * S} />;
}

/* 자주 쓰는 손 위치 (캐릭터 판 좌표) */
/** 오른손을 머리 위로 들어 올린 슛 자세 (왼손은 공을 받쳐요). 공은 발에서 (16,-80)에 있어요. */
const SHOOT = { lh: [88, 62] as Pt, rh: [118, 46] as Pt };
/** 두 팔을 양옆으로 벌린 수비 자세 */
const SPREAD = { lh: [8, 118] as Pt, rh: [152, 118] as Pt };

/* ---------- 부품 ---------- */

/** 농구공(반지름 8.5). 중심이 (0,0)이에요. */
function Ball({ r = 8.5 }: { r?: number }) {
  const d = r * 0.71;
  return (
    <>
      <circle className="mv-ball-b" r={r} />
      <path className="mv-ball-l" d={`M${-r} 0H${r}M0 ${-r}V${r}M${-d} ${-d}Q${-r * 0.2} 0 ${-d} ${d}M${d} ${-d}Q${r * 0.2} 0 ${d} ${d}`} />
    </>
  );
}

/**
 * 백보드와 림 뒤쪽. 림 중심이 (0,0)이에요(바닥에서 3.05m). 림 앞쪽과 그물은 HoopFront로 공 위에 그려요.
 * 백보드는 폭 1.8m·높이 1.05m에 아래 끝이 림보다 0.15m 낮아요. 림(지름 26)과 안쪽 사각형은 공에 맞춰 실제보다 1.25배 키웠고, 사각형 아래 끝이 림 높이예요.
 */
function HoopBack() {
  return (
    <>
      <g className="mv-board">
        <rect className="mv-glass" x="-41.5" y="-41.5" width="83" height="48.5" rx="1.5" />
        <rect className="mv-glass-sq" x="-17" y="-26" width="34" height="26" />
      </g>
      <g className="mv-rimfx">
        <path className="mv-rim" d="M-13 0A13 3.25 0 0 1 13 0" />
      </g>
    </>
  );
}

/** 그물: 림 지름의 0.93배 길이로 내려오며 아래쪽이 좁아져요(림과 같이 1.25배로 그려요). */
const NET =
  "M-10.4 0-5.8 19M10.4 0 5.8 19M-10.4 0-2.9 19M-5.2 2 2.9 19M0 2.6 5.8 19M5.2 2 0 19M10.4 0 2.9 19M-5.2 2-5.8 19M0 2.6-2.9 19M5.2 2 0 19M-8.6 8H8.6M-7 14H7";

function HoopFront() {
  return (
    <g className="mv-rimfx">
      <g className="mv-net">
        <path d={NET} transform="scale(1.25)" />
      </g>
      <path className="mv-rim" d="M-13 0A13 3.25 0 0 0 13 0" />
    </g>
  );
}

/** 부딪히는 순간 퍼지는 충격선 */
function Burst({ x, y, r = 16 }: { x: number; y: number; r?: number }) {
  const d = Array.from({ length: 8 }, (_, i) => {
    const a = (i * Math.PI) / 4 + 0.2;
    const [c, s] = [Math.cos(a), Math.sin(a)];
    return `M${(c * r * 0.55).toFixed(1)} ${(s * r * 0.55).toFixed(1)}L${(c * r).toFixed(1)} ${(s * r).toFixed(1)}`;
  }).join("");
  return (
    <g transform={`translate(${x} ${y})`}>
      <path className="mv-burst" d={d} />
    </g>
  );
}

/** 물음표: 속거나 제쳐진 수비 머리 위 */
function Huh() {
  return (
    <text className="mv-q" x="-4" y="-98">
      ?
    </text>
  );
}

/* ---------- 장면 ---------- */

/** 슛·3점슛: 뛰어올라 던진 공이 포물선(최고 높이 약 3.9m)을 그리며 림 한가운데로 떨어져요. */
function ShotScene({ cast, three, fail = false }: { cast: Cast; three?: boolean; fail?: boolean }) {
  const sx = three ? 26 : 52;
  return (
    <>
      {three && <path className="mv-arc3" d="M2 199Q38 186 74 199" />}
      <g transform={`translate(${sx} 192)`}>
        <g className="mv-shooter">
          <Player who={cast.me} {...SHOOT} />
          {fail && <Player who={cast.me} {...SHOOT} mood="nervous" className="mv-result-face" />}
        </g>
      </g>
      <path className="mv-trail" pathLength={1} d={three ? "M42 98Q119 -50.8 196 52" : "M68 98Q132 -46.7 196 52"} />
      <g transform="translate(196 52)">
        <HoopBack />
      </g>
      <g className="mv-ball mv-ball-shot">
        <Ball />
      </g>
      <g transform="translate(196 52)">
        <HoopFront />
        <path className="mv-spark" d="M-18 -4-25 -9M18 -4 25 -9M-17 5-24 8M17 5 24 8" />
      </g>
    </>
  );
}

/** 덩크: 달려와 뛰어올라 이를 악물고 한 손으로 림 위에서 내리꽂고 매달려요. 머리는 림 옆에 와요. */
function DunkScene({ cast }: { cast: Cast }) {
  return (
    <>
      <g transform="translate(170 52)">
        <HoopBack />
      </g>
      <g className="mv-dunker">
        <Player who={cast.me} lh={[30, 120]} rh={[118, 46]} mood="strain" />
      </g>
      <g className="mv-ball mv-ball-dunk">
        <Ball />
      </g>
      <g transform="translate(170 52)">
        <HoopFront />
      </g>
      <Burst x={170} y={50} r={22} />
    </>
  );
}

/** 돌파: 낮게 드리블하며 수비 둘을 지나 골밑에서 뛰어올라 백보드를 맞혀 넣어요. 자세 그림 두 장을 바꿔 끼워요. */
function DriveScene({ cast }: { cast: Cast }) {
  return (
    <>
      <path className="mv-trail mv-trail-drive" pathLength={1} d="M22 178C70 182 120 176 150 180S184 96 192 40" />
      <g transform="translate(92 192)">
        <g className="mv-fall mv-fall-1">
          <Player who={cast.opp(0)} {...SPREAD} mood="nervous" />
          <Huh />
        </g>
      </g>
      <g transform="translate(140 192)">
        <g className="mv-fall mv-fall-2">
          <Player who={cast.opp(1)} {...SPREAD} mood="nervous" />
          <Huh />
        </g>
      </g>
      <g transform="translate(196 52)">
        <HoopBack />
      </g>
      <g transform="translate(0 192)">
        <g className="mv-driver">
          <Player who={cast.me} rh={[126, 150]} className="mv-dribble" />
          <Player who={cast.me} {...SHOOT} className="mv-layup" />
        </g>
      </g>
      <g className="mv-ball mv-ball-drive">
        <Ball />
      </g>
      <g transform="translate(196 52)">
        <HoopFront />
      </g>
      <path className="mv-speed" d="M0 150H14M-2 160H12M2 170H16" />
    </>
  );
}

/**
 * 노룩 패스: 왼쪽 동료를 쳐다보며 왼손으로 공을 내밀어 패스하는 척해요. 오른쪽 길목을 막던 수비가 그 패스를 끊으러 왼쪽으로 몸을 던지면,
 * 고개는 왼쪽에 둔 채 비워진 오른쪽 동료에게 오른손으로 찔러 줘요. 속은 수비 머리 위에 물음표가 떠요.
 * 내 자세 그림 두 장(패스하는 척 → 진짜 패스)을 바꿔 끼워요.
 */
function PassScene({ cast }: { cast: Cast }) {
  return (
    <>
      <g transform="translate(18 192)">
        <Player who={cast.decoy} lh={[44, 48]} rh={[116, 48]} mood="beam" />
      </g>
      <g transform="translate(214 192)">
        <Player who={cast.mate} lh={[44, 48]} rh={[116, 48]} mood="beam" />
      </g>
      <g transform="translate(124 192)">
        <Player who={cast.me} lh={[14, 104]} rh={[100, 150]} mood="focus" tilt={-0.3} className="mv-fake" />
        <Player who={cast.me} lh={[40, 150]} rh={[166, 112]} mood="smirk" tilt={-0.3} className="mv-real" />
        <path className="mv-gaze" d="M-16 -80-62 -96M-16 -72-62 -72" />
      </g>
      <path className="mv-feint" d="M92 141H48M56 134 46 141 56 148" />
      <g transform="translate(166 192)">
        <g className="mv-bite">
          <Player who={cast.opp(0)} {...SPREAD} mood="nervous" />
          <Huh />
        </g>
      </g>
      <circle className="mv-catch" cx="214" cy="114" r="14" />
      <g className="mv-ball mv-ball-pass">
        <Ball />
        <path className="mv-whoosh" d="M-9 -4H-26M-9 0H-32M-9 4H-26" />
      </g>
    </>
  );
}

/** 끝까지 막기: 붙어서 손을 뻗은 수비에 상대 슛이 짧아져 림 앞쪽을 맞고 튕겨 나가요. */
function LockdownScene({ cast, fail = false }: { cast: Cast; fail?: boolean }) {
  return (
    <>
      <g transform="translate(60 192)">
        <g className="mv-shooter">
          <Player who={cast.opp(0)} {...SHOOT} mood={fail ? "focus" : "nervous"} />
        </g>
      </g>
      <g transform="translate(104 192)">
        <g className="mv-contest">
          <Player who={cast.me} rh={[116, 46]} lh={[30, 140]} />
          {fail && <Player who={cast.me} rh={[116, 46]} lh={[30, 140]} mood="nervous" className="mv-fail-face" />}
        </g>
      </g>
      <g transform="translate(196 52)">
        <HoopBack />
      </g>
      <g className="mv-ball mv-ball-clank">
        <Ball />
      </g>
      <g transform="translate(196 52)">
        <HoopFront />
      </g>
      <Burst x={186} y={48} r={10} />
    </>
  );
}

/** 블록슛: 슛을 쏘는 순간 붙어서 뛰어오른 손바닥이 공을 쳐 내요. 공이 돌며 화면 밖으로 날아가요. */
function BlockScene({ cast, fail = false }: { cast: Cast; fail?: boolean }) {
  return (
    <>
      <g transform="translate(196 52)">
        <HoopBack />
        <HoopFront />
      </g>
      <g transform="translate(46 192)">
        <g className="mv-shooter">
          <Player who={cast.opp(0)} {...SHOOT} mood={fail ? "focus" : "nervous"} />
        </g>
      </g>
      <g transform="translate(94 192)">
        <g className="mv-jump">
          <Player who={cast.me} lh={[60, 48]} rh={[120, 46]} />
          {fail && <Player who={cast.me} lh={[60, 48]} rh={[120, 46]} mood="nervous" className="mv-fail-face" />}
        </g>
      </g>
      <g className="mv-ball mv-ball-block">
        <Ball />
      </g>
      <Burst x={108} y={74} r={14} />
    </>
  );
}

/** 가로채기: 패스 길목에 몸을 던져 공을 낚아채요. 끊긴 길목에 X가 그어져요. */
function StealScene({ cast, fail = false }: { cast: Cast; fail?: boolean }) {
  return (
    <>
      <line className="mv-lane" x1="66" y1="132" x2="176" y2="132" />
      <g transform="translate(30 192)">
        <Player who={cast.opp(0)} rh={[160, 80]} mood={fail ? "focus" : "nervous"} />
      </g>
      <g transform="translate(212 192)">
        <Player who={cast.opp(1)} lh={[0, 80]} mood={fail ? "focus" : "nervous"} />
      </g>
      <path className="mv-x" d="M160 126 172 138M172 126 160 138" />
      <g transform="translate(124 192)">
        <g className="mv-lunge">
          <Player who={cast.me} lh={[20, 130]} rh={[130, 50]} />
          {fail && <Player who={cast.me} lh={[20, 130]} rh={[130, 50]} mood="nervous" className="mv-fail-face" />}
          <path className="mv-speed" d="M-28 -60H-48M-30 -46H-54M-28 -32H-46" />
        </g>
      </g>
      <g className="mv-ball mv-ball-steal">
        <Ball />
      </g>
      <Burst x={142} y={126} r={12} />
    </>
  );
}

/**
 * 차징 유도: 팔짱을 끼고 자리를 지킨 내게 공을 든 상대가 오른쪽에서 돌진해 부딪혀요. 나는 뒤로 벌러덩 넘어지고,
 * 부딪힌 상대는 공을 놓친 채 두 팔을 들고 억울해해요. 왼쪽에서 지켜보던 심판이 휘슬을 불고,
 * 한 손을 뒷머리에 얹은 뒤 다른 손으로 방향을 가리키는 공격자 파울(차징) 신호를 줘요.
 */
function ChargeScene({ cast }: { cast: Cast }) {
  return (
    <>
      <g transform="translate(22 192)">
        <Player who={REF} outfit="ref" lh={[40, 150]} rh={[120, 150]} className="mv-ref-watch" />
        <Player who={REF} outfit="ref" lh={[38, 50]} rh={[164, 96]} className="mv-ref-call" />
        <g transform="translate(-4 -62) scale(-1 1)">
          <path className="mv-whistle-b" d="M-4 -2.4H3A3.4 3.4 0 1 1-0.6 2.4H-4z" />
          <circle className="mv-whistle-h" cx="3" cy="1" r="1.2" />
        </g>
        <path className="mv-wave" d="M-20 -72Q-24 -66-20 -60M-26 -76Q-32 -66-26 -56" />
      </g>
      <g transform="translate(150 192)">
        <g className="mv-flop">
          <Player who={cast.me} lh={[100, 128]} rh={[60, 128]} className="mv-stand" />
          <Player who={cast.me} lh={[8, 76]} rh={[152, 76]} mood="nervous" className="mv-down" />
        </g>
      </g>
      <g transform="translate(182 192)">
        <g className="mv-charger">
          <Player who={cast.opp(0)} lh={[30, 150]} className="mv-run" />
          <Player who={cast.opp(0)} lh={[30, 64]} rh={[130, 64]} mood="nervous" className="mv-protest" />
        </g>
      </g>
      <g className="mv-ball mv-ball-loose">
        <Ball />
      </g>
      <Burst x={166} y={146} r={14} />
    </>
  );
}

/** 심판: 줄무늬 심판복은 색을 쓰지 않아요. */
const REF: Who = { look: REF_LOOK, color: "#1B1D22" };

const SCENES: Record<ClutchMove, (cast: Cast) => React.ReactNode> = {
  shot: (c) => <ShotScene cast={c} />,
  three: (c) => <ShotScene cast={c} three />,
  dunk: (c) => <DunkScene cast={c} />,
  drive: (c) => <DriveScene cast={c} />,
  pass: (c) => <PassScene cast={c} />,
  lockdown: (c) => <LockdownScene cast={c} />,
  block: (c) => <BlockScene cast={c} />,
  steal: (c) => <StealScene cast={c} />,
  charge: (c) => <ChargeScene cast={c} />,
};

/** 실패 장면도 고른 플레이를 따라가요. 수비는 성공 장면의 같은 상황에서 결과만 갈라져요. */
function MissDunkScene({ cast }: { cast: Cast }) {
  return <>
    <g transform="translate(170 52)"><HoopBack /><HoopFront /></g>
    <g className="mv-fail-dunker">
      <Player who={cast.me} lh={[30, 120]} rh={[118, 46]} mood="strain" />
      <Player who={cast.me} lh={[30, 120]} rh={[118, 46]} mood="nervous" className="mv-fail-face" />
    </g>
    <g className="mv-fail-ball mv-fail-dunk-ball"><Ball /></g>
    <Burst x={170} y={49} r={15} />
  </>;
}

function TurnoverScene({ cast }: { cast: Cast }) {
  return <>
    <g className="mv-fail-driver">
      <Player who={cast.me} rh={[126, 150]} />
      <Player who={cast.me} rh={[126, 150]} mood="nervous" className="mv-fail-face" />
    </g>
    <g transform="translate(157 192)"><Player who={cast.opp(0)} lh={[18, 120]} rh={[120, 124]} /></g>
    <g className="mv-fail-ball mv-fail-drive-ball"><Ball /></g>
    <Burst x={143} y={147} r={12} />
  </>;
}

function InterceptScene({ cast }: { cast: Cast }) {
  return <>
    <g transform="translate(64 192)">
      <Player who={cast.me} rh={[160, 112]} />
      <Player who={cast.me} rh={[160, 112]} mood="nervous" className="mv-fail-face" />
    </g>
    <g transform="translate(174 192)">
      <Player who={cast.mate} lh={[8, 112]} />
      <Player who={cast.mate} lh={[8, 112]} mood="nervous" className="mv-fail-face" />
    </g>
    <g transform="translate(138 192)"><Player who={cast.opp(0)} lh={[20, 100]} rh={[130, 54]} /></g>
    <g className="mv-fail-ball mv-fail-pass-ball"><Ball /></g>
    <Burst x={139} y={120} r={12} />
  </>;
}

const FAILURE_SCENES: Record<ClutchMove, (cast: Cast) => React.ReactNode> = {
  shot: (c) => <ShotScene cast={c} fail />,
  three: (c) => <ShotScene cast={c} three fail />,
  dunk: (c) => <MissDunkScene cast={c} />,
  drive: (c) => <TurnoverScene cast={c} />,
  pass: (c) => <InterceptScene cast={c} />,
  lockdown: (c) => <LockdownScene cast={c} fail />,
  block: (c) => <BlockScene cast={c} fail />,
  steal: (c) => <StealScene cast={c} fail />,
  charge: (c) => <ChargeScene cast={c} />,
};
