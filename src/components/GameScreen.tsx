"use client";

import type { Career, CareerSummary } from "@/game";
import { ActionPanel } from "./ActionPanel";
import { AttributesPanel } from "./AttributesPanel";
import { CourtCard } from "./CourtCard";
import { Scoreboard } from "./Scoreboard";
import { HallOfFame } from "./tabs/HallOfFame";
import { RecordTab } from "./tabs/RecordTab";
import { SeasonTab } from "./tabs/SeasonTab";
import { SettingsTab } from "./tabs/SettingsTab";
import { TrophyTab } from "./tabs/TrophyTab";

/** 하단 탭 바. 설정은 상단 헤더의 톱니 버튼으로 열어요. */
const TABS = [
  ["season", "홈"],
  ["record", "기록"],
  ["trophy", "트로피"],
  ["hall", "명예의 전당"],
] as const;
export type TabKey = (typeof TABS)[number][0] | "settings";

/** 하단 탭 바 아이콘 (24x24, currentColor) */
const TAB_ICONS: Record<(typeof TABS)[number][0], React.ReactNode> = {
  season: <path d="M4 10.5 12 4l8 6.5V20h-5.5v-5.5h-5V20H4z" />,
  record: <path d="M5 20V10h3v10zm5.5 0V4h3v16zM16 20v-7h3v7z" />,
  trophy: <path d="M7 4h10v2h3v3a4 4 0 0 1-4 4h-.4A5 5 0 0 1 13 15.9V18h3v2H8v-2h3v-2.1A5 5 0 0 1 8.4 13H8a4 4 0 0 1-4-4V6h3zm0 4H6v1a2 2 0 0 0 1 1.7zm10 0v2.7A2 2 0 0 0 18 9V8z" />,
  hall: <path d="M12 3 21 8v2H3V8zM5 11h2.5v7H5zm5.75 0h2.5v7h-2.5zm5.75 0H19v7h-2.5zM3 19h18v2H3z" />,
};

interface GameScreenProps {
  career: Career;
  hall: CareerSummary[];
  tab: TabKey;
  onTab: (k: TabKey) => void;
  simulating: boolean;
}

export function GameScreen({ career, hall, tab, onTab, simulating }: GameScreenProps) {
  const pending = career.queue.length > 0;

  return (
    <main className="grid" data-tab={tab}>
      <div className="col-l">
        <CourtCard career={career} />
        <Scoreboard career={career} />
        <ActionPanel career={career} simulating={simulating} onAdvance={() => onTab("season")} />
      </div>
      <div className="col-r">
        <AttributesPanel career={career} />
        <div className="tabs" role="tablist">
          {TABS.map(([k, name]) => (
            <button
              type="button"
              key={k}
              className="tab"
              role="tab"
              id={`tab-${k}`}
              aria-selected={tab === k}
              aria-controls="tabpanel"
              onClick={() => onTab(k)}
            >
              <svg className="ti" viewBox="0 0 24 24" aria-hidden="true">
                {TAB_ICONS[k]}
              </svg>
              <span className="tl">{name}</span>
              {k === "season" && pending && (
                <span className="tdot">
                  <span className="sr-only">오프시즌 결정 남음</span>
                </span>
              )}
            </button>
          ))}
        </div>
        <div
          className="tabc"
          role="tabpanel"
          id="tabpanel"
          aria-labelledby={tab === "settings" ? "open-settings" : `tab-${tab}`}
          key={tab}
        >
          {tab === "season" && <SeasonTab career={career} />}
          {tab === "record" && <RecordTab career={career} />}
          {tab === "trophy" && <TrophyTab career={career} />}
          {tab === "hall" && <HallOfFame hall={hall} />}
          {tab === "settings" && <SettingsTab career={career} />}
        </div>
      </div>
    </main>
  );
}
