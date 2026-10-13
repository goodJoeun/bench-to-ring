import { POS, POS_GROWTH, TRAITS } from "./data";
import { flavorEvent, forcedRetirement, gblOffer, resolveQueue, retirementPrompt } from "./decisions";
import { addNews, pickTeam, setTeam } from "./log";
import { chance, ri, rnd } from "./random";
import { ovr, ovrOf } from "./ratings";
import type { Career, QueueItem } from "./types";
import { r1 } from "./util";

export const RETIRE_AGE = 40;

/** 시즌이 끝난 뒤(나이·연도는 이미 1 늘어난 상태) 몸의 변화와 결정 대기열을 만들어요. */
export function runOffseason(c: Career, finishedYear: number): void {
  const p = c.p;
  const tag = `${finishedYear} 오프시즌`;
  const q: QueueItem[] = [];

  // 키 성장
  if (c.age <= 20 && p.h < p.hFinal) p.h += Math.min(p.hFinal - p.h, ri(1, 4));
  if (c.age <= 19 && chance(0.13)) {
    const extra = ri(3, 6);
    p.h += extra;
    p.hFinal = Math.max(p.hFinal, p.h);
    p.wsd += ri(0, 1);
    addNews(c, tag, "good", `키가 훌쩍 컸어요! +${extra}cm, 지금 ${p.h}cm예요.`);
  }
  if (c.age === 19 && !p.traitKnown) {
    p.traitKnown = true;
    addNews(c, tag, "info", `코치진 분석 결과 숨겨진 특성 '${p.trait}'이 드러났어요. ${TRAITS[p.trait]}`);
  }
  const u = Math.max(1, Math.round(9 - (c.age - 16) * 1.1));
  c.potOff = r1(rnd(-u / 2, u / 2));

  // 포지션 전환 제안
  const next = POS_GROWTH[p.pos];
  if (next && p.h >= next[1] && !c.posAsked[p.pos]) {
    c.posAsked[p.pos] = 1;
    const [np] = next;
    const before = ovr(p);
    const after = Math.round(ovrOf(p.attrs, np));
    q.push({
      title: "포지션 전환 제안",
      body: `키가 ${p.h}cm까지 자랐어요. 코치가 ${POS[np].name}로 뛰어보자고 해요.`,
      opts: [
        { label: `${POS[np].name}로 전환`, sub: `오버롤 ${before} → ${after} · 새 포지션 기준으로 능력치를 평가해요`, tag: np, act: { k: "pos", pos: np } },
        { label: `${POS[p.pos].name} 유지`, sub: "지금 포지션에서 계속 뛰어요", act: { k: "none" } },
      ],
    });
  }

  if (c.age >= RETIRE_AGE) {
    c.queue = [forcedRetirement()];
    return;
  }

  // 단계별 진로
  if (c.stage === "hs") {
    c.schoolYear++;
    if (c.schoolYear > 3) q.push({ lazy: "hsgrad" });
  } else if (c.stage === "college") {
    c.collegeYears++;
    q.push({ lazy: "college" });
  } else if (c.stage === "pro" && c.contract && c.team) {
    c.contract.years--;
    if (c.contract.years <= 0) q.push({ lazy: "fa" });
    else {
      const offer = chance(0.6) ? gblOffer(c) : null;
      if (offer) q.push(offer);
      else if (chance(0.08)) {
        const lg = c.team.lg;
        const from = c.team.name;
        const t = pickTeam(lg, new Set([from]));
        setTeam(c, lg, t);
        c.trust = 0;
        addNews(c, tag, "move", `트레이드 · ${from}에서 ${t.name}로 이적했어요.`);
      }
      if (c.age >= 35) q.push(retirementPrompt(c));
    }
  } else if (c.stage === "free") q.push({ lazy: "faFree" });

  if (chance(0.35)) q.push(flavorEvent(c));
  c.queue = q;
  resolveQueue(c);
}
