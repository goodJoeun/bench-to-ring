"use client";

import { ATTR_KEYS, SHORT, archetypeOf, bodyOf, isCoreAttr, ovrOf, type Candidate, type PosKey } from "@/game";
import { gameActions } from "@/lib/game-store";
import { Sprite } from "@/components/common/Sprite";
import { ArchetypeTip } from "./ArchetypeTip";

export function CandidateCard({ cand, pos, index, selected }: { cand: Candidate; pos: PosKey; index: number; selected: boolean }) {
  const arch = archetypeOf(pos, cand.arch);
  return (
    // 카드 아무 곳이나 눌러 고를 수 있어요. 키보드로는 오른쪽 위 후보 버튼을 써요.
    <div className="cand" data-selected={selected || undefined} onClick={() => gameActions.editDraft({ selected: index })}>
      <span className="floor">
        <span className="key" />
        <Sprite skin={cand.skin} hair={cand.hair} color="#2453A6" scale={4} label={`${cand.arch} 후보 도트 캐릭터`} />
        <button
          type="button"
          className="pick"
          aria-pressed={selected}
          aria-label={`후보 ${index + 1} ${cand.arch} 선택`}
        >
          {selected ? "선택됨" : `후보 ${index + 1}`}
        </button>
      </span>
      <span className="cbody">
        <span className="crow">
          <span className="arch-name">
            <span className="arch">{cand.arch}</span>
            {arch && <ArchetypeTip arch={arch} />}
          </span>
          <span className="covr">OVR {Math.round(ovrOf(cand.attrs, pos))}</span>
        </span>
        {arch && <span className="cdesc">{arch.desc}</span>}
        <span className="cmeta">
          <span>
            키 {cand.h}cm{arch && ` · 성인 예상 ${bodyOf(pos, arch).h.join("–")}cm`}
          </span>
          <span>윙스팬 {cand.h + cand.wsd}cm</span>
        </span>
        <span className="mbars">
          {ATTR_KEYS.map((k) => (
            <span className="mb" key={k}>
              <span>
                {SHORT[k]}
                {isCoreAttr(pos, k) && (
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
    </div>
  );
}
