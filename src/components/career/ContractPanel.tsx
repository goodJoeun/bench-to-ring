"use client";

import { useState } from "react";
import { buyoutCost, canRequestTransfer, currentExpectedMinutes, leverage, money, roleOf, type Career, type ProLeagueKey } from "@/game";
import { gameActions } from "@/lib/game-store";
import { Sheet } from "@/components/common/Sheet";
import { Panel } from "@/components/common/ui";

const leverageLabel = (v: number) => (v >= 0.6 ? "강함" : v >= 0.35 ? "보통" : "약함");

/** 시즌 사이 홈 탭의 계약 카드: 지금 계약, 협상력, 이적 요청 */
export function ContractPanel({ career: c }: { career: Career }) {
  const [asking, setAsking] = useState(false);
  if (c.stage !== "pro" || !c.team || !c.contract) return null;
  const lg = c.team.lg as ProLeagueKey;
  const can = canRequestTransfer(c);
  const asked = c.moveAsked === c.year;
  return (
    <Panel kicker={c.team.name} title="계약">
      <div className="meta-row">
        <span>
          연봉 <b>{money(c.contract.salary)}</b>
        </span>
        <span>
          남은 기간 <b>{c.contract.years}년</b>
        </span>
        <span>
          예상 역할 <b>{roleOf(currentExpectedMinutes(c))}</b>
        </span>
        <span>
          협상력 <b>{leverageLabel(leverage(c, lg))}</b>
        </span>
      </div>
      <p className="hint">
        계약이 끝나기 전에도 이적을 요청할 수 있어요. 출전 시간이 적으면 구단이 쉽게 보내 주고, 팀의 핵심이면 붙잡아요. 새 팀이나 FA
        제안을 고르면 연봉을 협상해요.
      </p>
      <div className="row-btns">
        <button type="button" className="btn" disabled={!can} aria-haspopup="dialog" onClick={() => setAsking(true)}>
          {asked ? "이번 오프시즌에 이미 요청했어요" : "이적 요청"}
        </button>
      </div>
      {asking && (
        <Sheet labelledBy="transfer-title" onClose={() => setAsking(false)}>
          <span className="sheet-kicker">{c.team.name} · 남은 계약 {c.contract.years}년</span>
          <h2 id="transfer-title">구단에 이적을 요청할까요?</h2>
          <p className="sheet-desc">
            허락하면 다른 구단의 제안을 받아요. 거절하면 코치 신뢰가 떨어지고, 위약금 {money(buyoutCost(c))}을 내고 계약을 해지할
            수도 있어요. 오프시즌마다 한 번만 요청할 수 있어요.
          </p>
          <button
            type="button"
            className="sheet-go"
            onClick={() => {
              setAsking(false);
              gameActions.requestTransfer();
            }}
          >
            이적 요청하기
          </button>
          <button type="button" className="sheet-later" onClick={() => setAsking(false)}>
            그만둘게요
          </button>
        </Sheet>
      )}
    </Panel>
  );
}
