import {
  ATTRS,
  PAIR_FLOOR,
  PAIR_GAP,
  POS,
  SPECIALTIES,
  evalOvr,
  isCoreAttr,
  money,
  ovr,
  specialtiesOf,
  specialtyRule,
  type Career,
} from "@/game";
import { Radar } from "./Radar";

/** 지금 인정된 특화와 평가 오버롤 보너스, 그리고 특화 11가지의 조건 */
function Specialties({ career: c }: { career: Career }) {
  const hits = specialtiesOf(c.p.attrs);
  const base = ovr(c.p);
  const evaluated = evalOvr(c.p);
  const on = new Set(hits.map((h) => h.spec.key));
  return (
    <div className="spec">
      <div className="spec-head">
        <span className="label">특화</span>
        {evaluated > base && (
          <span className="spec-eval">
            평가 오버롤 {base} → <b>{evaluated}</b>
          </span>
        )}
      </div>
      {hits.length ? (
        <div className="spec-chips">
          {hits.map((h) => (
            <span className="spec-chip" key={h.spec.key} title={h.spec.desc}>
              <b>{h.spec.name}</b> +{h.bonus}
            </span>
          ))}
        </div>
      ) : (
        <p className="hint">
          아직 특화가 없어요. 두 능력치를 함께 {PAIR_FLOOR} 이상, 나머지 평균보다 {PAIR_GAP} 높게 키우면 특화가 생겨 구단 평가가
          올라가요.
        </p>
      )}
      <details className="spec-all">
        <summary>특화 {SPECIALTIES.length}가지 조건 보기</summary>
        <ul>
          {SPECIALTIES.map((s) => (
            <li key={s.key} data-on={on.has(s.key) || undefined}>
              <b>{s.name}</b>
              <span>{specialtyRule(s)}</span>
              <small>{s.desc}</small>
            </li>
          ))}
        </ul>
      </details>
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
        <span>
          보유 자금 <b>{money(c.earnings)}</b>
        </span>
      </div>
    </section>
  );
}
