/**
 * 구단 로고를 준비해요.
 * 1. logos-src/에 넣은 원본(PNG·JPG·WebP·SVG·GIF, 크기 상관없음)을 128×128 투명 PNG로 바꿔 public/logos/에 저장해요.
 *    가장자리에 붙은 흰 배경을 지우고, 둘레 여백을 잘라내고, 비율을 지킨 채 가운데에 맞추고, 가장자리에 조금 여백을 둬요.
 *    원본과 이 스크립트가 바뀌지 않았으면 건너뛰어요.
 * 2. public/logos/의 파일을 팀 이름과 연결해 src/components/common/logos.generated.ts를 만들어요.
 *
 * 원본 파일 이름은 게임 속 이름과 똑같이 짓거나("보스턴 셀틱스.svg"), 영문 팀 이름이 들어 있으면 돼요
 * ("boston_celtics_logo_primary.png" → "public/logos/보스턴 셀틱스.png"). 영문 이름은 아래 ALIASES 표로 찾아요.
 * 국가대표는 나라 이름("대한민국"), 군 부대는 "상무 (국군체육부대)"처럼요.
 * public/logos/에 직접 넣은 파일도 그대로 써요(변환하지 않아요).
 *
 * npm run logos            변환·연결 결과와 함께 로고가 없는 팀의 파일 이름을 리그별로 모두 보여줘요.
 * npm run logos -- --quiet 요약만 보여줘요. npm run dev / build 전에 저절로 이렇게 돌아요.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const SRC = "logos-src";
const DIR = "public/logos";
const OUT = "src/components/common/logos.generated.ts";
/** 결과 크기와 둘레 여백 (px) */
const SIZE = 128;
const PAD = 6;
/** 이보다 작은 원본은 늘리면 흐려질 수 있어 알려줘요. */
const SMALL = 64;
const EXT = /\.(png|svg|webp|jpe?g)$/i;
const SRC_EXT = /\.(png|svg|webp|jpe?g|gif)$/i;
const quiet = process.argv.includes("--quiet");
const CLEAR = { r: 0, g: 0, b: 0, alpha: 0 };
/** 이만큼 밝으면(세 채널 모두) 흰 배경으로 봐요. 지운 곳과 맞닿은 SOFT 이상 밝은 가장자리는 반투명하게 해요. */
const WHITE = 236;
const SOFT = 200;
/** 이 스크립트가 바뀌면(변환 방식이 바뀌면) 원본을 모두 다시 변환해요. */
const SCRIPT_TIME = statSync(fileURLToPath(import.meta.url)).mtimeMs;

/**
 * 흰 배경 위에 그려진 로고(투명하지 않은 PNG, JPG)의 배경을 지워요. px는 RGBA 픽셀이고 그 자리에서 바꿔요.
 * 테두리 대부분이 불투명한 흰색일 때만, 테두리에서 이어진 흰 픽셀만 지워서 로고 안쪽 흰색은 남겨요. 지웠으면 true예요.
 */
function clearWhiteBackground(px, w, h) {
  const whiteish = (i, min) => px[i * 4 + 3] >= 250 && Math.min(px[i * 4], px[i * 4 + 1], px[i * 4 + 2]) >= min;
  const edge = [];
  for (let x = 0; x < w; x++) edge.push(x, (h - 1) * w + x);
  for (let y = 1; y < h - 1; y++) edge.push(y * w, y * w + w - 1);
  // 로고가 가장자리에 닿아 있을 수 있어 테두리의 60%, 그리고 네 모서리 중 셋 이상이 흰색이면 흰 배경으로 봐요.
  const corners = [0, w - 1, (h - 1) * w, h * w - 1].filter((i) => whiteish(i, WHITE)).length;
  if (corners < 3 || edge.filter((i) => whiteish(i, WHITE)).length / edge.length < 0.6) return false;

  const seen = new Uint8Array(w * h);
  const queue = new Int32Array(w * h);
  let head = 0;
  let tail = 0;
  const push = (i) => {
    if (!seen[i] && whiteish(i, WHITE)) {
      seen[i] = 1;
      queue[tail++] = i;
    }
  };
  edge.forEach(push);
  while (head < tail) {
    const i = queue[head++];
    px[i * 4 + 3] = 0;
    const x = i % w;
    if (x > 0) push(i - 1);
    if (x < w - 1) push(i + 1);
    if (i >= w) push(i - w);
    if (i < w * (h - 1)) push(i + w);
  }
  // 지운 곳과 맞닿은 밝은 가장자리(안티에일리어싱)를 반투명하게 해 흰 테두리가 남지 않게 해요.
  for (let i = 0; i < w * h; i++) {
    if (seen[i] || px[i * 4 + 3] === 0) continue;
    const x = i % w;
    const near = (x > 0 && seen[i - 1]) || (x < w - 1 && seen[i + 1]) || (i >= w && seen[i - w]) || (i < w * (h - 1) && seen[i + w]);
    const m = Math.min(px[i * 4], px[i * 4 + 1], px[i * 4 + 2]);
    if (near && m >= SOFT) px[i * 4 + 3] = Math.round((px[i * 4 + 3] * (255 - m)) / (255 - SOFT));
  }
  return true;
}

/* ---------- 게임 속 이름 모으기: 엔진 소스에서 읽어요 ---------- */

const LEAGUE_NAMES = { hs: "고교", kuniv: "U-리그", ncaa: "NCAA", kbl: "KBL", gleague: "G리그", euro: "유로리그", nba: "NBA" };

/** [묶음 이름, 이름 목록] */
const groups = [];
const leagues = readFileSync("src/game/leagues.ts", "utf8");
const teamsBlock = leagues.slice(leagues.indexOf("export const TEAMS"));
let current = null;
for (const line of teamsBlock.split("\n")) {
  const head = line.match(/^ {2}(\w+): \[$/);
  if (head) {
    current = [LEAGUE_NAMES[head[1]] ?? head[1], []];
    groups.push(current);
    continue;
  }
  const team = line.match(/^ {4}\["([^"]+)", "#[0-9A-Fa-f]{6}"\]/);
  if (team && current) current[1].push(team[1]);
  if (line.startsWith("};")) break;
}
const nations = [...readFileSync("src/game/national.ts", "utf8").matchAll(/^ {2}\{ name: "([^"]+)", power:/gm)].map((m) => m[1]);
const units = [...readFileSync("src/game/military.ts", "utf8").matchAll(/^export const (?:SANGMU|ARMY) = \{ name: "([^"]+)"/gm)].map((m) => m[1]);
groups.push(["국가대표", nations], ["군 부대", units]);
const known = new Set(groups.flatMap(([, names]) => names));

/**
 * 영문 파일 이름으로 받은 로고를 게임 속 이름과 잇는 표.
 * 파일 이름에서 영문·숫자만 소문자로 이어 붙인 글자에 이 열쇠가 들어 있으면 그 팀이에요.
 * 같은 애칭을 쓰는 G리그 팀과 헷갈리지 않게 연고지까지 붙여 써요.
 */
const ALIASES = {
  "애틀랜타 호크스": ["atlantahawks"],
  "보스턴 셀틱스": ["bostonceltics"],
  "브루클린 네츠": ["brooklynnets"],
  "샬럿 호네츠": ["charlottehornets"],
  "시카고 불스": ["chicagobulls"],
  "클리블랜드 캐벌리어스": ["clevelandcavaliers"],
  "댈러스 매버릭스": ["dallasmavericks"],
  "덴버 너기츠": ["denvernuggets"],
  "디트로이트 피스톤스": ["detroitpistons"],
  "골든스테이트 워리어스": ["goldenstatewarriors"],
  "휴스턴 로키츠": ["houstonrockets"],
  "인디애나 페이서스": ["indianapacers"],
  "LA 클리퍼스": ["losangelesclippers", "laclippers"],
  "LA 레이커스": ["losangeleslakers", "lalakers"],
  "멤피스 그리즐리스": ["memphisgrizzlies"],
  "마이애미 히트": ["miamiheat"],
  "밀워키 벅스": ["milwaukeebucks"],
  "미네소타 팀버울브스": ["minnesotatimberwolves"],
  "뉴올리언스 펠리컨스": ["neworleanspelicans"],
  "뉴욕 닉스": ["newyorkknicks"],
  "오클라호마시티 썬더": ["oklahomacitythunder"],
  "올랜도 매직": ["orlandomagic"],
  "필라델피아 76ers": ["philadelphia76ers"],
  "피닉스 선즈": ["phoenixsuns"],
  "포틀랜드 트레일블레이저스": ["portlandtrailblazers"],
  "새크라멘토 킹스": ["sacramentokings"],
  "샌안토니오 스퍼스": ["sanantoniospurs"],
  "토론토 랩터스": ["torontoraptors"],
  "유타 재즈": ["utahjazz"],
  "워싱턴 위저즈": ["washingtonwizards"],
};

/** 원본 파일이 어느 이름의 로고인지: 게임 속 이름 그대로면 그 이름, 아니면 영문 이름 표로 찾고, 못 찾으면 파일 이름 그대로 */
function targetOf(file) {
  const base = file.replace(SRC_EXT, "").normalize("NFC");
  if (known.has(base)) return base;
  const key = base.toLowerCase().replace(/[^a-z0-9]/g, "");
  const hits = Object.keys(ALIASES).filter((name) => ALIASES[name].some((k) => key.includes(k)));
  return hits.length === 1 ? hits[0] : base;
}

/* ---------- 1. 원본 변환 ---------- */

mkdirSync(DIR, { recursive: true });
const sources = existsSync(SRC) ? readdirSync(SRC).filter((f) => SRC_EXT.test(f)) : [];
// 한 팀에 원본이 여럿이면 처음 것만 써요.
const claimed = new Map();
const dupes = [];
let converted = 0;
let skipped = 0;
const whitened = [];
const failed = [];
const small = [];
for (const f of sources) {
  const from = `${SRC}/${f}`;
  const target = targetOf(f);
  if (claimed.has(target)) {
    dupes.push(`${f} (${target}: ${claimed.get(target)}를 써요)`);
    continue;
  }
  claimed.set(target, f);
  const to = `${DIR}/${target}.png`;
  if (existsSync(to) && statSync(to).mtimeMs >= Math.max(statSync(from).mtimeMs, SCRIPT_TIME)) {
    skipped++;
    continue;
  }
  try {
    // SVG는 크게 그려서 줄여야 선이 깨끗해요.
    const { data, info } = await sharp(from, { density: 384, animated: false }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    if (clearWhiteBackground(data, info.width, info.height)) whitened.push(target);
    const input = () => sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } });
    let trimmed;
    try {
      trimmed = await input().trim().png().toBuffer({ resolveWithObject: true });
    } catch {
      // 한 가지 색뿐인 이미지는 잘라낼 여백이 없어요.
      trimmed = await input().png().toBuffer({ resolveWithObject: true });
    }
    const { width, height } = trimmed.info;
    if (Math.max(width, height) < SMALL) small.push(f);
    await sharp(trimmed.data)
      .resize(SIZE - PAD * 2, SIZE - PAD * 2, { fit: "contain", background: CLEAR })
      .extend({ top: PAD, bottom: PAD, left: PAD, right: PAD, background: CLEAR })
      .png({ compressionLevel: 9 })
      .toFile(to);
    converted++;
  } catch (e) {
    failed.push(`${f} (${e instanceof Error ? e.message : e})`);
  }
}
if (sources.length) console.log(`원본 ${sources.length}개 · 새로 변환 ${converted}개 · 그대로 ${skipped}개 (${SIZE}×${SIZE} 투명 PNG)`);
if (whitened.length) console.log(`흰 배경을 지운 로고 ${whitened.length}개: ${whitened.join(", ")}`);
if (small.length) console.log(`원본이 ${SMALL}px보다 작아 흐릴 수 있어요: ${small.join(", ")}`);
if (failed.length) console.log(`변환하지 못한 원본: ${failed.join(", ")}`);
if (dupes.length) console.log(`같은 팀 원본이 여럿이라 건너뛴 파일: ${dupes.join(", ")}`);

/* ---------- 2. 팀 이름과 연결 ---------- */

const files = readdirSync(DIR).filter((f) => EXT.test(f));
const logos = {};
for (const f of files) {
  const name = f.replace(EXT, "").normalize("NFC");
  // 같은 이름이 여러 형식으로 있으면 변환한 PNG를 써요.
  if (logos[name] && !/\.png$/i.test(f)) continue;
  logos[name] = `/logos/${encodeURIComponent(f)}`;
}

const entries = Object.keys(logos)
  .sort()
  .map((k) => `  ${JSON.stringify(k)}: ${JSON.stringify(logos[k])},`);
writeFileSync(
  OUT,
  [
    "/* scripts/logos.mjs가 public/logos/ 폴더를 보고 만든 파일이에요. 직접 고치지 마세요. */",
    "",
    "/** 팀 이름 → 로고 파일 경로. 여기 있는 팀은 엠블럼 대신 로고를 보여줘요. */",
    `export const LOGOS: Record<string, string> = {${entries.length ? `\n${entries.join("\n")}\n` : ""}};`,
    "",
  ].join("\n"),
);

/* ---------- 결과 알려주기 ---------- */

const all = [...known];
const missing = all.filter((n) => !logos[n]);
const unknown = Object.keys(logos).filter((k) => !known.has(k));
console.log(`로고 ${all.length - missing.length}개 연결 · 로고가 없는 이름 ${missing.length}개 (엠블럼으로 보여줘요)`);
if (unknown.length) console.log(`게임 속 이름과 맞지 않는 파일 ${unknown.length}개: ${unknown.map((k) => JSON.stringify(k)).join(", ")}`);
if (quiet || !missing.length) process.exit(0);

console.log(`\n로고가 없는 이름 · 아래 이름 그대로 ${SRC}/ 에 원본을 넣으세요 (PNG·JPG·WebP·SVG·GIF, 크기 상관없음. NBA는 영문 팀 이름이 든 파일도 돼요)`);
for (const [label, names] of groups) {
  const left = names.filter((n) => !logos[n]);
  if (!left.length) continue;
  console.log(`\n[${label}] ${left.length}/${names.length}개 없음`);
  for (const n of left) console.log(`  ${n}`);
}
