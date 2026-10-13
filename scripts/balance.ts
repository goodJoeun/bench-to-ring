/**
 * 밸런스 측정: 시드 고정으로 커리어를 여러 개 자동 플레이해 성장 분포를 출력해요.
 * 실행: npx vitest run scripts/balance.ts  (또는 npm run balance)
 */
import { test } from "vitest";
import { POS_KEYS, chooseOption, createCareer, currentDecision, generateCandidates, ovrOf, seeded, setRandom, simulateSeason } from "@/game";

const N = 600;
const pct = (arr: number[], p: number) => arr[Math.min(arr.length - 1, Math.floor(arr.length * p))];

test("balance report", () => {
  const rand = seeded(20270101);
  setRandom(rand);
  const at18: number[] = [];
  const at22: number[] = [];
  const peaks: number[] = [];
  let topLeague = 0;
  let mvps = 0;
  let mvpPlayers = 0;
  for (let i = 0; i < N; i++) {
    const pos = POS_KEYS[i % 5];
    const c = createCareer({ name: "b", num: 1, nat: "대한민국", pos, path: i % 2 ? "abroad" : "domestic" }, generateCandidates(pos)[i % 3], `b${i}`);
    let steps = 0;
    while (c.stage !== "retired" && steps++ < 200) {
      if (c.queue.length) chooseOption(c, Math.floor(rand() * currentDecision(c)!.opts.length));
      else {
        simulateSeason(c);
        if (c.age === 19) at18.push(Math.round(ovrOf(c.p.attrs, c.p.pos)));
        if (c.age === 23) at22.push(Math.round(ovrOf(c.p.attrs, c.p.pos)));
      }
    }
    peaks.push(c.peakOvr);
    const top = Object.keys(c.awards).find((k) => k.startsWith("mvp_"));
    if (c.hist.some((h) => h.lg && ["gbl", "nba"].includes(h.lg))) topLeague++;
    const m = top ? c.awards[top as keyof typeof c.awards] ?? 0 : 0;
    mvps += m;
    if (m) mvpPlayers++;
  }
  for (const a of [at18, at22, peaks]) a.sort((x, y) => x - y);
  const row = (name: string, a: number[]) =>
    `${name.padEnd(10)} p10 ${pct(a, 0.1)}  p50 ${pct(a, 0.5)}  p90 ${pct(a, 0.9)}  max ${a[a.length - 1]}`;
  console.log(
    [
      row("OVR@18", at18),
      row("OVR@22", at22),
      row("peak", peaks),
      `top league ${((topLeague / N) * 100).toFixed(1)}%  MVP players ${((mvpPlayers / N) * 100).toFixed(1)}%  MVPs ${mvps}`,
    ].join("\n"),
  );
});
