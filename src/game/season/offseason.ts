import { POS, POS_GROWTH } from "../core/data";
import { TRAITS } from "../player/players";
import { forcedRetirement, nbaOffer, resolveQueue, retirementPrompt } from "./decisions";
import { lifeEvent } from "./events";
import { addNews, pickTeam } from "../career/log";
import { endService, militaryDecision } from "../world/military";
import { chance, ri } from "../core/random";
import { refreshShop } from "../economy/shop";
import { ovr, ovrOf } from "../player/ratings";
import type { Career, Decision, QueueItem } from "../core/types";
import { josa, ro } from "../core/util";

export const RETIRE_AGE = 40;
/** 계약이 남아 있어도 오프시즌마다 은퇴를 물어보는 나이 */
const RETIRE_PROMPT_AGE = 35;

/** 거절하면 떨어지는 코치 신뢰. 이적 요청이 거절될 때(-1)보다 덜해요. */
const TRADE_REFUSE_TRUST = -0.5;

/** 구단의 트레이드 제안: 같은 리그 다른 팀으로 옮길지 물어요. 받아들이면 남은 계약 그대로 옮기고 입단 기자회견을 열어요. */
function tradeOffer(c: Career): Decision {
  const team = c.team!;
  const lg = team.lg;
  const t = pickTeam(lg, new Set([team.name]));
  const years = c.contract!.years;
  return {
    scene: "deal",
    title: "트레이드 제안",
    body: `${team.name} 구단이 ${josa(t.name, "과", "와")} 트레이드를 추진하고 있어요. 받아들이면 남은 계약 ${years}년을 ${t.name}에서 이어 가요.`,
    opts: [
      {
        label: `${ro(t.name)} 간다`,
        sub: "새 팀에서 다시 시작해요 · 코치 신뢰는 처음부터 쌓아요",
        tag: "트레이드",
        act: { k: "trade", lg, team: t, from: team.name },
      },
      {
        label: `${team.name}에 남겠다고 버틴다`,
        sub: "팀에 남지만 구단과 사이가 조금 서먹해져요",
        act: { k: "boost", trust: TRADE_REFUSE_TRUST, t: "info", msg: `트레이드를 거절하고 ${team.name}에 남았어요. 구단과 사이가 조금 서먹해졌어요.` },
      },
    ],
  };
}

/**
 * 시즌이 끝난 뒤(나이·연도는 이미 1 늘어난 상태) 몸의 변화와 결정 대기열을 만들어요.
 * natCall은 이번 여름 국가대표 발탁 결정으로, 있으면 맨 앞에 와요.
 */
export function runOffseason(c: Career, finishedYear: number, natCall: Decision | null = null): void {
  const p = c.p;
  const tag = `${finishedYear} 오프시즌`;
  const q: QueueItem[] = natCall ? [natCall] : [];
  // 복무 시즌이 끝났으면 전역해요. 전역한 해에는 계약 기간을 줄이지 않고 바로 진로 결정으로 넘어가요.
  const discharged = c.stage === "military" ? endService(c, tag) : null;

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

  // 포지션 전환 제안
  const next = POS_GROWTH[p.pos];
  if (next && p.h >= next[1] && !c.posAsked[p.pos]) {
    c.posAsked[p.pos] = 1;
    const [np] = next;
    const before = ovr(p);
    const after = Math.round(ovrOf(p.attrs, np));
    q.push({
      scene: "board",
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

  // 병역: 진로 결정보다 먼저 물어요. 입대하면 뒤에 쌓인 결정은 지워져요.
  const mil = discharged ? null : militaryDecision(c);
  if (mil) q.push(mil);

  // 단계별 진로
  if (discharged) q.push(...discharged);
  else if (c.stage === "hs") {
    c.schoolYear++;
    if (c.schoolYear > 3) q.push({ lazy: "hsgrad" });
  } else if (c.stage === "college") {
    c.collegeYears++;
    q.push({ lazy: "college" });
  } else if (c.stage === "pro" && c.contract && c.team) {
    c.contract.years--;
    if (c.contract.years <= 0) q.push({ lazy: "fa" });
    else {
      const offer = chance(0.6) ? nbaOffer(c) : null;
      if (offer) q.push(offer);
      // 구단이 트레이드를 추진하면 갑자기 옮기지 않고 받아들일지 물어요.
      // 은퇴를 묻는 오프시즌에는 묻지 않아요. 옮긴 팀에서 한 경기도 안 뛰고 은퇴하면 엔딩과 랭킹의 팀이 엇갈려요.
      else if (chance(0.08) && c.age < RETIRE_PROMPT_AGE) q.push(tradeOffer(c));
      if (c.age >= RETIRE_PROMPT_AGE) q.push(retirementPrompt(c));
    }
  } else if (c.stage === "free") q.push({ lazy: "faFree" });

  // 농구 밖의 생활 이벤트 (학교 축제, 시험, 에이전시, 트레이너…)
  if (chance(0.45)) {
    const ev = lifeEvent(c);
    if (ev) q.push(ev);
  }
  c.queue = q;
  resolveQueue(c);
  // 새 시즌 상점 진열
  refreshShop(c);
}
