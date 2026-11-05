"use client";

import { useState } from "react";
import { ACHIEVEMENTS, ACHIEVEMENT_GROUPS, type AchievementGroup } from "@/game";
import { loadAchievements } from "@/game/career/storage";
import { Sheet } from "@/shared/ui/Sheet";

const GROUPS = Object.keys(ACHIEVEMENT_GROUPS) as AchievementGroup[];

/** 딴 날: 2026.11.05 */
function dayOf(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

/** 상단 '업적'으로 여는 창: 이 브라우저에서 딴 업적과 아직 못 딴 업적. 따기 전에는 이름과 힌트만, 따면 조건까지 보여요. */
export function AchievementsDialog({ onClose }: { onClose: () => void }) {
  const [got] = useState(loadAchievements);
  const done = ACHIEVEMENTS.filter((a) => got[a.id]).length;
  return (
    <Sheet labelledBy="achv-title" onClose={onClose}>
      <span className="sheet-kicker">업적</span>
      <h2 id="achv-title">
        {done} / {ACHIEVEMENTS.length} 달성
      </h2>
      <div className="achv-bar" role="progressbar" aria-label="업적 달성" aria-valuemin={0} aria-valuemax={ACHIEVEMENTS.length} aria-valuenow={done}>
        <i style={{ width: `${(done / ACHIEVEMENTS.length) * 100}%` }} />
      </div>
      <p className="hint">이 브라우저에서 딴 업적이에요. 새 커리어를 시작해도 남아요. 조건은 달성하면 공개되고, 그 전에는 힌트를 보여줘요.</p>
      {GROUPS.map((g) => (
        <section key={g} className="set-sec" aria-labelledby={`achv-${g}`}>
          <h3 id={`achv-${g}`}>{ACHIEVEMENT_GROUPS[g]}</h3>
          <ul className="achv-list">
            {ACHIEVEMENTS.filter((a) => a.group === g).map((a) => {
              const r = got[a.id];
              return (
                <li key={a.id} data-done={r ? true : undefined}>
                  <b>{a.name}</b>
                  {r ? (
                    <>
                      <span>{a.desc}</span>
                      <span className="achv-by">
                        {r.name} · {dayOf(r.at)}
                      </span>
                    </>
                  ) : (
                    <span className="achv-hint">{a.hint}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      <button type="button" className="sheet-go" onClick={onClose}>
        닫기
      </button>
    </Sheet>
  );
}
