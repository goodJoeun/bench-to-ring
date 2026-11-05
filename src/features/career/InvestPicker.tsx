"use client";

import { INVEST_OFFER, INVEST_SLOTS, STUDENT_ALLOWANCE, canAffordInvest, canInvest, chosenInvest, investCost, investLineup, investTotal, money, type Career } from "@/game";
import { gameActions } from "@/shared/store/game-store";
import { Choice, Funds } from "@/shared/ui/ui";

/** 시즌 계획 시트 안의 시즌 투자 고르기. 이번 시즌에 나온 투자 중 두 가지까지, 보유 자금 안에서 골라요. */
export function InvestPicker({ career: c }: { career: Career }) {
  if (!canInvest(c)) return null;
  const chosen = chosenInvest(c);
  const total = investTotal(c, chosen);
  // 소수 오차로 '모자라요'가 뜨지 않게 0.01억 아래는 남는 돈으로 쳐요.
  const short = c.earnings - total < -1e-9;
  const left = Math.max(0, c.earnings - total);
  const student = c.stage === "hs" || c.stage === "college";

  return (
    <section className="invest" aria-labelledby="invest-title">
      <div className="invest-head">
        <h3 id="invest-title">시즌 투자</h3>
        <Funds amount={c.earnings} />
      </div>
      <p className="hint">
        시즌마다 투자 {INVEST_OFFER}가지가 새로 나오고, 그중 {INVEST_SLOTS}가지까지 고를 수 있어요. 비용은 시즌을 시작할 때 내고, 연봉이
        오르면 오른 연봉을 한 번 받은 다음 시즌부터 비용도 올라요.
        {student && ` 학생 선수는 시즌마다 용돈·후원금 ${money(STUDENT_ALLOWANCE)}이 들어와요.`}
      </p>
      <div className="choices invest-grid">
        {investLineup(c).map((i) => {
          const cost = investCost(c, i.key);
          const on = chosen.includes(i.key);
          const blocked = !on && (chosen.length >= INVEST_SLOTS || !canAffordInvest(c, chosen, i.key));
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
        })}
      </div>
      <p className="hint" data-warn={short || undefined}>
        {!chosen.length
          ? "투자 없이 시즌을 보내요."
          : short
            ? `합계 ${money(total)} · 자금이 모자라 고른 순서대로 낼 수 있는 것만 해요.`
            : `합계 ${money(total)} · 시작하면 ${money(left)} 남아요.`}
      </p>
    </section>
  );
}
