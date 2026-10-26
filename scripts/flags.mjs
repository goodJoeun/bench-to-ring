/**
 * 국가대표 대회에 나오는 나라의 국기만 flag-icons 패키지(MIT)에서 public/flags/로 복사하고,
 * 나라 이름 → 국기 경로 목록 src/components/common/flags.generated.ts를 만들어요.
 * 나라 이름은 src/game/national.ts(대표팀 NATIONS, 대회 상대국)에서 읽어서, 상대국을 늘리면 국기도 따라 들어와요.
 *
 * npm run flags            결과와 국가 코드가 없는 나라를 알려줘요.
 * npm run flags -- --quiet 요약만. npm run dev / build 전에 저절로 이렇게 돌아요.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const SRC = "node_modules/flag-icons/flags/1x1";
const DIR = "public/flags";
const OUT = "src/components/common/flags.generated.ts";
const quiet = process.argv.includes("--quiet");

/**
 * 게임 속 나라 이름 → ISO 3166-1 국가 코드(flag-icons 파일 이름).
 * 대만은 국제 농구 대회에 '차이니즈 타이베이'로 나와 다른 깃발을 쓰는데 flag-icons에 그 깃발이 없어서, 일부러 비워 엠블럼으로 보여줘요.
 */
const CODES = {
  괌: "gu", 그리스: "gr", 남수단: "ss", 뉴질랜드: "nz", 대한민국: "kr", 도미니카공화국: "do", 독일: "de",
  라트비아: "lv", 레바논: "lb", 리투아니아: "lt", 멕시코: "mx", 몬테네그로: "me", 몽골: "mn", 미국: "us",
  바하마: "bs", 베네수엘라: "ve", 벨기에: "be", 보스니아: "ba", 브라질: "br", 사우디아라비아: "sa",
  세르비아: "rs", 스웨덴: "se", 스페인: "es", 슬로베니아: "si", 시리아: "sy", 아르헨티나: "ar", 앙골라: "ao",
  에스토니아: "ee", 영국: "gb", 요르단: "jo", 우루과이: "uy", 우크라이나: "ua", 이란: "ir", 이스라엘: "il",
  이집트: "eg", 이탈리아: "it", 인도: "in", 인도네시아: "id", 일본: "jp", 조지아: "ge", 중국: "cn", 체코: "cz",
  카보베르데: "cv", 카자흐스탄: "kz", 카타르: "qa", 캐나다: "ca", 콜롬비아: "co", 크로아티아: "hr",
  튀르키예: "tr", 파나마: "pa", 포르투갈: "pt", 폴란드: "pl", 푸에르토리코: "pr", 프랑스: "fr", 핀란드: "fi",
  필리핀: "ph", 호주: "au",
};
/** 국기 대신 엠블럼으로 보여줄 나라 (CODES에 없어도 경고하지 않아요) */
const NO_FLAG = new Set(["대만"]);

// 게임에 나오는 나라: 대표팀 목록과 대회 상대국 표 ["이름", 전력]
const src = readFileSync("src/game/national.ts", "utf8");
const names = new Set([
  ...[...src.matchAll(/^ {2}\{ name: "([^"]+)", power:/gm)].map((m) => m[1]),
  ...[...src.matchAll(/\["([^"]+)", \d+\]/g)].map((m) => m[1]),
]);

if (!existsSync(SRC)) {
  console.log("flag-icons 패키지가 없어 국기를 건너뛰어요. npm install을 먼저 하세요.");
  process.exit(0);
}
mkdirSync(DIR, { recursive: true });
const flags = {};
const missing = [];
for (const name of [...names].sort()) {
  const code = CODES[name];
  if (!code) {
    if (!NO_FLAG.has(name)) missing.push(name);
    continue;
  }
  const from = `${SRC}/${code}.svg`;
  if (!existsSync(from)) {
    missing.push(`${name}(${code})`);
    continue;
  }
  copyFileSync(from, `${DIR}/${code}.svg`);
  flags[name] = `/flags/${code}.svg`;
}
// MIT 라이선스 표시를 국기와 함께 둬요.
copyFileSync("node_modules/flag-icons/LICENSE", `${DIR}/LICENSE`);

writeFileSync(
  OUT,
  [
    "/* scripts/flags.mjs가 src/game/national.ts의 나라 목록과 flag-icons(MIT)로 만든 파일이에요. 직접 고치지 마세요. */",
    "",
    "/** 나라 이름 → 국기 파일 경로. 여기 있는 나라는 국가대표 엠블럼 대신 국기를 보여줘요. */",
    "export const FLAGS: Record<string, string> = {",
    ...Object.keys(flags).map((k) => `  ${JSON.stringify(k)}: ${JSON.stringify(flags[k])},`),
    "};",
    "",
  ].join("\n"),
);

console.log(`국기 ${Object.keys(flags).length}개 연결 · 게임 속 나라 ${names.size}개${NO_FLAG.size ? ` · 엠블럼으로 보여주는 나라: ${[...NO_FLAG].join(", ")}` : ""}`);
if (missing.length) console.log(`국가 코드가 없는 나라 (scripts/flags.mjs의 CODES에 추가하세요): ${missing.join(", ")}`);
else if (!quiet) console.log("빠진 나라 없이 모두 연결했어요.");
