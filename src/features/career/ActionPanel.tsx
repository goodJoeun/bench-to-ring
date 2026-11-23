"use client";

import { useEffect, useState } from "react";
import {
  FOCUS,
  INVEST_SLOTS,
  canInvest,
  chosenInvest,
  currentDecision,
  currentExpectedMinutes,
  formLines,
  isCoreAttr,
  josa,
  money,
  negotiable,
  playerLook,
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
import { gameActions, type Outcome, type Speed } from "@/shared/store/game-store";
import { focusName } from "@/shared/lib/format";
import { InvestPicker } from "./InvestPicker";
import { ClutchArt, ClutchFlash, ClutchResult } from "./ClutchArt";
import { RivalArt } from "./RivalArt";
import { SceneArt } from "./SceneArt";
import { Sheet } from "@/shared/ui/Sheet";
import { TeamBadge } from "@/shared/ui/badge/TeamBadge";
import { Choice } from "@/shared/ui/ui";

/** 팀이 걸린 선택지(입학, 계약 제안)에는 그 팀 엠블럼을 붙여요. 협상 중인 같은 팀 선택지에는 붙이지 않아요. */
function optionBadge(a: Action): React.ReactNode {
  if ((a.k === "sign" && !a.deal) || a.k === "school" || a.k === "trade") return <TeamBadge name={a.team.name} kind={a.lg} color={a.team.color} size={30} />;
  return undefined;
}

/** 제안한 팀의 직전 시즌 성적. 협상 중인 같은 팀 선택지에는 붙이지 않아요. */
const optionForm = (a: Action) => (((a.k === "sign" && !a.deal) || a.k === "trade") && a.team.form ? formLines(a.team.form) : null);

/** 계약 선택지 아래의 지난 시즌 성적: 정규시즌과 플레이오프 */
function FormLine({ action }: { action: Action }) {
  const f = optionForm(action);
  if (!f) return null;
  return (
    <span className="cf">
      <span className="cf-k">지난 시즌</span>
      <span>
        정규시즌 <b>{f.regular}</b>
      </span>
      <span>
        플레이오프 <b>{f.playoff}</b>
      </span>
    </span>
  );
}

/** 되묻는 문구: 제목, 설명, 확인 버튼 */
interface Confirm {
  title: string;
  desc: string;
  yes: string;
  /** 커리어가 끝나는 선택이면 확인 단추를 빨갛게 보여줘요. */
  danger?: boolean;
}

/** 진로가 갈리는 선택의 확인 문구. 고를 수 있는 길이 하나뿐이면 묻지 않아요. */
function pathConfirmOf(o: DecisionOption, only: boolean): Confirm | null {
  if (only) return null;
  const a = o.act;
  const desc = `${o.sub ?? o.label}. 고른 뒤에는 되돌릴 수 없어요.`;
  if (a.k === "school") return { title: `정말 ${a.team.name}에 ${a.walk ? "워크온으로 " : ""}입학할까요?`, desc, yes: "네, 입학할게요" };
  if (a.k === "draft") return { title: `정말 ${o.label.replace(/ (신청|고졸 참가)$/, "")}에 참가할까요?`, desc, yes: "네, 참가할게요" };
  if (a.k === "trade") {
    const form = optionForm(a);
    const record = form ? ` 지난 시즌 정규시즌 ${form.regular}, 플레이오프 ${form.playoff}.` : "";
    return { title: `정말 ${ro(a.team.name)} 이적할까요?`, desc: `${josa(a.from, "을", "를")} 떠나요. ${o.sub ?? ""}.${record} 고른 뒤에는 되돌릴 수 없어요.`, yes: "네, 이적할게요" };
  }
  if (a.k === "military" && a.choice !== "defer")
    return a.choice === "sangmu"
      ? { title: "정말 상무에 지원할까요?", desc, yes: "네, 지원할게요" }
      : { title: "정말 현역으로 입대할까요?", desc, yes: "네, 입대할게요" };
  if (a.k === "retire")
    return {
      title: "정말 은퇴할까요?",
      desc: "커리어가 여기서 끝나고 되돌릴 수 없어요. 프로 무대를 밟았다면 선수 이름과 기록이 온라인 랭킹에 공개돼요.",
      yes: "네, 은퇴할게요",
      danger: true,
    };
  return null;
}

/**
 * 되돌리기 어려운 선택(팀 고르기, 위약금 해지, 진학·드래프트·트레이드·입대·은퇴)은 한 번 더 물어요.
 * 같은 팀이면 재계약, 다른 팀이면 이적, 소속팀이 없으면 입단으로 물어요.
 */
function confirmOf(c: Career, o: DecisionOption, only: boolean): Confirm | null {
  const a = o.act;
  if (a.k === "buyout")
    return {
      title: `정말 위약금 ${money(a.cost)}을 내고 계약을 해지할까요?`,
      desc: `${josa(c.team?.name ?? "지금 팀", "을", "를")} 떠나 FA 시장에 나가요. 위약금은 돌려받을 수 없어요.`,
      yes: "네, 해지할게요",
    };
  if (a.k !== "sign" || a.deal) return pathConfirmOf(o, only);
  const name = a.team.name;
  const same = c.team?.name === name;
  const nego = negotiable(a) ? " 고르면 연봉 협상을 거쳐 계약해요." : " 협상 없이 이 조건으로 바로 계약해요.";
  const form = optionForm(a);
  const record = form ? ` 지난 시즌 정규시즌 ${form.regular}, 플레이오프 ${form.playoff}.` : "";
  const desc = `${o.sub ?? ""}.${record}${nego}`;
  if (same) return { title: `정말 ${josa(name, "과", "와")} 재계약할까요?`, desc, yes: "네, 재계약할게요" };
  if (c.team) return { title: `정말 ${ro(name)} 이적할까요?`, desc: `${josa(c.team.name, "을", "를")} 떠나요. ${desc}`, yes: "네, 이적할게요" };
  return { title: `정말 ${name}에 입단할까요?`, desc, yes: "네, 입단할게요" };
}

/** 결정 시트. 되묻는 선택지는 고르면 같은 시트 안에서 확인 화면으로 바뀌어요. */
function DecisionSheet({ career: c, decision, kind, remaining, onHide }: { career: Career; decision: Decision; kind: string; remaining: number; onHide: () => void }) {
  const [asking, setAsking] = useState<number | null>(null);
  const only = decision.opts.length === 1;
  const confirm = asking !== null ? confirmOf(c, decision.opts[asking], only) : null;
  if (asking !== null && confirm)
    return (
      <Sheet labelledBy="confirm-title" guardKey="confirm" onClose={() => setAsking(null)}>
        <span className="sheet-kicker">{decision.title}</span>
        <h2 id="confirm-title">{confirm.title}</h2>
        <p className="sheet-desc">{confirm.desc}</p>
        <button type="button" className={confirm.danger ? "sheet-go danger" : "sheet-go"} onClick={() => gameActions.choose(asking)}>
          {confirm.yes}
        </button>
        <button type="button" className="sheet-later" data-autofocus onClick={() => setAsking(null)}>
          다시 고를게요
        </button>
      </Sheet>
    );
  return (
    <Sheet labelledBy="decision-title" guardKey="decision">
      {decision.art === "rival" && <RivalArt career={c} />}
      {decision.art === "clutch" && <ClutchArt board={decision.board} />}
      {!decision.art && decision.scene && <SceneArt career={c} scene={decision.scene} />}
      <span className="sheet-kicker">
        {kind}
        {remaining > 1 && ` · 남은 결정 ${remaining}개`}
      </span>
      <h2 id="decision-title">{decision.title}</h2>
      <p className="sheet-desc">{decision.body}</p>
      {c.hist.length === 0 && <p className="hint">고른 결과는 능력치, 건강, 코치 신뢰에 바로 반영돼요.</p>}
      <div className="choices">
        {decision.opts.map((o, i) => (
          <Choice
            key={`${o.label}-${i}`}
            label={o.label}
            tag={o.tag}
            sub={o.sub}
            icon={optionBadge(o.act)}
            detail={<FormLine action={o.act} />}
            onClick={() => (confirmOf(c, o, only) ? setAsking(i) : gameActions.choose(i))}
          />
        ))}
      </div>
      <button type="button" className="sheet-later" onClick={onHide}>
        잠시 닫고 둘러보기
      </button>
    </Sheet>
  );
}

/** 시작 버튼이 아래에 붙어 있어도 투자를 지나치지 않게, 고른 개수를 보여주고 누르면 투자 칸으로 옮겨요. */
function scrollToInvest() {
  const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.querySelector(".sheet .invest")?.scrollIntoView({ behavior: calm ? "auto" : "smooth", block: "start" });
}

/** 훈련 초점 설명: 능력치는 지금 수치와 포지션 핵심 여부. 집중 훈련 배율은 시트 설명에 한 번만 적어요. */
function focusHint(k: FocusKey, c: Career): string {
  if (k === "bal") return "모두 약 1.1배 성장";
  if (k === "rest") return "성장 0.6배 · 건강 회복, 부상 위험 감소";
  return `지금 ${Math.round(c.p.attrs[k])}${isCoreAttr(c.p.pos, k) ? " · 포지션 핵심" : ""}`;
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
  /** 방금 고른 시즌 중 결정의 결과. 떠 있는 동안 시즌이 멈춰요. */
  outcome: Outcome | null;
  onAdvance: () => void;
}

/**
 * 탭 바 위에 고정된 진행 영역과, 거기서 여는 시트들.
 * - 결정이 남았으면: 결정 시트가 자동으로 올라와요. 잠시 닫았다가 버튼으로 다시 열 수 있어요.
 * - 시즌 중 결정을 막 골랐으면: 진행 막대 자리에 결과를 잠깐 띄우고, 사라지면 시즌이 이어져요.
 * - 시즌 중이면: 진행 막대와 재생·배속·건너뛰기 버튼이 있고, 시즌이 저절로 한 칸씩 흘러가요.
 * - 시즌 사이면: 시즌 계획 시트에서 훈련 초점과 투자를 고르고 시즌을 시작해요.
 */
export function ActionPanel({ career: c, playing, speed, busy, outcome, onAdvance }: ActionPanelProps) {
  const decision = currentDecision(c);
  const run = c.run;
  const [planOpen, setPlanOpen] = useState(false);
  // 결정마다 한 번은 자동으로 열려요. 사용자가 닫은 결정만 기억해요.
  const decisionKey = `${c.year}:${run ? `${run.g}:${run.step}:${run.shown}` : "off"}:${c.queue.length}:${decision?.title ?? ""}`;
  const [hiddenKey, setHiddenKey] = useState<string | null>(null);
  const decisionOpen = !!decision && !busy && hiddenKey !== decisionKey;
  // 클러치는 결정 시트 전에 번개·불꽃 이펙트를 한 번 보여줘요. 잠시 닫았다 다시 열 때는 건너뛰어요.
  const [flashedKey, setFlashedKey] = useState<string | null>(null);
  const flashing = decisionOpen && decision.art === "clutch" && flashedKey !== decisionKey;
  // 클러치 결과는 성공·실패 이펙트를 먼저 보여주고, 끝나면 결과 카드를 띄워요.
  const [resultShown, setResultShown] = useState<number | null>(null);

  // 시즌 시계: 재생 중이고 결정·결과·팝업이 없으면 한 칸씩 진행해요. 칸이 바뀔 때마다 다음 칸을 예약해요.
  const ticking = !!run && playing && !decision && !busy && !outcome;
  const beat = run ? `${run.phase}:${run.g}:${run.shown}:${run.step}` : "";
  const delay = run ? beatMs(run) / speed : 0;
  useEffect(() => {
    if (!ticking) return;
    const timer = setTimeout(() => gameActions.step(), delay);
    return () => clearTimeout(timer);
  }, [ticking, beat, delay]);

  if (decision) {
    const remaining = c.queue.length;
    // 결승 클러치는 클럽 결승(시즌 중)과 국가대표 결승(오프시즌) 모두 같은 이름으로 보여줘요.
    const kind = decision.board?.finals ? "결승전" : run ? "시즌 중 결정" : "오프시즌 결정";
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
        {flashing && <ClutchFlash key={decisionKey} board={decision.board} onDone={() => setFlashedKey(decisionKey)} />}
        {decisionOpen && !flashing && (
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

  if (run && outcome?.clutch && resultShown !== outcome.id)
    return (
      <>
        <RunBar run={run} playing={playing} speed={speed} />
        <ClutchResult
          key={outcome.id}
          result={outcome.clutch}
          cast={{ look: playerLook(c.p), color: c.team?.color ?? "#2F5DB0", oppColor: outcome.clutch.oppColor, seed: outcome.clutch.opp }}
          onDone={() => setResultShown(outcome.id)}
        />
      </>
    );
  if (run && outcome) return <OutcomeCard key={outcome.id} outcome={outcome} />;
  if (run) return <RunBar run={run} playing={playing} speed={speed} />;

  // 지난 시즌에 고른 특별 투자가 이번 시즌에 없으면 세지 않아요.
  const invest = canInvest(c) ? chosenInvest(c).length : 0;
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
            {invest > 0 && ` · 투자 ${invest}개`}
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
          <p className="sheet-desc">집중 훈련한 능력치는 약 1.5배 빠르게 자라요. 시즌 중에는 바꿀 수 없어요.</p>
          <div className="choices focus-grid" role="radiogroup" aria-label="훈련 초점">
            {FOCUS.map(([k, name]) => (
              <Choice
                key={k}
                label={name}
                sub={focusHint(k, c)}
                role="radio"
                aria-checked={c.focus === k}
                onClick={() => gameActions.setFocus(k)}
              />
            ))}
          </div>
          <InvestPicker career={c} />
          <div className="sheet-dock">
            {canInvest(c) && (
              <button type="button" className="dock-invest" onClick={scrollToInvest}>
                <span>
                  시즌 투자 <b>{invest}/{INVEST_SLOTS}</b>
                </span>
                <span>
                  보유 <b>{money(c.earnings)}</b> <i aria-hidden="true">↓</i>
                </span>
              </button>
            )}
            <button
              type="button"
              className="sheet-go"
              onClick={() => {
                setPlanOpen(false);
                gameActions.startSeason();
                onAdvance();
              }}
            >
              {ro(`${focusName(c.focus)} 훈련${invest > 0 ? ` · 투자 ${invest}개` : ""}`)} 시즌 시작
            </button>
          </div>
        </Sheet>
      )}
    </>
  );
}

/**
 * 시즌 중 결정의 결과. 성공이면 초록, 실패면 빨강 바탕이에요. 배속과 상관없이 잠깐 띄워 두고, 아래 막대가 다 줄어들면 시즌이 이어져요.
 * 시간은 타이머 대신 막대의 CSS 애니메이션이 재고, 애니메이션이 끝나면(animationend) 닫아요.
 * 누르면 바로 이어가요. 결정 시트를 닫은 자리에 마우스가 그대로 놓이기 쉬워서, 마우스를 올려도 막대는 멈추지 않아요.
 */
function OutcomeCard({ outcome }: { outcome: Outcome }) {
  const close = () => gameActions.dismissOutcome(outcome.id);
  return (
    <div role="status" aria-live="polite">
      <button type="button" className="advance outcome" data-tone={outcome.tone} onClick={close}>
        <span>
          <span className="t">{outcome.label}</span>
          <span className="s">{outcome.msg}</span>
          {outcome.delta && <b className="delta">{outcome.delta}</b>}
        </span>
        <span className="sr-only">눌러서 바로 시즌 이어가기</span>
        <span className="go" aria-hidden="true">
          ▶
        </span>
        <span className="outcome-timer" aria-hidden="true" onAnimationEnd={close} />
      </button>
    </div>
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
