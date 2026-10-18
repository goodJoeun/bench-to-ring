import { ATTR_KEYS, LEAGUES, POS, SHORT } from "./data";
import { retire } from "./career";
import { currentDecision, resolveQueue } from "./decisions";
import { runDraft } from "./draft";
import { addNews, offseasonTag, setTeam } from "./log";
import { runNationalTeam } from "./national";
import { chance, shuffle } from "./random";
import { ovr } from "./ratings";
import type { Action, Boost, Career } from "./types";
import { clamp, money } from "./util";

/** 이벤트 효과를 적용하고 소식을 남겨요. */
function applyBoost(c: Career, b: Boost, tag: string): void {
  const p = c.p;
  let msg = b.msg ?? "";
  if (b.attrs) for (const k of ATTR_KEYS) if (b.attrs[k]) p.attrs[k] = clamp(p.attrs[k] + (b.attrs[k] ?? 0), 20, 99);
  if (b.rand && b.amt) {
    const keys = shuffle(ATTR_KEYS).slice(0, b.rand);
    for (const k of keys) p.attrs[k] = clamp(p.attrs[k] + b.amt, 20, 99);
    msg += ` ${keys.map((k) => SHORT[k]).join("·")} +${b.amt}`;
  }
  if (b.health) c.health = clamp(c.health + b.health, 15, 100);
  if (b.money) c.earnings = Math.max(0, c.earnings + b.money);
  if (b.trust) c.trust = clamp(c.trust + b.trust, -3, 4);
  if (b.agency) c.perks.agency = true;
  if (b.trainer) c.perks.trainer = b.trainer;
  c.peakOvr = Math.max(c.peakOvr, ovr(p));
  if (msg) addNews(c, tag, b.t ?? "good", msg.trim());
}

export function applyAction(c: Career, a: Action): void {
  const p = c.p;
  const tag = offseasonTag(c);
  switch (a.k) {
    case "school":
      c.stage = "college";
      c.collegeYears = 0;
      setTeam(c, a.lg, a.team);
      c.trust = a.walk ? -3 : 0;
      addNews(c, tag, "move", `${a.team.name}에 ${a.walk ? "워크온으로 " : ""}입학했어요 · ${LEAGUES[a.lg].name}`);
      break;
    case "stay":
      addNews(c, tag, "info", "대학에서 한 시즌 더 뛰기로 했어요.");
      break;
    case "draft":
      runDraft(c, a.d);
      break;
    case "sign": {
      const same = c.team?.name === a.team.name && c.team?.lg === a.lg;
      c.stage = "pro";
      c.contract = { years: a.years, salary: a.salary };
      if (!same) {
        setTeam(c, a.lg, a.team);
        c.trust = 0;
      }
      addNews(
        c,
        tag,
        "move",
        same
          ? `${a.team.name} 재계약 · ${a.years}년 · 연봉 ${money(a.salary)}`
          : `${a.team.name} 입단 · ${LEAGUES[a.lg].name} · ${a.years}년 · 연봉 ${money(a.salary)}`,
      );
      break;
    }
    case "skip":
      c.stage = "free";
      c.team = null;
      c.contract = null;
      addNews(c, tag, "info", "소속팀 없이 개인 훈련으로 다음 시즌을 보내기로 했어요.");
      break;
    case "pos": {
      const old = p.pos;
      p.pos = a.pos;
      addNews(c, tag, "good", `${POS[old].name}에서 ${POS[a.pos].name}로 포지션을 바꿨어요.`);
      break;
    }
    case "boost":
      applyBoost(c, a, tag);
      break;
    case "gamble":
      applyBoost(c, chance(a.p) ? a.win : a.lose, tag);
      break;
    case "retire":
      retire(c);
      break;
    case "national":
      runNationalTeam(c, a.ev, a.year, a.join);
      break;
    case "none":
      break;
  }
}

/** 지금 결정의 i번째 선택지를 고르고, 다음 결정을 준비해요. */
export function chooseOption(c: Career, index: number): boolean {
  resolveQueue(c);
  const d = currentDecision(c);
  const opt = d?.opts[index];
  if (!opt) return false;
  c.queue.shift();
  applyAction(c, opt.act);
  resolveQueue(c);
  return true;
}
