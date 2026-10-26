"use client";

import { INVEST_SLOTS, STUDENT_ALLOWANCE, canInvest, chosenInvest, investCost, investLineup, money, type Career, type Investment } from "@/game";
import { gameActions } from "@/lib/game-store";
import { Choice } from "@/components/common/ui";

/** 시즌 계획 시트 안의 시즌 투자 고르기. 기본 투자와 이번 시즌 특별 투자 중 두 가지까지, 보유 자금 안에서 골라요. */
export function InvestPicker({ career: c }: { career: Career }) {
  if (!canInvest(c)) return null;
  const lineup = investLineup(c);
  const chosen = chosenInvest(c);
  const total = chosen.reduce((t, k) => t + investCost(c, k), 0);
  const left = c.earnings - total;
  const student = c.stage === "hs" || c.stage === "college";
  const specials = lineup.filter((i) => i.special);

  const card = (i: Investment) => {
    const cost = investCost(c, i.key);
    const on = chosen.includes(i.key);
    const blocked = !on && (chosen.length >= INVEST_SLOTS || total + cost > c.earnings);
    return (
      <Choice
        key={i.key}
        label={i.name}
        tag={money(cost)}
        sub={i.effect}
        aria-pressed={on}
        disabled={blocked}
        onClick={() => gameActions.toggleInvest(i.key)}
      />
    );
  };

  return (
    <section className="invest" aria-labelledby="invest-title">
      <div className="invest-head">
        <h3 id="invest-title">시즌 투자</h3>
        <span>보유 자금 {money(c.earnings)}</span>
      </div>
      <p className="hint">
        한 시즌에 {INVEST_SLOTS}가지까지 고를 수 있고, 비용은 시즌을 시작할 때 내요. 연봉이 오르면 비용도 올라요.
        {student && ` 학생 선수는 시즌마다 용돈·후원금 ${money(STUDENT_ALLOWANCE)}이 들어와요.`}
      </p>
      <div className="choices invest-grid">{lineup.filter((i) => !i.special).map(card)}</div>
      {specials.length > 0 && (
        <>
          <h4 className="invest-sub">
            이번 시즌 특별 투자 <span>시즌마다 바뀌어요</span>
          </h4>
          <div className="choices invest-grid">{specials.map(card)}</div>
        </>
      )}
      <p className="hint" data-warn={left < 0 || undefined}>
        {!chosen.length
          ? "투자 없이 시즌을 보내요."
          : left < 0
            ? `합계 ${money(total)} · 자금이 모자라 고른 순서대로 낼 수 있는 것만 해요.`
            : `합계 ${money(total)} · 시작하면 ${money(left)} 남아요.`}
      </p>
    </section>
  );
}
