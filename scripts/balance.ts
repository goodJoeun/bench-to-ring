/**
 * 밸런스 측정: 시드 고정으로 커리어를 여러 개 자동 플레이해 성장 분포를 출력해요.
 * 실행: npx vitest run scripts/balance.ts  (또는 npm run balance)
 */
import { test } from "vitest";
import { ARCHETYPES, POS_KEYS, chooseOption, createCareer, currentDecision, generateCandidate, ovrOf, seeded, setRandom, simulateSeason } from "@/game";

/** 돌릴 커리어 수. BALANCE_N으로 바꿀 수 있어요. */
const N = Number(process.env.BALANCE_N) || 600;
const SEED = 20270101;
const pct = (arr: number[], p: number) => arr[Math.min(arr.length - 1, Math.floor(arr.length * p))];

/** 터미널에서 한글은 두 칸을 차지해서, 글자 수가 아니라 화면 너비로 칸을 맞춰요. */
const width = (s: string) => [...s].reduce((w, ch) => w + (/[ᄀ-ᇿ㄰-㆏가-힣]/.test(ch) ? 2 : 1), 0);
const pad = (s: string, n: number, left: boolean) => {
  const fill = " ".repeat(Math.max(0, n - width(s)));
  return left ? s + fill : fill + s;
};

/** 첫 칸은 왼쪽, 나머지 칸은 오른쪽으로 맞춘 표 */
function table(rows: (string | number)[][]): string {
  const cells = rows.map((r) => r.map(String));
  const widths = cells[0].map((_, i) => Math.max(...cells.map((r) => width(r[i] ?? ""))));
  return cells.map((r) => "  " + r.map((c, i) => pad(c, widths[i], i === 0)).join("   ").trimEnd()).join("\n");
}

const section = (title: string, body: string) => `\n■ ${title}\n${body}`;

test("balance report", () => {
  const rand = seeded(SEED);
  setRandom(rand);
  const at18: number[] = [];
  const at22: number[] = [];
  const peaks: number[] = [];
  const peakAges: number[] = [];
  /** 나이별 시즌 성장량 (오프시즌 보너스를 뺀 ovr1 - ovr0) */
  const gains: Record<number, number[]> = {};
  const GAIN_AGES = [19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30];
  let topLeague = 0;
  let mvps = 0;
  let mvpPlayers = 0;
  /** 프로 시즌을 시작할 때 건강과 그 시즌 출전 시간 (체력 소모가 얼마나 쌓이는지) */
  const proHealth: [number, number][] = [];
  let proSeasons = 0;
  let injuredSeasons = 0;
  for (let i = 0; i < N; i++) {
    const pos = POS_KEYS[i % 5];
    const c = createCareer({ name: "b", num: 1, nat: "대한민국", pos, path: i % 2 ? "abroad" : "domestic" }, generateCandidate(pos, i % ARCHETYPES[pos].length), `b${i}`);
    let steps = 0;
    while (c.stage !== "retired" && steps++ < 200) {
      if (c.queue.length) chooseOption(c, Math.floor(rand() * currentDecision(c)!.opts.length));
      else {
        const h0 = c.health;
        const pro = c.stage === "pro";
        simulateSeason(c);
        if (pro && c.last?.pro) {
          proHealth.push([h0, c.last.min]);
          proSeasons++;
          const tag = `${c.last.year} 시즌`;
          if (c.news.some((n) => n.w === tag && n.m.includes("부상을 당했어요"))) injuredSeasons++;
        }
        if (c.age === 19) at18.push(Math.round(ovrOf(c.p.attrs, c.p.pos)));
        if (c.age === 23) at22.push(Math.round(ovrOf(c.p.attrs, c.p.pos)));
      }
    }
    peaks.push(c.peakOvr);
    peakAges.push(c.hist.find((h) => h.ovr1 === c.peakOvr)?.age ?? 0);
    for (const h of c.hist) if (GAIN_AGES.includes(h.age)) (gains[h.age] ??= []).push(h.ovr1 - h.ovr0);
    const top = Object.keys(c.awards).find((k) => k.startsWith("mvp_"));
    if (c.hist.some((h) => h.lg && ["gbl", "nba"].includes(h.lg))) topLeague++;
    const m = top ? c.awards[top as keyof typeof c.awards] ?? 0 : 0;
    mvps += m;
    if (m) mvpPlayers++;
  }
  for (const a of [at18, at22, peaks, peakAges]) a.sort((x, y) => x - y);
  const avg = (a: number[]) => a.reduce((t, x) => t + x, 0) / a.length;
  const share = (n: number, total: number, digits = 1) => `${((n / total) * 100).toFixed(digits)}%`;
  const dist = (name: string, a: number[]) => [name, avg(a).toFixed(1), pct(a, 0.1), pct(a, 0.5), pct(a, 0.9), a[a.length - 1]];
  const gainRow = (label: string, f: (a: number[]) => string) => [label, ...GAIN_AGES.map((age) => f(gains[age] ?? [0]))];
  const health = (f: (min: number) => boolean) => avg(proHealth.filter(([, m]) => f(m)).map(([h]) => h)).toFixed(0);
  console.log(
    [
      `밸런스 리포트 · 커리어 ${N}개 · 시드 ${SEED}`,
      section(
        "오버롤 분포",
        table([["", "평균", "하위 10%", "중앙값", "상위 10%", "최고"], dist("18세", at18), dist("22세", at22), dist("최고 오버롤", peaks), dist("최고점 나이", peakAges)]),
      ),
      section(
        "나이별 시즌 성장 (오프시즌 보너스 제외)",
        table([
          ["나이", ...GAIN_AGES.map((age) => `${age}세`)],
          gainRow("평균 성장", (a) => `${avg(a) >= 0 ? "+" : ""}${avg(a).toFixed(2)}`),
          gainRow("1 이하 비율", (a) => share(a.filter((x) => x <= 1).length, a.length, 0)),
        ]),
      ),
      section(
        "커리어 성과",
        table([
          ["최상위 리그(GBL/NBA) 경험", share(topLeague, N), `${topLeague}명`],
          ["MVP 수상 선수", share(mvpPlayers, N), `${mvpPlayers}명, 총 ${mvps}회`],
        ]),
      ),
      section(
        "체력과 부상 (프로 시즌 기준)",
        table([
          ["시즌 시작 건강 · 28분 이상 출전", health((m) => m >= 28)],
          ["시즌 시작 건강 · 15분 미만 출전", health((m) => m < 15)],
          ["부상 당한 시즌", share(injuredSeasons, proSeasons, 0)],
        ]),
      ),
    ].join("\n"),
  );
});
