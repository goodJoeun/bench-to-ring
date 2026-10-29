"use client";

import { addTransitionType, startTransition, useRef, useState, ViewTransition } from "react";
import { NAME_MAX, POS, type CareerSummary } from "@/game";
import { gameActions, type CreationDraft } from "@/lib/game-store";
import { HallOfFame } from "@/components/common/HallOfFame";
import { Segmented } from "@/components/common/ui";
import { CandidateCard } from "./CandidateCard";
import { CareerPath } from "./CareerPath";
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

/** 선수 만들기 단계. 표지는 -1이에요. */
const STEPS = [
  { name: "캐릭터", title: "선수의 모습을 선택하세요." },
  { name: "포지션", title: "포지션을 선택하세요." },
  { name: "플레이 스타일", title: "플레이 스타일을 선택하세요." },
  { name: "선수 정보", title: "이름을 지어 주세요" },
] as const;
const LAST = STEPS.length - 1;

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

  const go = (to: number) => {
    if (to === step) return;
    startTransition(() => {
      addTransitionType(to > step ? "step-forward" : "step-back");
      setStep(to);
    });
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
          <ol className="wiz-steps" aria-label="선수 만들기 단계">
            {STEPS.map((s, i) => (
              <li key={s.name} data-state={i < step ? "done" : i === step ? "now" : undefined}>
                <button type="button" aria-current={i === step ? "step" : undefined} onClick={() => go(i)}>
                  <span className="wiz-n">{i + 1}</span>
                  <span className="wiz-name">{s.name}</span>
                </button>
              </li>
            ))}
          </ol>

          <ViewTransition key={step} enter={SLIDE} exit={SLIDE} default="none">
            <div className="wiz-body">
              <div className="wiz-head">
                <span className="label">
                  {step + 1} / {STEPS.length} · {STEPS[step].name}
                </span>
                <h2>{STEPS[step].title}</h2>
              </div>

              {step === 0 && (
                <div className="field">
                  <LookPicker look={draft.look} jersey={draft.jersey} looks={draft.looks} jerseys={draft.jerseys} />
                  <p className="hint">유니폼은 고교 시절 색이에요. 프로에 가면 소속팀 색을 입어요.</p>
                </div>
              )}

              {step === 1 && (
                <div className="field">
                  <Segmented
                    className="pos-seg"
                    label="포지션"
                    options={POSITIONS}
                    value={draft.pos}
                    onChange={gameActions.choosePosition}
                  />
                  <p className="hint">{posHint(draft.pos)}</p>
                </div>
              )}

              {step === 2 && (
                <div className="field">
                  <div className="flabel-row">
                    <span className="label">모두 오버롤 45, 시작 능력치 55 이하, 16세 기준 · 플레이 유형은 무작위</span>
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

              {step === 3 && (
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
                    {/* label로 감싸면 목록 항목을 누를 때 버튼이 다시 눌려 목록이 또 열려서 div로 묶어요. */}
                    <div className="f">
                      <span id="f-nat-label">국적</span>
                      <NationPicker labelledBy="f-nat-label" value={draft.nat} onChange={(nat) => gameActions.editDraft({ nat })} />
                    </div>
                    <div className="f">
                      <span id="f-school-label">고등학교</span>
                      <SchoolPicker
                        labelledBy="f-school-label"
                        value={draft.school}
                        onChange={(school) => gameActions.editDraft({ school })}
                      />
                    </div>
                  </div>
                  <p className="hint">{natHint(draft.nat)}</p>
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
        {step < LAST ? (
          <button type="button" className="start" onClick={() => go(step + 1)}>
            다음 →
          </button>
        ) : (
          <button type="button" className="start" onClick={() => setSheet(hasName ? "confirm" : "name")}>
            이 선수로 커리어 시작
          </button>
        )}
      </div>

      {sheet === "confirm" && <ConfirmStartSheet draft={draft} onClose={() => setSheet(null)} />}
      {sheet === "name" && <NameRequiredSheet onClose={() => setSheet(null)} onName={goToName} />}
    </>
  );
}
