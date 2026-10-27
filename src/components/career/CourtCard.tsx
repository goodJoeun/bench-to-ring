import { LEAGUES, POS, militaryUnit, money, stageLabel, type Career } from "@/game";
import { NO_TEAM_COLOR, nameFit } from "@/components/common/format";
import { TeamBadge } from "@/components/common/TeamBadge";
import { CourtStage } from "@/components/common/ui";

export function CourtCard({ career: c }: { career: Career }) {
  const p = c.p;
  const t = c.team;
  const unit = c.stage === "military" ? militaryUnit(c.mil.kind) : null;
  const color = unit?.color ?? t?.color ?? NO_TEAM_COLOR;
  const hp = Math.round(c.health);
  const hpClass = hp >= 65 ? "hp-good" : hp >= 40 ? "hp-mid" : "hp-low";

  return (
    <CourtStage player={p} color={color}>
      {unit ? (
        <TeamBadge className="plate-badge" name={unit.name} kind="mil" color={unit.color} size={46} />
      ) : (
        t && <TeamBadge className="plate-badge" name={t.name} kind={t.lg} color={t.color} size={46} />
      )}
      <div className="plate-top">
        <span className="num">#{p.num}</span>
        <span className="pos">
          {p.pos} · {POS[p.pos].name}
        </span>
      </div>
      <div className="name" style={nameFit(p.name)}>
        {p.name}
      </div>
      <div className="sub">{unit ? unit.name : t ? `${t.name} · ${LEAGUES[t.lg].name}` : "소속팀 없음"}</div>
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
    </CourtStage>
  );
}
