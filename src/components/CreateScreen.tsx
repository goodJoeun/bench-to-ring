"use client";

import { useState } from "react";
import {
  ARCHETYPES,
  ATTR_KEYS,
  NATIONS,
  POS,
  POS_KEYS,
  SHORT,
  ovrOf,
  type Archetype,
  type AttrKey,
  type Candidate,
  type CareerPath,
  type CareerSummary,
  type PosKey,
} from "@/game";
import { gameActions, type CreationDraft } from "@/lib/game-store";
import { HallOfFame } from "./tabs/HallOfFame";
import { ImportForm } from "./ImportForm";
import { Sheet } from "./Sheet";
import { Sprite } from "./Sprite";

const PATHS: [CareerPath, string, string][] = [
  ["abroad", "해외 경로", "고교 → NCAA → NBA 드래프트"],
  ["domestic", "국내 경로", "고교 → U-리그 → KBL → NBA·유로리그 도전"],
];

/** 배수가 큰 순서로 이 유형이 키워주는 능력치 */
function strengthsOf(arch: Archetype): string {
  return (Object.entries(arch.e) as [AttrKey, number][])
    .filter(([, m]) => m > 1)
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => SHORT[k])
    .join(" · ");
}

function ArchetypeSheet({ pos, index, chosen, onClose }: { pos: PosKey; index: number; chosen: boolean; onClose: () => void }) {
  const arch = ARCHETYPES[pos][index];
  return (
    <Sheet labelledBy="arch-title" onClose={onClose}>
      <span className="sheet-kicker">
        {pos} {POS[pos].name} · 플레이 유형
      </span>
      <h2 id="arch-title">{arch.name}</h2>
      <p className="sheet-desc">{arch.desc}</p>
      <p className="arch-str">
        강점 <b>{strengthsOf(arch)}</b>
      </p>
      <dl className="arch-ex">
        <div>
          <dt>KBL</dt>
          <dd>{arch.kbl.join(" · ")}</dd>
        </div>
        <div>
          <dt>NBA</dt>
          <dd>{arch.nba.join(" · ")}</dd>
        </div>
      </dl>
      <button
        type="button"
        className="sheet-go"
        onClick={() => {
          gameActions.chooseArchetype(index);
          onClose();
        }}
      >
        {chosen ? "이 유형으로 계속" : "이 유형 선택"}
      </button>
      <button type="button" className="sheet-later" onClick={onClose}>
        닫기
      </button>
    </Sheet>
  );
}

function CandidateCard({ cand, pos, index, selected }: { cand: Candidate; pos: PosKey; index: number; selected: boolean }) {
  const w = POS[pos].w;
  return (
    <button type="button" className="cand" aria-pressed={selected} onClick={() => gameActions.editDraft({ selected: index })}>
      <span className="floor">
        <span className="key" />
        <Sprite skin={cand.skin} hair={cand.hair} color="#2453A6" scale={4} label={`${cand.arch} 후보 도트 캐릭터`} />
        <span className="pick">{selected ? "선택됨" : `후보 ${index + 1}`}</span>
      </span>
      <span className="cbody">
        <span className="crow">
          <span className="arch">{cand.arch}</span>
          <span className="covr">OVR {Math.round(ovrOf(cand.attrs, pos))}</span>
        </span>
        <span className="cmeta">
          <span>키 {cand.h}cm</span>
          <span>윙스팬 {cand.h + cand.wsd}cm</span>
          <span>
            스카우트 등급 <span className="grade">{cand.grade}</span>
          </span>
        </span>
        <span className="mbars">
          {ATTR_KEYS.map((k) => (
            <span className="mb" key={k}>
              <span>
                {SHORT[k]}
                {w[k] >= 0.2 && (
                  <span className="core" aria-label="핵심">
                    ●
                  </span>
                )}
              </span>
              <span className="track">
                <span className="fill" style={{ width: `${cand.attrs[k]}%` }} />
              </span>
              <b>{cand.attrs[k]}</b>
            </span>
          ))}
        </span>
      </span>
    </button>
  );
}

export function CreateScreen({ draft, hall }: { draft: CreationDraft; hall: CareerSummary[] }) {
  const [infoIndex, setInfoIndex] = useState<number | null>(null);
  return (
    <>
      <section className="intro">
        <div>
          <div className="label">농구 커리어 시뮬레이션</div>
          <h1>
            벤치에서
            <br />
            <em>반지</em>까지
          </h1>
          <p className="lede">
            고교 벤치 멤버로 시작해 드래프트, 주전, 올스타를 거쳐 MVP와 우승 반지까지. 시즌마다 쌓이는 기록과 선택으로 나만의
            농구 인생을 완성하세요.
          </p>
        </div>
        <div className="ladder" aria-label="커리어 단계">
          <span>
            <b>고교 벤치</b>
          </span>
          <span>대학 · 드래프트</span>
          <span>로테이션 → 주전</span>
          <span>올스타 · 국가대표</span>
          <span>
            <b>MVP · 우승 반지</b>
          </span>
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
          <label className="f" htmlFor="f-nat">
            국적
            <select id="f-nat" value={draft.nat} onChange={(e) => gameActions.editDraft({ nat: e.target.value })}>
              {NATIONS.map((n) => (
                <option key={n.name} value={n.name}>
                  {n.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="field">
          <span className="label">포지션</span>
          <div className="seg" role="group" aria-label="포지션">
            {POS_KEYS.map((k) => (
              <button type="button" key={k} aria-pressed={draft.pos === k} onClick={() => gameActions.choosePosition(k)}>
                <span className="big">{k}</span>
                <span className="sm">{POS[k].name}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <span className="label">플레이 유형</span>
          <div className="archs" role="group" aria-label="플레이 유형">
            {ARCHETYPES[draft.pos].map((a, i) => (
              <div className="arch-opt" key={a.name}>
                <button type="button" className="arch-pick" aria-pressed={draft.arch === i} onClick={() => gameActions.chooseArchetype(i)}>
                  <b>{a.name}</b>
                  <span>{strengthsOf(a)}</span>
                </button>
                <button type="button" className="arch-info" aria-label={`${a.name} 설명 보기`} onClick={() => setInfoIndex(i)}>
                  설명 보기
                </button>
              </div>
            ))}
          </div>
          <p className="hint">유형에 따라 후보의 능력치 분포가 달라져요. 오버롤과 능력치 합은 같아요.</p>
        </div>

        <div className="field">
          <span className="label">커리어 경로</span>
          <div className="seg path" role="group" aria-label="커리어 경로">
            {PATHS.map(([k, title, sub]) => (
              <button type="button" key={k} aria-pressed={draft.path === k} onClick={() => gameActions.editDraft({ path: k })}>
                <span className="big">{title}</span>
                <span className="sm">{sub}</span>
              </button>
            ))}
          </div>
          <p className="hint">어느 경로든 중간에 다른 리그로 옮길 수 있어요. 경로는 고교 졸업 때 받는 제안을 바꿔요.</p>
        </div>

        <div className="field">
          <div className="flabel-row">
            <span className="label">후보 선수 · 모두 오버롤 45, 능력치 합 240, 16세 기준</span>
            <button type="button" className="btn" disabled={!draft.rerolls} onClick={gameActions.reroll}>
              후보 다시 뽑기 · {draft.rerolls}회 남음
            </button>
          </div>
          <div className="cands">
            {draft.candidates.map((c, i) => (
              <CandidateCard key={`${draft.pos}-${i}-${c.arch}-${c.h}`} cand={c} pos={draft.pos} index={i} selected={draft.selected === i} />
            ))}
          </div>
          <p className="hint">스카우트 등급은 잠재력 추정치예요. 실제 잠재력과 숨겨진 성장 특성은 뛰어봐야 알 수 있어요.</p>
        </div>

        <button type="button" className="start" onClick={gameActions.startCareer}>
          이 선수로 커리어 시작
        </button>
      </section>

      <section className="panel resume">
        <h2 className="sec">저장 코드로 이어하기</h2>
        <ImportForm placeholder="다른 기기에서 복사한 저장 코드를 붙여넣으세요" />
      </section>

      {infoIndex !== null && (
        <ArchetypeSheet
          key={`${draft.pos}-${infoIndex}`}
          pos={draft.pos}
          index={infoIndex}
          chosen={draft.arch === infoIndex}
          onClose={() => setInfoIndex(null)}
        />
      )}

      {hall.length > 0 && (
        <div className="resume">
          <HallOfFame hall={hall} />
        </div>
      )}
    </>
  );
}
