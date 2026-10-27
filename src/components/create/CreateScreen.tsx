"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { type CareerSummary } from "@/game";
import { gameActions, type CreationDraft } from "@/lib/game-store";
import { HallOfFame } from "@/components/common/HallOfFame";
import { Segmented } from "@/components/common/ui";
import { CandidateCard } from "./CandidateCard";
import { ConfirmStartSheet } from "./ConfirmStartSheet";
import { NameRequiredSheet } from "./NameRequiredSheet";
import { POSITIONS } from "./options";
import { SchoolPicker } from "./SchoolPicker";

export function CreateScreen({ draft, hall }: { draft: CreationDraft; hall: CareerSummary[] }) {
  const [sheet, setSheet] = useState<"confirm" | "name" | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const hasName = draft.name.trim().length > 0;

  // 시트가 닫히며 시작 버튼으로 초점을 돌려놓은 뒤에 이름 칸으로 옮겨요.
  const goToName = () => {
    setSheet(null);
    requestAnimationFrame(() => {
      nameRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
      nameRef.current?.focus({ preventScroll: true });
    });
  };

  return (
    <>
      <section className="intro">
        <div className="intro-head">
          <div>
            <div className="label">벤치 뎁혀 반지 굽기</div>
            <h1>
              농구 선수
              <br />
              <em>키우기</em>
            </h1>
          </div>
          {/* 도트 그림이라 최적화(리샘플링) 없이 원본 그대로 키워 보여줘요. scripts/hero-art.mjs가 만들어요. */}
          <Image
            className="intro-art"
            src="/hero/bench-to-mvp.png"
            width={120}
            height={80}
            unoptimized
            loading="eager"
            alt="벤치에 수건을 쓰고 앉은 선수와 MVP 트로피를 번쩍 든 선수"
          />
        </div>
        <p className="lede">
          고교 벤치 멤버로 시작해 드래프트, 주전, 올스타를 거쳐 MVP와 우승 반지까지. 시즌마다 쌓이는 기록과 선택으로 나만의
          농구 인생을 완성하세요.
        </p>
      </section>

      <section className="panel create">
        <div className="form-grid">
          <label className="f" htmlFor="f-name">
            선수 이름
            <input
              id="f-name"
              ref={nameRef}
              maxLength={12}
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
            <span id="f-school-label">고등학교</span>
            <SchoolPicker labelledBy="f-school-label" value={draft.school} onChange={(school) => gameActions.editDraft({ school })} />
          </div>
        </div>

        <div className="field">
          <span className="label">포지션</span>
          <Segmented className="pos-seg" label="포지션" options={POSITIONS} value={draft.pos} onChange={gameActions.choosePosition} />
        </div>

        <div className="field">
          <div className="flabel-row">
            <span className="label">후보 선수 · 모두 오버롤 45, 시작 능력치 55 이하, 16세 기준 · 플레이 유형은 무작위</span>
            <button type="button" className="btn" disabled={!draft.rerolls} onClick={gameActions.reroll}>
              후보 다시 뽑기 · {draft.rerolls}회 남음
            </button>
          </div>
          <div className="cands">
            {draft.candidates.map((c, i) => (
              <CandidateCard key={`${draft.pos}-${i}-${c.arch}-${c.h}`} cand={c} pos={draft.pos} index={i} selected={draft.selected === i} />
            ))}
          </div>
          <p className="hint">잠재력과 숨겨진 성장 특성은 뛰어봐야 알 수 있어요.</p>
        </div>

        <button type="button" className="start" onClick={() => setSheet(hasName ? "confirm" : "name")}>
          이 선수로 커리어 시작
        </button>
      </section>

      {sheet === "confirm" && <ConfirmStartSheet draft={draft} onClose={() => setSheet(null)} />}
      {sheet === "name" && <NameRequiredSheet onClose={() => setSheet(null)} onName={goToName} />}

      {/* 내 기록이 없어도 온라인 랭킹을 볼 수 있게 늘 보여줘요. */}
      <div className="resume">
        <HallOfFame hall={hall} />
      </div>
    </>
  );
}
