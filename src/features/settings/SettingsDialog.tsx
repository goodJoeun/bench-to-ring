"use client";

import { useState } from "react";
import { LEAGUES, TEAMS, type LeagueKey } from "@/game";
import { Sheet } from "@/shared/ui/Sheet";
import { TeamBadge } from "@/shared/ui/badge/TeamBadge";
import { applyTextOnly, useTextOnlyChosen } from "@/shared/lib/text-only";
import { applyTheme, readTheme, type Theme } from "@/shared/lib/theme";

const THEMES: { key: Theme; name: string; sub: string }[] = [
  { key: "system", name: "시스템", sub: "기기 설정 따라" },
  { key: "light", name: "라이트", sub: "밝은 화면" },
  { key: "dark", name: "다크", sub: "어두운 화면" },
];

/** 화면 표시: 그림·이펙트를 함께 볼지, 글자만 볼지 */
const DISPLAYS: { textOnly: boolean; name: string; sub: string }[] = [
  { textOnly: false, name: "기본", sub: "그림과 이펙트 함께" },
  { textOnly: true, name: "텍스트만", sub: "게임 중 그림·이펙트 없이" },
];

/** 수준이 낮은 리그부터 */
const LEAGUE_ORDER: LeagueKey[] = ["hs", "kuniv", "kbl", "ncaa", "gleague", "euro", "nba", "juniv", "bleague", "uaap", "pba", "cubal", "cba", "nbl", "aba", "lnb", "acb", "usports", "cebl"];

interface SettingsDialogProps {
  onClose: () => void;
  /** 플레이 가이드를 열어요. */
  onGuide: () => void;
  /** 커리어 중이면 은퇴·새 커리어 같은 커리어 설정 탭을 열어요. */
  onCareerSettings?: () => void;
}

/** 상단 톱니 버튼으로 여는 설정: 화면 테마, 화면 표시(텍스트만 보기), 플레이 가이드, 리그별 구단 목록 */
export function SettingsDialog({ onClose, onGuide, onCareerSettings }: SettingsDialogProps) {
  const [theme, setTheme] = useState<Theme>(readTheme);
  const textOnly = useTextOnlyChosen();
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

      <section className="set-sec" aria-labelledby="set-display">
        <h3 id="set-display">화면 표시</h3>
        <div className="theme-seg" data-cols="2" role="group" aria-labelledby="set-display">
          {DISPLAYS.map((d) => (
            <button type="button" key={d.name} aria-pressed={textOnly === d.textOnly} onClick={() => applyTextOnly(d.textOnly)}>
              <b>{d.name}</b>
              <span>{d.sub}</span>
            </button>
          ))}
        </div>
      </section>

      <div className="set-links">
        <button type="button" className="btn" onClick={onGuide}>
          플레이 가이드
        </button>
        {onCareerSettings && (
          <button type="button" className="btn" onClick={onCareerSettings}>
            새로운 커리어 시작
          </button>
        )}
      </div>

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

      <button type="button" className="sheet-go" onClick={onClose}>
        닫기
      </button>
    </Sheet>
  );
}
