import { ATTR_KEYS, POS, SHORT } from "./data";
import { LEAGUES } from "./leagues";
import { retire } from "./career";
import { addAttr, addHealth, clampTrust } from "./condition";
import { currentDecision, negotiable, negotiation, resolveQueue } from "./decisions";
import { runDraft } from "./draft";
import { addNews, decisionTag, joinTeam, leaveTeam, setTeam } from "./log";
import { applyMilitary } from "./military";
import { runNationalTeam } from "./national";
import { chance, shuffle } from "./random";
import type { Action, Boost, Career, ProLeagueKey, Team } from "./types";
import { clamp, josa, money, ro, round2, roundSalary } from "./util";

/** 이벤트 효과를 적용하고 소식을 남겨요. */
function applyBoost(c: Career, b: Boost, tag: string): void {
  const p = c.p;
  let msg = b.msg ?? "";
  if (b.attrs) for (const k of ATTR_KEYS) if (b.attrs[k]) addAttr(p.attrs, k, b.attrs[k] ?? 0);
  if (b.rand && b.amt) {
    const keys = shuffle(ATTR_KEYS).slice(0, b.rand);
    for (const k of keys) addAttr(p.attrs, k, b.amt);
    msg += ` ${keys.map((k) => SHORT[k]).join("·")} +${b.amt}`;
  }
  if (b.health) addHealth(c, b.health);
  if (b.money) c.earnings = Math.max(0, c.earnings + b.money);
  if (b.trust) c.trust = clampTrust(c.trust + b.trust);
  if (b.agency) c.perks.agency = true;
  if (b.trainer) c.perks.trainer = b.trainer;
  // 시즌 중 이벤트: 남은 경기의 경기력과 결장
  const run = c.run;
  if (run && b.form) run.form = clamp(run.form + b.form, -2, 2);
  if (run && b.sit) {
    if (run.out === 0) run.outWhy = "휴식";
    run.out = Math.max(0, run.out + b.sit);
  }
  if (run && b.injure) {
    run.out += b.injure;
    run.outWhy = "부상";
  }
  // 최고 오버롤은 시즌을 마칠 때만 기록해요(시즌 기록의 오버롤과 맞추려고요).
  if (msg) addNews(c, tag, b.t ?? "good", msg.trim());
}

/** 계약서에 서명해요. 같은 팀이면 재계약이에요. */
function sign(c: Career, lg: ProLeagueKey, team: Team, years: number, salary: number, note = ""): void {
  const same = c.team?.name === team.name && c.team?.lg === lg;
  c.stage = "pro";
  c.contract = { years, salary };
  if (!same) joinTeam(c, lg, team);
  addNews(
    c,
    decisionTag(c),
    "move",
    `${same ? `${team.name} 재계약` : `${team.name} 입단 · ${LEAGUES[lg].name}`} · ${years}년 · 연봉 ${money(salary)}${note}`,
  );
}

export function applyAction(c: Career, a: Action): void {
  const p = c.p;
  const tag = decisionTag(c);
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
    case "sign":
      sign(c, a.lg, a.team, a.years, a.salary);
      break;
    case "nego":
      if (chance(a.p)) sign(c, a.lg, a.team, a.years, roundSalary(a.salary * a.ask), " · 협상 성공");
      else if (!a.walk) {
        // 기간 연장 요구가 거절되면 원래 기간이에요.
        const years = a.ask === 1 ? a.years - 1 : a.years;
        sign(c, a.lg, a.team, years, a.salary, " · 구단이 원래 조건을 고수했어요");
      } else {
        addNews(c, tag, "bad", `${a.team.name} 구단이 협상 테이블을 떠났어요.`);
        c.queue.unshift({
          title: "협상 결렬",
          body: `${a.team.name} 구단이 제안을 거둬들였어요. 남은 선택지에서 고르세요.`,
          opts: a.walk.length ? a.walk : [{ label: "무소속으로 1년 개인 훈련", sub: "다음 시장을 노려요", act: { k: "skip" } }],
        });
      }
      break;
    case "buyout": {
      const from = c.team?.name ?? "";
      c.earnings = round2(Math.max(0, c.earnings - a.cost));
      c.spent = round2(c.spent + a.cost);
      leaveTeam(c);
      addNews(c, tag, "move", `${from}에 위약금 ${money(a.cost)}을 내고 계약을 해지했어요. FA 시장에 나가요.`);
      c.queue.unshift({ lazy: "faFree" });
      break;
    }
    case "skip":
      leaveTeam(c);
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
    case "clutch": {
      // 결과는 바로 다음 경기에 반영돼요(season.ts playGame).
      const ok = chance(a.p);
      if (c.run) {
        c.run.forced = ok ? "win" : "loss";
        c.run.form = clamp(c.run.form + (ok ? 0.8 : -0.4), -2, 2);
      }
      // 최고 오버롤은 시즌을 마칠 때 기록해요.
      if (ok) addAttr(p.attrs, a.attr, 1);
      addNews(
        c,
        tag,
        ok ? "good" : "bad",
        ok
          ? `클러치 성공! ${ro(a.play)} 승리를 이끌었어요. ${SHORT[a.attr]} +1`
          : `클러치 실패. ${josa(a.play, "을", "를")} 노렸지만 아쉽게 졌어요.`,
      );
      break;
    }
    case "retire":
      retire(c);
      break;
    case "national":
      runNationalTeam(c, a.ev, a.year, a.join);
      break;
    case "military":
      applyMilitary(c, a.choice);
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
  // 계약 제안은 바로 서명하지 않고 연봉 협상으로 넘어가요.
  const a = opt.act;
  if (a.k === "sign" && negotiable(a)) c.queue.unshift(negotiation(c, a, d.opts.filter((_, i) => i !== index)));
  else applyAction(c, a);
  resolveQueue(c);
  return true;
}
