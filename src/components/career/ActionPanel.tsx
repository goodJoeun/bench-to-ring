"use client";

import { useEffect, useState } from "react";
import {
  FOCUS,
  currentDecision,
  currentExpectedMinutes,
  josa,
  money,
  negotiable,
  ro,
  roleOf,
  seasonProgress,
  stageLabel,
  type Action,
  type Career,
  type Decision,
  type DecisionOption,
  type FocusKey,
  type SeasonRun,
} from "@/game";
import { gameActions, type Speed } from "@/lib/game-store";
import { focusName } from "@/components/common/format";
import { InvestPicker } from "./InvestPicker";
import { Sheet } from "@/components/common/Sheet";
import { TeamBadge } from "@/components/common/TeamBadge";
import { Choice } from "@/components/common/ui";

/** 팀이 걸린 선택지(입학, 계약 제안)에는 그 팀 엠블럼을 붙여요. 협상 중인 같은 팀 선택지에는 붙이지 않아요. */
function optionBadge(a: Action): React.ReactNode {
  if ((a.k === "sign" && !a.deal) || a.k === "school") return <TeamBadge name={a.team.name} kind={a.lg} color={a.team.color} size={30} />;
  return undefined;
}

/** 되묻는 문구: 제목, 설명, 확인 버튼 */
interface Confirm {
  title: string;
  desc: string;
  yes: string;
}

/**
 * 되돌리기 어려운 선택(팀 고르기, 위약금 해지)은 한 번 더 물어요.
 * 같은 팀이면 재계약, 다른 팀이면 이적, 소속팀이 없으면 입단으로 물어요.
 */
function confirmOf(c: Career, o: DecisionOption): Confirm | null {
  const a = o.act;
  if (a.k === "buyout")
    return {
      title: `정말 위약금 ${money(a.cost)}을 내고 계약을 해지할까요?`,
      desc: `${josa(c.team?.name ?? "지금 팀", "을", "를")} 떠나 FA 시장에 나가요. 위약금은 돌려받을 수 없어요.`,
      yes: "네, 해지할게요",
    };
  if (a.k !== "sign" || a.deal) return null;
  const name = a.team.name;
  const same = c.team?.name === name;
  const nego = negotiable(a) ? " 고르면 연봉 협상을 거쳐 계약해요." : " 협상 없이 이 조건으로 바로 계약해요.";
  const desc = `${o.sub ?? ""}.${nego}`;
  if (same) return { title: `정말 ${josa(name, "과", "와")} 재계약할까요?`, desc, yes: "네, 재계약할게요" };
  if (c.team) return { title: `정말 ${ro(name)} 이적할까요?`, desc: `${josa(c.team.name, "을", "를")} 떠나요. ${desc}`, yes: "네, 이적할게요" };
  return { title: `정말 ${name}에 입단할까요?`, desc, yes: "네, 입단할게요" };
}

/** 결정 시트. 되묻는 선택지는 고르면 같은 시트 안에서 확인 화면으로 바뀌어요. */
function DecisionSheet({ career: c, decision, kind, remaining, onHide }: { career: Career; decision: Decision; kind: string; remaining: number; onHide: () => void }) {
  const [asking, setAsking] = useState<number | null>(null);
  const confirm = asking !== null ? confirmOf(c, decision.opts[asking]) : null;
  if (asking !== null && confirm)
    return (
      <Sheet labelledBy="confirm-title" onClose={() => setAsking(null)}>
        <span className="sheet-kicker">{decision.title}</span>
        <h2 id="confirm-title">{confirm.title}</h2>
        <p className="sheet-desc">{confirm.desc}</p>
        <button type="button" className="sheet-go" onClick={() => gameActions.choose(asking)}>
          {confirm.yes}
        </button>
        <button type="button" className="sheet-later" onClick={() => setAsking(null)}>
          다시 고를게요
        </button>
      </Sheet>
    );
  return (
    <Sheet labelledBy="decision-title">
      <span className="sheet-kicker">
        {kind}
        {remaining > 1 && ` · 남은 결정 ${remaining}개`}
      </span>
      <h2 id="decision-title">{decision.title}</h2>
      <p className="sheet-desc">{decision.body}</p>
      <div className="choices">
        {decision.opts.map((o, i) => (
          <Choice
            key={`${o.label}-${i}`}
            label={o.label}
            tag={o.tag}
            sub={o.sub}
            icon={optionBadge(o.act)}
            onClick={() => (confirmOf(c, o) ? setAsking(i) : gameActions.choose(i))}
          />
        ))}
      </div>
      <button type="button" className="sheet-later" onClick={onHide}>
        잠시 닫고 둘러보기
      </button>
    </Sheet>
  );
}

function focusHint(k: FocusKey): string {
  if (k === "bal") return "모든 능력치를 고르게 키워요.";
  if (k === "rest") return "성장은 느려지지만 건강을 회복하고 부상 위험이 줄어요.";
  return `${focusName(k)} 성장이 1.5배로 빨라지고, 나머지는 조금 느려져요.`;
}

/**
 * 1배속에서 한 칸을 보여주는 시간(ms). 정규시즌은 리그 경기 수와 상관없이 한 시즌이 30초 남짓 걸리게 맞추고,
 * 프리시즌·플레이오프 라운드·결산과 팀 없는 시즌의 일정은 읽을 시간을 조금 더 줘요.
 */
function beatMs(run: SeasonRun): number {
  if (run.plan.length) return 1800;
  if (run.phase === "reg") return Math.min(1500, Math.max(450, 32000 / run.games));
  return 1500;
}

interface ActionPanelProps {
  career: Career;
  playing: boolean;
  speed: Speed;
  /** 진행 팝업이 떠 있는 동안에는 결정 시트를 열지 않고 시즌도 멈춰요. */
  busy: boolean;
  onAdvance: () => void;
}

/**
 * 탭 바 위에 고정된 진행 영역과, 거기서 여는 시트들.
 * - 결정이 남았으면: 결정 시트가 자동으로 올라와요. 잠시 닫았다가 버튼으로 다시 열 수 있어요.
 * - 시즌 중이면: 진행 막대와 재생·배속·건너뛰기 버튼이 있고, 시즌이 저절로 한 칸씩 흘러가요.
 * - 시즌 사이면: 시즌 계획 시트에서 훈련 초점과 투자를 고르고 시즌을 시작해요.
 */
export function ActionPanel({ career: c, playing, speed, busy, onAdvance }: ActionPanelProps) {
  const decision = currentDecision(c);
  const run = c.run;
  const [planOpen, setPlanOpen] = useState(false);
  // 결정마다 한 번은 자동으로 열려요. 사용자가 닫은 결정만 기억해요.
  const decisionKey = `${c.year}:${run ? `${run.g}:${run.step}:${run.shown}` : "off"}:${c.queue.length}:${decision?.title ?? ""}`;
  const [hiddenKey, setHiddenKey] = useState<string | null>(null);
  const decisionOpen = !!decision && !busy && hiddenKey !== decisionKey;

  // 시즌 시계: 재생 중이고 결정·팝업이 없으면 한 칸씩 진행해요. 칸이 바뀔 때마다 다음 칸을 예약해요.
  const ticking = !!run && playing && !decision && !busy;
  const beat = run ? `${run.phase}:${run.g}:${run.shown}:${run.step}` : "";
  const delay = run ? beatMs(run) / speed : 0;
  useEffect(() => {
    if (!ticking) return;
    const timer = setTimeout(() => gameActions.step(), delay);
    return () => clearTimeout(timer);
  }, [ticking, beat, delay]);

  if (decision) {
    const remaining = c.queue.length;
    const kind = run ? "시즌 중 결정" : "오프시즌 결정";
    return (
      <>
        <button type="button" className="advance pending" onClick={() => setHiddenKey(null)}>
          <span>
            <span className="t">{kind}</span>
            <span className="s">
              {remaining > 1 ? `남은 결정 ${remaining}개` : run ? "고르면 시즌이 이어져요" : "마지막 결정이에요"} · 눌러서 이어서 고르기
            </span>
          </span>
          <span className="go" aria-hidden="true">
            ▶
          </span>
        </button>
        {decisionOpen && (
          <DecisionSheet
            key={decisionKey}
            career={c}
            decision={decision}
            kind={kind}
            remaining={remaining}
            onHide={() => setHiddenKey(decisionKey)}
          />
        )}
      </>
    );
  }

  if (run) return <RunBar run={run} playing={playing} speed={speed} />;

  const sub = c.team
    ? `${stageLabel(c)} · ${c.team.name} · 예상 역할 ${roleOf(currentExpectedMinutes(c))}`
    : c.stage === "military"
      ? `${stageLabel(c)} · 시즌이 끝나면 전역해요`
      : "무소속 · 개인 훈련 시즌";

  return (
    <>
      <button type="button" className="advance" aria-haspopup="dialog" onClick={() => setPlanOpen(true)}>
        <span>
          <span className="t">{c.year} 시즌 시작</span>
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
          <p className="sheet-desc">이번 시즌에 집중할 훈련을 고르고 시즌을 시작하세요. 시즌 중에는 바꿀 수 없어요.</p>
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
              gameActions.startSeason();
              onAdvance();
            }}
          >
            {ro(`${focusName(c.focus)} 훈련${c.invest.length > 0 ? ` · 투자 ${c.invest.length}개` : ""}`)} 시즌 시작
          </button>
        </Sheet>
      )}
    </>
  );
}

/** 시즌 중 진행 막대: 지금 단계, 팀 성적, 재생·일시정지, 배속, 끝까지 건너뛰기 */
function RunBar({ run, playing, speed }: { run: SeasonRun; playing: boolean; speed: Speed }) {
  const { label, pct } = seasonProgress(run);
  const status = run.plan.length
    ? `${run.year} 시즌 · ${run.step}/${run.plan.length}`
    : `${run.w}승 ${run.l}패${run.out > 0 ? ` · ${run.outWhy} 결장 ${run.out}경기 남음` : ""}`;
  return (
    <div className="run-bar" role="group" aria-label="시즌 진행">
      <div className="run-info">
        <span className="t">{label}</span>
        <span className="s">{status}</span>
        <div className="run-track" role="progressbar" aria-label="시즌 진행률" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct * 100)}>
          <div className="run-fill" style={{ width: `${pct * 100}%` }} />
        </div>
      </div>
      <div className="run-ctrl">
        <button
          type="button"
          className="run-btn play"
          aria-label={playing ? "일시정지" : "재생"}
          aria-pressed={playing}
          onClick={() => gameActions.setPlaying(!playing)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            {playing ? <path d="M6 5h4v14H6zm8 0h4v14h-4z" /> : <path d="M7 4.5v15L19.5 12z" />}
          </svg>
        </button>
        <button type="button" className="run-btn" aria-label={`진행 속도 ${speed}배, 눌러서 바꾸기`} onClick={() => gameActions.cycleSpeed()}>
          <span className="run-speed">{speed}x</span>
        </button>
        <button type="button" className="run-btn" aria-label="결정이 나올 때까지 건너뛰기" onClick={() => gameActions.skip()}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 5v14l8-7zm8 0v14l8-7z" />
            <path d="M20 5h2v14h-2z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
