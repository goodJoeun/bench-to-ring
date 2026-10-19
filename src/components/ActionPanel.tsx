"use client";

import { useState } from "react";
import { FOCUS, currentDecision, currentExpectedMinutes, roleOf, stageLabel, type Career, type FocusKey } from "@/game";
import { gameActions } from "@/lib/game-store";
import { focusName } from "./format";
import { InvestPicker } from "./InvestPicker";
import { Sheet } from "./Sheet";
import { Choice } from "./ui";

function focusHint(k: FocusKey): string {
  if (k === "bal") return "모든 능력치를 고르게 키워요.";
  if (k === "rest") return "성장은 느려지지만 건강을 회복하고 부상 위험이 줄어요.";
  return `${focusName(k)} 성장이 1.5배로 빨라지고, 나머지는 조금 느려져요.`;
}

interface ActionPanelProps {
  career: Career;
  /** 시즌 로딩 화면이 떠 있는 동안에는 결정 시트를 열지 않아요. */
  simulating: boolean;
  onAdvance: () => void;
}

/**
 * 탭 바 위에 고정된 진행 버튼과, 그 버튼이 여는 시트들.
 * - 결정이 없으면: 시즌 계획 시트에서 훈련 초점을 고르고 시즌을 시작해요.
 * - 오프시즌 결정이 남았으면: 결정 시트가 자동으로 올라와요. 잠시 닫았다가 버튼으로 다시 열 수 있어요.
 */
export function ActionPanel({ career: c, simulating, onAdvance }: ActionPanelProps) {
  const decision = currentDecision(c);
  const [planOpen, setPlanOpen] = useState(false);
  // 결정마다 한 번은 자동으로 열려요. 사용자가 닫은 결정만 기억해요.
  const decisionKey = `${c.year}:${c.queue.length}:${decision?.title ?? ""}`;
  const [hiddenKey, setHiddenKey] = useState<string | null>(null);
  const decisionOpen = !!decision && !simulating && hiddenKey !== decisionKey;

  if (decision) {
    const remaining = c.queue.length;
    return (
      <>
        <button type="button" className="advance pending" onClick={() => setHiddenKey(null)}>
          <span>
            <span className="t">오프시즌 결정</span>
            <span className="s">{remaining > 1 ? `남은 결정 ${remaining}개` : "마지막 결정이에요"} · 눌러서 이어서 고르기</span>
          </span>
          <span className="go" aria-hidden="true">
            ▶
          </span>
        </button>
        {decisionOpen && (
          <Sheet key={decisionKey} labelledBy="decision-title">
            <span className="sheet-kicker">오프시즌 결정{remaining > 1 && ` · 남은 결정 ${remaining}개`}</span>
            <h2 id="decision-title">{decision.title}</h2>
            <p className="sheet-desc">{decision.body}</p>
            <div className="choices">
              {decision.opts.map((o, i) => (
                <Choice key={`${o.label}-${i}`} label={o.label} tag={o.tag} sub={o.sub} onClick={() => gameActions.choose(i)} />
              ))}
            </div>
            <button type="button" className="sheet-later" onClick={() => setHiddenKey(decisionKey)}>
              잠시 닫고 둘러보기
            </button>
          </Sheet>
        )}
      </>
    );
  }

  const sub = c.team
    ? `${stageLabel(c)} · ${c.team.name} · 예상 역할 ${roleOf(currentExpectedMinutes(c))}`
    : c.stage === "military"
      ? `${stageLabel(c)} · 시즌이 끝나면 전역해요`
      : "무소속 · 개인 훈련 시즌";

  return (
    <>
      <button type="button" className="advance" aria-haspopup="dialog" onClick={() => setPlanOpen(true)}>
        <span>
          <span className="t">{c.year} 시즌 진행</span>
          <span className="s">
            {sub} · 훈련 {focusName(c.focus)}
            {c.invest.length > 0 && ` · 투자 ${c.invest.length}개`}
          </span>
        </span>
        <span className="go" aria-hidden="true">
          ▶
        </span>
      </button>
      {planOpen && (
        <Sheet labelledBy="plan-title" onClose={() => setPlanOpen(false)}>
          <span className="sheet-kicker">{sub}</span>
          <h2 id="plan-title">{c.year} 시즌 계획</h2>
          <p className="sheet-desc">이번 시즌에 집중할 훈련을 고르고 시즌을 시작하세요.</p>
          <div className="choices focus-grid" role="radiogroup" aria-label="훈련 초점">
            {FOCUS.map(([k, name]) => (
              <Choice
                key={k}
                label={name}
                sub={focusHint(k)}
                role="radio"
                aria-checked={c.focus === k}
                onClick={() => gameActions.setFocus(k)}
              />
            ))}
          </div>
          <InvestPicker career={c} />
          <button
            type="button"
            className="sheet-go"
            onClick={() => {
              setPlanOpen(false);
              gameActions.advanceSeason();
              onAdvance();
            }}
          >
            {focusName(c.focus)} 훈련{c.invest.length > 0 && ` · 투자 ${c.invest.length}개`}로 시즌 시작
          </button>
        </Sheet>
      )}
    </>
  );
}
