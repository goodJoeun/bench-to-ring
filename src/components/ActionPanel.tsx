"use client";

import { FOCUS, currentDecision, currentExpectedMinutes, roleOf, stageLabel, type Career } from "@/game";
import { gameActions } from "@/lib/game-store";

function focusHint(c: Career): string {
  if (c.focus === "bal") return "모든 능력치를 고르게 키워요.";
  if (c.focus === "rest") return "성장은 느려지지만 건강을 회복하고 부상 위험이 줄어요.";
  const name = FOCUS.find(([k]) => k === c.focus)?.[1] ?? "";
  return `${name} 성장이 1.8배로 빨라지고, 나머지는 조금 느려져요.`;
}

/** 오프시즌 결정이 남아 있으면 결정 카드를, 아니면 훈련 초점과 시즌 진행 버튼을 보여줘요.
 *  휴대폰에서는 시즌 진행 버튼이 하단 탭 바 위에 고정돼요. */
export function ActionPanel({ career: c, onAdvance }: { career: Career; onAdvance: () => void }) {
  const decision = currentDecision(c);

  if (decision) {
    const remaining = c.queue.length;
    return (
      <section className="decision" aria-live="polite">
        <span className="label">오프시즌 결정{remaining > 1 && ` · 남은 결정 ${remaining}개`}</span>
        <h3>{decision.title}</h3>
        <p className="dbody">{decision.body}</p>
        <div className="opts">
          {decision.opts.map((o, i) => (
            <button type="button" className="opt" key={`${o.label}-${i}`} onClick={() => gameActions.choose(i)}>
              <span className="ol">{o.label}</span>
              {o.tag ? <span className="ot">{o.tag}</span> : <span />}
              {o.sub && <span className="os">{o.sub}</span>}
            </button>
          ))}
        </div>
      </section>
    );
  }

  const sub = c.team
    ? `${stageLabel(c)} · ${c.team.name} · 예상 역할 ${roleOf(currentExpectedMinutes(c))}`
    : "무소속 · 개인 훈련 시즌";

  return (
    <section className="panel train">
      <div className="train-body">
        <span className="label">이번 시즌 훈련 초점</span>
        <div className="chips" role="group" aria-label="훈련 초점">
          {FOCUS.map(([k, name]) => (
            <button type="button" key={k} className="chip" aria-pressed={c.focus === k} onClick={() => gameActions.setFocus(k)}>
              {name}
            </button>
          ))}
        </div>
        <p className="hint">{focusHint(c)}</p>
      </div>
      <button
        type="button"
        className="advance"
        onClick={() => {
          gameActions.advanceSeason();
          onAdvance();
        }}
      >
        <span>
          <span className="t">{c.year} 시즌 진행</span>
          <span className="s">{sub}</span>
        </span>
        <span className="go" aria-hidden="true">
          ▶
        </span>
      </button>
    </section>
  );
}
