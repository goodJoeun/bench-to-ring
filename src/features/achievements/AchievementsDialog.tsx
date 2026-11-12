"use client";

import { useState } from "react";
import {
  ACHIEVEMENTS,
  ACHIEVEMENT_GROUPS,
  fmtNum,
  type AchievementGroup,
} from "@/game";
import { loadAchievements, loadLifeView } from "@/game/career/storage";
import { AchievedBadge } from "@/shared/ui/badge/Medal";
import { Sheet } from "@/shared/ui/Sheet";

const GROUPS = Object.keys(ACHIEVEMENT_GROUPS) as AchievementGroup[];
/** 탭: 전체 또는 업적 분류 하나 */
type Tab = "all" | AchievementGroup;

/** 정렬 순서: 딴 업적은 딴 시각, 못 딴 업적은 맨 뒤 (못 딴 업적끼리는 원래 순서를 지켜요) */
const doneOrder = (r: { at: number } | undefined): number =>
  r?.at ?? Number.MAX_SAFE_INTEGER;

/** 딴 날: 2026.11.05 */
function dayOf(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * 상단 '업적'으로 여는 창: 이 브라우저에서 딴 업적과 아직 못 딴 업적. 따기 전에는 이름과 힌트만, 따면 조건까지 보여요.
 * 누적 기록 업적은 따기 전에도 모든 커리어를 더한 진행도를 보여줘요.
 * 위의 탭(4열 격자)으로 분류(고교·대학, 팀·우승, 스타성…)를 골라 볼 수 있어요. 분류마다 딴 업적이 먼저(먼저 딴 순서로) 와요. 탭마다 딴 수를 보여줘요. 전체 탭은 분류별로 나눠 다 보여줘요.
 */
export function AchievementsDialog({ onClose }: { onClose: () => void }) {
  const [got] = useState(loadAchievements);
  const [life] = useState(loadLifeView);
  const done = ACHIEVEMENTS.filter((a) => got[a.id]).length;
  const [tab, setTab] = useState<Tab>("all");
  const shown = tab === "all" ? GROUPS : [tab];
  const count = (g: Tab) => {
    const list =
      g === "all" ? ACHIEVEMENTS : ACHIEVEMENTS.filter((a) => a.group === g);
    return `${list.filter((a) => got[a.id]).length}/${list.length}`;
  };
  return (
    <Sheet labelledBy="achv-title" onClose={onClose}>
      <span className="sheet-kicker">업적</span>
      <h2 id="achv-title">
        {done} / {ACHIEVEMENTS.length} 달성
      </h2>
      <div
        className="achv-bar"
        role="progressbar"
        aria-label="업적 달성"
        aria-valuemin={0}
        aria-valuemax={ACHIEVEMENTS.length}
        aria-valuenow={done}
      >
        <i style={{ width: `${(done / ACHIEVEMENTS.length) * 100}%` }} />
      </div>
      <p className="hint">
        이 브라우저에서 딴 업적이에요. 새 커리어를 시작해도 남고, 한 번 딴
        업적은 다시 따지 않아요. 조건은 달성하면 공개되고, 그 전에는 힌트를
        보여줘요. 누적 기록은 누적 업적이 생긴 뒤로 이 브라우저에서 플레이한
        모든 커리어를 더해요. 역대 랭킹은 은퇴 기록이 온라인 랭킹에 올라가 받은
        순위로 따요.
      </p>
      <div className="achv-tabs" role="tablist" aria-label="업적 분류">
        {(["all", ...GROUPS] as Tab[]).map((g) => (
          <button
            type="button"
            key={g}
            role="tab"
            id={`achv-tab-${g}`}
            aria-selected={tab === g}
            aria-controls="achv-panel"
            onClick={() => setTab(g)}
          >
            {g === "all" ? "전체" : ACHIEVEMENT_GROUPS[g]}
            <span>{count(g)}</span>
          </button>
        ))}
      </div>
      <div id="achv-panel" role="tabpanel" aria-labelledby={`achv-tab-${tab}`}>
        {shown.map((g) => (
          <section key={g} className="set-sec" aria-labelledby={`achv-${g}`}>
            <h3
              id={`achv-${g}`}
              className={tab === "all" ? undefined : "sr-only"}
            >
              {ACHIEVEMENT_GROUPS[g]}
            </h3>
            <ul className="achv-list">
              {ACHIEVEMENTS.filter((a) => a.group === g)
                // 딴 업적을 먼저(먼저 딴 순서로), 못 딴 업적은 원래 순서대로
                .sort((x, y) => doneOrder(got[x.id]) - doneOrder(got[y.id]))
                .map((a) => {
                  const r = got[a.id];
                  return (
                    <li key={a.id} data-done={r ? true : undefined}>
                      {r && <AchievedBadge />}
                      <b>{a.name}</b>
                      {r ? (
                        <>
                          <span>{a.desc}</span>
                          <span className="achv-by">
                            {r.name} · {dayOf(r.at)}
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="achv-hint">{a.hint}</span>
                          {a.goal && (
                            <span className="achv-by">
                              지금 {fmtNum(Math.min(a.goal.of(life), a.goal.n))}{" "}
                              / {fmtNum(a.goal.n)}
                              {a.goal.unit}
                            </span>
                          )}
                        </>
                      )}
                    </li>
                  );
                })}
            </ul>
          </section>
        ))}
      </div>
      <button type="button" className="sheet-go" onClick={onClose}>
        닫기
      </button>
    </Sheet>
  );
}
