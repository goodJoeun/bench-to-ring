import { ATTRS, POS, evalOvr, isCoreAttr, money, ovr, specialtiesOf, type Career } from "@/game";
import { Radar } from "./Radar";

/**
 * 지금 가진 히든 스탯과 평가 오버롤. 히든 스탯의 조건과 종류는 일부러 보여주지 않아요(이스터에그).
 * 조건을 처음 채우면 시즌 결산 소식으로 알려주고, 그때부터 여기에 나타나요. 아직 없으면 이 칸 자체가 없어요.
 */
function Specialties({ career: c }: { career: Career }) {
  const hits = specialtiesOf(c.p.attrs);
  if (!hits.length) return null;
  const base = ovr(c.p);
  const evaluated = evalOvr(c.p);
  return (
    <div className="spec">
      <div className="spec-head">
        <span className="label">히든 스탯</span>
        {evaluated > base && (
          <span className="spec-eval">
            평가 오버롤 {base} → <b>{evaluated}</b>
          </span>
        )}
      </div>
      <div className="spec-chips">
        {hits.map((h) => (
          <span className="spec-chip" key={h.spec.key} title={h.spec.desc}>
            <b>{h.spec.name}</b> +{h.bonus}
          </span>
        ))}
      </div>
    </div>
  );
}

export function AttributesPanel({ career: c }: { career: Career }) {
  const p = c.p;
  return (
    <section className="panel attrs">
      <div className="head">
        <h2 className="sec">능력치</h2>
        <span className="label">
          {POS[p.pos].name} · {p.arch} · ● 포지션 핵심
        </span>
      </div>
      <div className="attr-body">
        <Radar attrs={p.attrs} />
        <div className="bars">
          {ATTRS.map(([k, name]) => {
            const v = Math.round(p.attrs[k]);
            const d = c.lastDelta[k] ?? 0;
            return (
              <div className="ar" key={k}>
                <span className="n">
                  {name}
                  {isCoreAttr(p.pos, k) && (
                    <span className="core" title="포지션 핵심 능력치">
                      ●
                    </span>
                  )}
                </span>
                <div className="track">
                  <div className="fill" style={{ width: `${v}%` }} />
                </div>
                <span className="v">{v}</span>
                <span className={`d ${d > 0 ? "up" : d < 0 ? "dn" : ""}`}>{d > 0 ? `+${d}` : d < 0 ? d : "–"}</span>
              </div>
            );
          })}
        </div>
      </div>
      <Specialties career={c} />
      <div className="phys">
        <span>
          키 <b>{p.h}cm</b>
        </span>
        <span>
          윙스팬 <b>{p.h + p.wsd}cm</b>
        </span>
        <span>
          특성 <b>{p.traitKnown ? p.trait : "19세에 공개"}</b>
        </span>
        <span>
          국가대표 <b>{c.nat.caps}경기</b>
        </span>
        <span className="meta-funds">
          보유 자금 <b>{money(c.earnings)}</b>
        </span>
      </div>
    </section>
  );
}
