import { LEAGUES, POS, money, stageLabel, type Career } from "@/game";
import { Sprite } from "./Sprite";

const NO_TEAM_COLOR = "#5A6577";

export function CourtCard({ career: c }: { career: Career }) {
  const p = c.p;
  const t = c.team;
  const color = t?.color ?? NO_TEAM_COLOR;
  const hp = Math.round(c.health);
  const hpClass = hp >= 65 ? "hp-good" : hp >= 40 ? "hp-mid" : "hp-low";

  return (
    <section className="court" style={{ "--team": color } as React.CSSProperties}>
      <div className="key" aria-hidden="true" />
      <Sprite skin={p.skin} hair={p.hair} color={color} label={`${p.name} 도트 캐릭터`} />
      <div className="plate">
        <div className="plate-top">
          <span className="num">#{p.num}</span>
          <span className="pos">
            {p.pos} · {POS[p.pos].name}
          </span>
        </div>
        <div className="name">{p.name}</div>
        <div className="sub">{t ? `${t.name} · ${LEAGUES[t.lg].name}` : "소속팀 없음"}</div>
        <div className="sub">
          {stageLabel(c)} · {p.nat}
          {c.contract && ` · 연봉 ${money(c.contract.salary)}, ${c.contract.years}년 남음`}
        </div>
        <div className="health">
          <span className="label">건강</span>
          <div className="track">
            <div className={`fill ${hpClass}`} style={{ width: `${hp}%` }} />
          </div>
          <span className="hv">{hp}</span>
        </div>
      </div>
    </section>
  );
}
