import { ATTRS, POS, money, type Career } from "@/game";
import { Radar } from "./Radar";

export function AttributesPanel({ career: c }: { career: Career }) {
  const p = c.p;
  const w = POS[p.pos].w;
  return (
    <section className="panel">
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
                  {w[k] >= 0.2 && (
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
          누적 수입 <b>{money(c.earnings)}</b>
        </span>
      </div>
    </section>
  );
}
