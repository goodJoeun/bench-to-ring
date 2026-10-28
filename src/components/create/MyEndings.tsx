"use client";

import Link from "next/link";
import type { CareerSummary } from "@/game";
import { gameActions } from "@/lib/game-store";
import { nameFit } from "@/components/common/format";
import { Sprite } from "@/components/common/Sprite";
import { Panel } from "@/components/common/ui";
import { jerseyOf, lookOf } from "@/components/rankings/look";

/** 첫 화면에 보여줄 최근 은퇴 선수 수. 나머지는 랭킹 → 나의 기록에서 봐요. */
const SHOWN = 5;

/**
 * 첫 화면의 '내 은퇴 선수': 이 브라우저에서 은퇴한 선수를 최근 순으로 늘어놓고, 엔딩을 다시 열어요.
 * 엔딩이 남아 있는 선수만 보여줘요(엔딩 보관 기능 전에 은퇴했거나 오래되어 지워진 선수는 빠져요).
 */
export function MyEndings({ hall, endings }: { hall: CareerSummary[]; endings: string[] }) {
  const saved = new Set(endings);
  // 명예의 전당은 은퇴한 순서대로 쌓여서 뒤집으면 최근 순이에요.
  const list = hall.filter((s) => saved.has(s.id)).reverse();
  if (!list.length) return null;
  return (
    <Panel title="내 은퇴 선수">
      <p className="hint">은퇴한 선수의 엔딩과 커리어 회고를 다시 볼 수 있어요.</p>
      <ol className="rk-list my-end">
        {list.slice(0, SHOWN).map((s) => (
          <li key={s.id}>
            <Sprite look={lookOf(s.id, s.look)} color={jerseyOf(s.teams.at(-1))} scale={2} className="rk-mini" label={`${s.name} 캐릭터`} />
            <span className="rk-who">
              <b style={nameFit(`${s.name} #${s.num}`)}>
                {s.name} <span className="num">#{s.num}</span>
              </b>
              <span className="sub">
                {s.pos} · OVR {s.peak} · {s.legacy} · {s.retYear}년 은퇴
              </span>
            </span>
            <button type="button" className="btn rk-end" onClick={() => gameActions.openEnding(s.id)}>
              엔딩 보기
            </button>
          </li>
        ))}
      </ol>
      {list.length > SHOWN && (
        <div className="row">
          <Link className="btn" href="/rankings#mine">
            은퇴 선수 {list.length}명 모두 보기
          </Link>
        </div>
      )}
    </Panel>
  );
}
