/**
 * 국기와 작은 로고를 각각 한 장의 WebP(아틀라스)로 묶어 public/atlas/에 두고,
 * 이름 → 칸 번호 목록 src/shared/ui/badge/atlas.generated.ts를 만들어요.
 * 이미지마다 CDN 요청이 한 건씩 생기는 것을 한 건으로 줄이고, 내려받는 용량도 줄여요.
 * flags.generated.ts와 logos.generated.ts를 읽으니 logos.mjs와 flags.mjs 다음에 돌려요.
 * 넣는 파일과 설정이 그대로면 다시 만들지 않아서, 컴퓨터마다 결과 파일이 달라지지 않아요.
 *
 * npm run atlas            결과를 보여줘요.
 * npm run atlas -- --quiet npm run dev / build 전에 저절로 이렇게 돌아요.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";

const DIR = "public/atlas";
const OUT = "src/shared/ui/badge/atlas.generated.ts";
/** 확대·축소할 때 옆 칸 색이 묻어나지 않게 칸 사이를 띄워요. */
const GAP = 2;
const QUALITY = 82;
/** 변환 방식을 바꾸면 올려서 다시 만들어요. */
const VERSION = 1;
const CLEAR = { r: 0, g: 0, b: 0, alpha: 0 };
const quiet = process.argv.includes("--quiet");

// 국기는 모든 크기(최대 56px)를 2배 화면까지, 로고는 목록에 쓰는 24px 이하를 3배 화면까지 선명하게 둬요.
const SHEETS = [
  { key: "flags", constName: "FLAG_ATLAS", list: "src/shared/ui/badge/flags.generated.ts", prefix: "/flags/", cell: 112 },
  { key: "logos", constName: "LOGO_ATLAS", list: "src/shared/ui/badge/logos.generated.ts", prefix: "/logos/", cell: 72 },
];

/** 생성된 목록에서 [이름, 파일 경로, 내용 해시]를 읽어요. */
function readEntries({ list, prefix }) {
  const re = /"([^"]+)": "(\/(?:flags|logos|leagues)\/[^"?]+)\?v=([0-9a-f]+)"/g;
  return [...readFileSync(list, "utf8").matchAll(re)]
    .filter((m) => m[2].startsWith(prefix))
    .map(([, name, path, hash]) => ({ name, file: `public${decodeURIComponent(path)}`, hash }));
}

const previous = existsSync(OUT) ? readFileSync(OUT, "utf8") : "";
mkdirSync(DIR, { recursive: true });

const blocks = [];
for (const sheet of SHEETS) {
  const entries = readEntries(sheet);
  // 같은 파일을 쓰는 이름은 한 칸을 함께 써요.
  const files = [...new Map(entries.map((e) => [e.file, e.hash]))].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const index = new Map(files.map(([file], i) => [file, i]));
  const cols = Math.ceil(Math.sqrt(files.length));
  const rows = Math.ceil(files.length / cols);
  const step = sheet.cell + GAP;
  const width = cols * step - GAP;
  const height = rows * step - GAP;
  const version = createHash("sha1").update(JSON.stringify([VERSION, QUALITY, GAP, sheet.cell, files.map(([f, h]) => [f.slice(f.lastIndexOf("/") + 1), h])])).digest("hex").slice(0, 8);
  const file = `${DIR}/${sheet.key}.webp`;
  const src = `/atlas/${sheet.key}.webp?v=${version}`;

  if (!existsSync(file) || !previous.includes(src)) {
    const parts = await Promise.all(
      files.map(async ([f], i) => {
        const input = readFileSync(f);
        const image = f.endsWith(".svg") ? sharp(input, { density: 300 }) : sharp(input);
        return {
          input: await image.resize(sheet.cell, sheet.cell, { fit: "contain", background: CLEAR }).png().toBuffer(),
          left: (i % cols) * step,
          top: Math.floor(i / cols) * step,
        };
      }),
    );
    await sharp({ create: { width, height, channels: 4, background: CLEAR } })
      .composite(parts)
      .webp({ quality: QUALITY, alphaQuality: 90, effort: 6, smartSubsample: true })
      .toFile(file);
  }
  if (!quiet) console.log(`${sheet.key}: ${files.length}칸 → ${file} ${(readFileSync(file).length / 1024).toFixed(1)}KB`);

  const at = entries
    .map((e) => [e.name, index.get(e.file)])
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([name, i]) => `    ${JSON.stringify(name)}: ${i},`);
  blocks.push(
    `export const ${sheet.constName}: AtlasSheet = {`,
    `  src: ${JSON.stringify(src)},`,
    `  cell: ${sheet.cell},`,
    `  step: ${step},`,
    `  cols: ${cols},`,
    `  width: ${width},`,
    `  height: ${height},`,
    "  at: {",
    ...at,
    "  },",
    "};",
    "",
  );
}

const next = [
  "/* scripts/atlas.mjs가 만든 파일이에요. 직접 고치지 마세요. */",
  "",
  "/** 여러 이미지를 묶은 한 장. at은 이름 → 칸 번호(왼쪽 위부터 가로로)예요. */",
  "export interface AtlasSheet {",
  "  src: string;",
  "  cell: number;",
  "  step: number;",
  "  cols: number;",
  "  width: number;",
  "  height: number;",
  "  at: Record<string, number>;",
  "}",
  "",
  ...blocks,
].join("\n");
if (next !== previous.replace(/\r\n/g, "\n")) writeFileSync(OUT, next);
