/**
 * 밸런스 측정: 시드 고정으로 커리어를 여러 개 자동 플레이해 성장 분포를 출력해요.
 * 실행: npx vitest run scripts/balance.ts  (또는 npm run balance)
 */
import { test } from "vitest";
import { ARCHETYPES, POS_KEYS, chooseOption, createCareer, currentDecision, generateCandidate, ovrOf, seeded, setRandom, simulateSeason } from "@/game";

const N = 600;
const pct = (arr: number[], p: number) => arr[Math.min(arr.length - 1, Math.floor(arr.length * p))];

test("balance report", () => {
  const rand = seeded(20270101);
  setRandom(rand);
  const at18: number[] = [];
  const at22: number[] = [];
  const peaks: number[] = [];
  const peakAges: number[] = [];
  /** 나이별 시즌 성장량 (오프시즌 보너스를 뺀 ovr1 - ovr0) */
  const gains: Record<number, number[]> = {};
  const GAIN_AGES = [19, 20, 21, 22, 23, 24, 25, 26, 27];
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
  const gainRow = (label: string, f: (a: number[]) => string) =>
    `${label.padEnd(10)} ${GAIN_AGES.map((age) => `${age}:${f(gains[age] ?? [0]).padStart(5)}`).join(" ")}`;
  const row = (name: string, a: number[]) =>
    `${name.padEnd(10)} p10 ${pct(a, 0.1)}  p50 ${pct(a, 0.5)}  p90 ${pct(a, 0.9)}  max ${a[a.length - 1]}`;
  console.log(
    [
      row("OVR@18", at18),
      row("OVR@22", at22),
      row("peak", peaks),
      row("peak age", peakAges),
      gainRow("ΔOVR avg", (a) => avg(a).toFixed(2)),
      gainRow("ΔOVR<=1", (a) => `${Math.round((a.filter((x) => x <= 1).length / a.length) * 100)}%`),
      `top league ${((topLeague / N) * 100).toFixed(1)}%  MVP players ${((mvpPlayers / N) * 100).toFixed(1)}%  MVPs ${mvps}`,
      `pro health at start  28+min ${avg(proHealth.filter(([, m]) => m >= 28).map(([h]) => h)).toFixed(0)}  <15min ${avg(proHealth.filter(([, m]) => m < 15).map(([h]) => h)).toFixed(0)}  injured seasons ${((injuredSeasons / proSeasons) * 100).toFixed(0)}%`,
    ].join("\n"),
  );
});
