"use client";

import { useState } from "react";
import { LEAGUES, TEAMS, type LeagueKey } from "@/game";
import { Sheet } from "@/components/common/Sheet";
import { TeamBadge } from "@/components/common/TeamBadge";
import { applyTheme, readTheme, type Theme } from "@/lib/theme";

const THEMES: { key: Theme; name: string; sub: string }[] = [
  { key: "system", name: "시스템", sub: "기기 설정 따라" },
  { key: "light", name: "라이트", sub: "밝은 화면" },
  { key: "dark", name: "다크", sub: "어두운 화면" },
];

/** 수준이 낮은 리그부터 */
const LEAGUE_ORDER: LeagueKey[] = ["hs", "kuniv", "kbl", "ncaa", "gleague", "euro", "nba"];

interface SettingsDialogProps {
  onClose: () => void;
  /** 커리어 중이면 은퇴·새 커리어 같은 커리어 설정 탭을 열어요. */
  onCareerSettings?: () => void;
}

/** 상단 톱니 버튼으로 여는 설정: 화면 테마와 리그별 구단 목록 */
export function SettingsDialog({ onClose, onCareerSettings }: SettingsDialogProps) {
  const [theme, setTheme] = useState<Theme>(readTheme);
  const [league, setLeague] = useState<LeagueKey>("kbl");
  const teams = TEAMS[league];

  const pickTheme = (t: Theme) => {
    setTheme(t);
    applyTheme(t);
  };

  return (
    <Sheet labelledBy="settings-title" onClose={onClose}>
      <h2 id="settings-title">설정</h2>

      <section className="set-sec" aria-labelledby="set-theme">
        <h3 id="set-theme">화면 테마</h3>
        <div className="theme-seg" role="group" aria-labelledby="set-theme">
          {THEMES.map((t) => (
            <button type="button" key={t.key} aria-pressed={theme === t.key} onClick={() => pickTheme(t.key)}>
              <b>{t.name}</b>
              <span>{t.sub}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="set-sec" aria-labelledby="set-teams">
        <h3 id="set-teams">구단 목록</h3>
        <div className="cat-tabs" role="tablist" aria-label="리그">
          {LEAGUE_ORDER.map((k) => (
            <button
              type="button"
              key={k}
              role="tab"
              id={`lg-${k}`}
              aria-selected={league === k}
              aria-controls="team-list"
              onClick={(e) => {
                setLeague(k);
                e.currentTarget.scrollIntoView({ block: "nearest", inline: "nearest" });
              }}
            >
              {LEAGUES[k].short}
            </button>
          ))}
        </div>
        <p className="team-count">
          {LEAGUES[league].name} · {teams.length}개 {LEAGUES[league].pro ? "구단" : "학교"}
        </p>
        <ul className="team-list" id="team-list" role="tabpanel" aria-labelledby={`lg-${league}`}>
          {teams.map(([name, color]) => (
            <li key={name}>
              <TeamBadge name={name} kind={league} color={color} size={24} />
              <span>{name}</span>
            </li>
          ))}
        </ul>
      </section>

      {onCareerSettings && (
        <button type="button" className="btn set-link" onClick={onCareerSettings}>
          커리어 관리
        </button>
      )}
      <button type="button" className="sheet-go" onClick={onClose}>
        닫기
      </button>
    </Sheet>
  );
}
