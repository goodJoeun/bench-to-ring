"use client";

import { addTransitionType, startTransition, useMemo, useRef, useState, ViewTransition } from "react";
import { useQuery } from "@tanstack/react-query";
import { NAME_MAX, POS, fmtNum, type CareerSummary } from "@/game";
import { boardDaysQuery } from "@/shared/leaderboard/queries";
import { gameActions, type CreationDraft } from "@/shared/store/game-store";
import { HallOfFame } from "@/features/hall-of-fame/HallOfFame";
import { Segmented } from "@/shared/ui/ui";
import { CandidateCard } from "./CandidateCard";
import { CareerPath } from "./CareerPath";
import { ChallengeCard } from "./ChallengeCard";
import { ConfirmStartSheet } from "./ConfirmStartSheet";
import { NationPicker, SchoolPicker } from "./LogoPicker";
import { LookPicker } from "./LookPicker";
import { MyEndings } from "./MyEndings";
import { NameRequiredSheet } from "./NameRequiredSheet";
import { POSITIONS } from "./options";

/** 국가대표 발탁과 고른 국적의 병역 안내 */
function natHint(nat: string): string {
  const duty =
    nat === "대한민국" ? "대한민국 선수는 병역 의무가 있고, 아시안게임 금메달·올림픽 메달로 특례를 받을 수 있어요." : "병역 의무는 없어요.";
  return `대표팀 수준에 따라 국가대표 발탁에 필요한 실력이 달라져요. ${duty}`;
}

const STEPS = {
  look: { name: "캐릭터", title: "선수의 모습을 선택하세요." },
  pos: { name: "포지션", title: "포지션을 선택하세요." },
  style: { name: "플레이 스타일", title: "플레이 스타일을 선택하세요." },
  today: { name: "오늘의 선수", title: "오늘의 챌린지 선수예요." },
  info: { name: "선수 정보", title: "이름을 지어 주세요" },
} as const;
type StepId = keyof typeof STEPS;
/** 선수 만들기 단계. 표지는 -1이에요. */
const FLOW: readonly StepId[] = ["look", "pos", "style", "info"];
/** 챌린지 모드: 포지션과 플레이 스타일은 정해져 있어서, 고르는 대신 오늘의 선수를 보여줘요. */
const CHALLENGE_FLOW: readonly StepId[] = ["look", "today", "info"];

/** 2026-11-20 → 11월 20일 */
const dayText = (day: string) => `${Number(day.slice(5, 7))}월 ${Number(day.slice(8))}일`;

/** 단계를 넘길 때 앞으로는 오른쪽에서, 뒤로는 왼쪽에서 들어와요. 이 타입이 없는 전환(다른 업데이트)에는 움직이지 않아요. */
const SLIDE = {
  "step-forward": "step-forward",
  "step-back": "step-back",
  default: "none",
};

/** 포지션 설명: 이름과 키 범위 */
function posHint(pos: CreationDraft["pos"]): string {
  const { h } = POS[pos];
  return `${POS[pos].name} · 키 ${h[0]}~${h[1]}cm`;
}

export function CreateScreen({ draft, hall, endings }: { draft: CreationDraft; hall: CareerSummary[]; endings: string[] }) {
  const [step, setStep] = useState(-1);
  const [sheet, setSheet] = useState<"confirm" | "name" | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const hasName = draft.name.trim().length > 0;
  const ch = draft.challenge;
  const flow = ch ? CHALLENGE_FLOW : FLOW;
  const last = flow.length - 1;
  const id = flow[Math.min(Math.max(step, 0), last)];
  // 포지션마다 온라인 랭킹에 오른 은퇴 선수 수. 불러오기 전이나 실패하면 수를 빼고 보여줘요.
  const byPos = useQuery(boardDaysQuery()).data?.byPos;
  const positions = useMemo(
    () => (byPos ? POSITIONS.map((o) => ({ ...o, note: `은퇴 ${fmtNum(byPos[o.key] ?? 0)}명` })) : POSITIONS),
    [byPos],
  );

  const go = (to: number) => {
    if (to === step) return;
    startTransition(() => {
      addTransitionType(to > step ? "step-forward" : "step-back");
      setStep(to);
    });
    // 표지로 돌아가면 챌린지 모드를 나가요. 다음에 '커리어 시작하기'를 누르면 일반 선수 만들기예요.
    if (to < 0) gameActions.leaveChallenge();
    window.scrollTo({ top: 0 });
  };

  // 시트가 닫히며 시작 버튼으로 초점을 돌려놓은 뒤에 이름 칸으로 옮겨요.
  const goToName = () => {
    setSheet(null);
    requestAnimationFrame(() => {
      nameRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
      nameRef.current?.focus({ preventScroll: true });
    });
  };

  // 아래에 고정된 버튼 줄은 밀려 움직이지 않게 ViewTransition 밖에 둬요.
  if (step < 0)
    return (
      <>
        <ViewTransition key="cover" enter={SLIDE} exit={SLIDE} default="none">
          <div className="cover-wrap">
            <section className="cover">
              <div className="label">벤치 뎁혀 반지 굽기</div>
              <h1>
                농구 선수 <em>키우기</em>
              </h1>
              <p className="lede">
                고교 벤치 멤버로 시작해 드래프트, 주전, 올스타를 거쳐 MVP와 우승 반지까지. 시즌마다 쌓이는 기록과 선택으로 나만의 농구
                인생을 완성하세요.
              </p>
              <CareerPath />
            </section>
            {/* 오늘의 챌린지는 눈에 잘 띄게 표지 바로 아래에 둬요. */}
            <div className="resume">
              <ChallengeCard
                onPick={(pos) => {
                  gameActions.enterChallenge(pos);
                  go(0);
                }}
              />
            </div>
            {/* 내 기록이 없어도 온라인 랭킹을 볼 수 있게 늘 보여줘요. 첫 화면은 오늘 랭킹 Top 5와 오늘의 베스트 5만, 나머지는 랭킹 페이지에서 봐요. */}
            {/* 은퇴한 선수가 있으면 랭킹 위에서 바로 엔딩을 다시 열어요. */}
            {endings.length > 0 && (
              <div className="resume">
                <MyEndings hall={hall} endings={endings} />
              </div>
            )}
            <div className="resume">
              <HallOfFame hall={hall} rows={5} today />
            </div>
          </div>
        </ViewTransition>
        <button type="button" className="start cover-start" onClick={() => go(0)}>
          커리어 시작하기
        </button>
      </>
    );

  return (
    <>
      <ViewTransition key="wizard" enter={SLIDE} exit={SLIDE} default="none">
        <section className="panel create wiz">
          <ol className="wiz-steps" aria-label="선수 만들기 단계" style={{ "--steps": flow.length } as React.CSSProperties}>
            {flow.map((sid, i) => (
              <li key={sid} data-state={i < step ? "done" : i === step ? "now" : undefined}>
                <button type="button" aria-current={i === step ? "step" : undefined} onClick={() => go(i)}>
                  <span className="wiz-n">{i + 1}</span>
                  <span className="wiz-name">{STEPS[sid].name}</span>
                </button>
              </li>
            ))}
          </ol>

          <ViewTransition key={step} enter={SLIDE} exit={SLIDE} default="none">
            <div className="wiz-body">
              <div className="wiz-head">
                <span className="label">
                  {ch && `오늘의 챌린지 ${ch.pos} · `}
                  {step + 1} / {flow.length} · {STEPS[id].name}
                </span>
                <h2>{STEPS[id].title}</h2>
              </div>

              {id === "look" && (
                <div className="field">
                  <LookPicker look={draft.look} jersey={draft.jersey} looks={draft.looks} jerseys={draft.jerseys} />
                  <p className="hint">유니폼은 고교 시절 색이에요. 프로에 가면 소속팀 색을 입어요.</p>
                </div>
              )}

              {id === "pos" && (
                <div className="field">
                  <Segmented
                    className="pos-seg"
                    label="포지션"
                    options={positions}
                    value={draft.pos}
                    onChange={gameActions.choosePosition}
                  />
                  <p className="hint">
                    {posHint(draft.pos)}
                    {byPos && " · 은퇴 수는 온라인 랭킹에 오른 모든 선수 기준이에요."}
                  </p>
                </div>
              )}

              {id === "today" && ch && (
                <div className="field">
                  <span className="label">
                    {dayText(ch.day)} · {ch.pos} {POS[ch.pos].name} · 오늘 이 포지션은 누구나 이 선수로 시작해요
                  </span>
                  <div className="cands one">
                    <CandidateCard cand={ch.cand} pos={ch.pos} look={draft.look} jersey={draft.jersey} index={0} selected fixed />
                  </div>
                  <p className="hint">
                    국적 {ch.nat} · {ch.school}. 능력치와 키는 물론, 뛰어봐야 알 수 있는 잠재력과 숨겨진 성장 특성까지 모두 같아요. 은퇴하면
                    일반 랭킹과 함께 오늘의 챌린지 랭킹에도 올라가요.
                  </p>
                </div>
              )}

              {id === "style" && (
                <div className="field">
                  <div className="flabel-row">
                    <span className="label">모두 오버롤 45, 시작 능력치 57 이하, 16세 기준 · 플레이 유형은 무작위</span>
                    <button type="button" className="btn" disabled={!draft.rerolls} onClick={gameActions.reroll}>
                      후보 다시 뽑기 · {draft.rerolls}회 남음
                    </button>
                  </div>
                  <div className="cands">
                    {draft.candidates.map((c, i) => (
                      <CandidateCard
                        key={`${draft.pos}-${i}-${c.arch}-${c.h}`}
                        cand={c}
                        pos={draft.pos}
                        look={draft.look}
                        jersey={draft.jersey}
                        index={i}
                        selected={draft.selected === i}
                      />
                    ))}
                  </div>
                  <p className="hint">잠재력과 숨겨진 성장 특성은 뛰어봐야 알 수 있어요.</p>
                </div>
              )}

              {id === "info" && (
                <div className="field">
                  <div className="form-grid">
                    <label className="f" htmlFor="f-name">
                      선수 이름
                      <input
                        id="f-name"
                        ref={nameRef}
                        maxLength={NAME_MAX}
                        required
                        aria-required="true"
                        placeholder="이름을 지어 주세요"
                        value={draft.name}
                        onChange={(e) => gameActions.editDraft({ name: e.target.value })}
                      />
                    </label>
                    <label className="f" htmlFor="f-num">
                      등번호
                      <input
                        id="f-num"
                        type="number"
                        min={0}
                        max={99}
                        value={draft.num}
                        onChange={(e) => gameActions.editDraft({ num: e.target.value })}
                      />
                    </label>
                    {ch ? (
                      // 챌린지에서는 국적과 고등학교가 정해져 있어요.
                      <>
                        <div className="f">
                          <span>국적</span>
                          <span className="f-fixed">{ch.nat}</span>
                        </div>
                        <div className="f">
                          <span>고등학교</span>
                          <span className="f-fixed">{ch.school}</span>
                        </div>
                      </>
                    ) : (
                      <>
                        {/* label로 감싸면 목록 항목을 누를 때 버튼이 다시 눌려 목록이 또 열려서 div로 묶어요. */}
                        <div className="f">
                          <span id="f-nat-label">국적</span>
                          <NationPicker labelledBy="f-nat-label" value={draft.nat} onChange={(nat) => gameActions.editDraft({ nat })} />
                        </div>
                        <div className="f">
                          <span id="f-school-label">고등학교</span>
                          <SchoolPicker
                            nat={draft.nat}
                            labelledBy="f-school-label"
                            value={draft.school}
                            onChange={(school) => gameActions.editDraft({ school })}
                          />
                        </div>
                      </>
                    )}
                  </div>
                  <p className="hint">{ch ? `챌린지에서는 국적과 고등학교가 정해져 있어요. ${natHint(ch.nat)}` : natHint(draft.nat)}</p>
                </div>
              )}
            </div>
          </ViewTransition>
        </section>
      </ViewTransition>

      <div className="wiz-nav">
        <button type="button" className="start sub" onClick={() => go(step - 1)}>
          {step === 0 ? "← 처음으로" : "← 이전"}
        </button>
        {step < last ? (
          <button type="button" className="start" onClick={() => go(step + 1)}>
            다음 →
          </button>
        ) : (
          <button type="button" className="start" onClick={() => setSheet(hasName ? "confirm" : "name")}>
            {ch ? "이 선수로 챌린지 시작" : "이 선수로 커리어 시작"}
          </button>
        )}
      </div>

      {sheet === "confirm" && <ConfirmStartSheet draft={draft} onClose={() => setSheet(null)} />}
      {sheet === "name" && <NameRequiredSheet onClose={() => setSheet(null)} onName={goToName} />}
    </>
  );
}
