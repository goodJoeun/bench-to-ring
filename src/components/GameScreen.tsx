"use client";

import { useState } from "react";
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

const TABS = [
  ["season", "시즌"],
  ["record", "기록"],
  ["trophy", "트로피"],
  ["hall", "명예의 전당"],
  ["settings", "설정"],
] as const;
type TabKey = (typeof TABS)[number][0];

export function GameScreen({ career, hall }: { career: Career; hall: CareerSummary[] }) {
  const [tab, setTab] = useState<TabKey>("season");

  return (
    <main className="grid">
      <div className="col-l">
        <CourtCard career={career} />
        <Scoreboard career={career} />
        <ActionPanel career={career} onAdvance={() => setTab("season")} />
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
              onClick={() => setTab(k)}
            >
              {name}
            </button>
          ))}
        </div>
        <div className="tabc" role="tabpanel" id="tabpanel" aria-labelledby={`tab-${tab}`} key={tab}>
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
