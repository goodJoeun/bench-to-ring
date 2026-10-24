"use client";

import { useState } from "react";
import { TEAMS, type CareerSummary } from "@/game";
import { gameActions, type CreationDraft } from "@/lib/game-store";
import { HallOfFame } from "@/components/common/HallOfFame";
import { ImportForm } from "@/components/common/ImportForm";
import { Panel, Segmented } from "@/components/common/ui";
import { CandidateCard } from "./CandidateCard";
import { ConfirmStartSheet } from "./ConfirmStartSheet";
import { POSITIONS } from "./options";

export function CreateScreen({ draft, hall }: { draft: CreationDraft; hall: CareerSummary[] }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  return (
    <>
      <section className="intro">
        <div>
          <div className="label">벤치 뎁혀 반지 굽기</div>
          <h1>
            농구 선수
            <br />
            <em>키우기</em>
          </h1>
          <p className="lede">
            고교 벤치 멤버로 시작해 드래프트, 주전, 올스타를 거쳐 MVP와 우승 반지까지. 시즌마다 쌓이는 기록과 선택으로 나만의
            농구 인생을 완성하세요.
          </p>
        </div>
      </section>

      <section className="panel create">
        <div className="form-grid">
          <label className="f" htmlFor="f-name">
            선수 이름
            <input
              id="f-name"
              maxLength={12}
              placeholder="닉네임을 추천해요"
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
          <label className="f" htmlFor="f-school">
            고등학교
            <select id="f-school" value={draft.school} onChange={(e) => gameActions.editDraft({ school: e.target.value })}>
              <option value="">무작위 배정</option>
              {TEAMS.hs.map(([name]) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="field">
          <span className="label">포지션</span>
          <Segmented label="포지션" options={POSITIONS} value={draft.pos} onChange={gameActions.choosePosition} />
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

        <button type="button" className="start" onClick={() => setConfirmOpen(true)}>
          이 선수로 커리어 시작
        </button>
      </section>

      <Panel title="저장 코드로 이어하기" className="resume">
        <ImportForm placeholder="다른 기기에서 복사한 저장 코드를 붙여넣으세요" />
      </Panel>

      {confirmOpen && <ConfirmStartSheet draft={draft} onClose={() => setConfirmOpen(false)} />}

      {hall.length > 0 && (
        <div className="resume">
          <HallOfFame hall={hall} />
        </div>
      )}
    </>
  );
}
