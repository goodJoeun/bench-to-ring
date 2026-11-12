import { ATTRS, POS, STAR_UNLOCKS, evalOvr, isCoreAttr, money, ovr, specialtiesOf, starTier, type Career } from "@/game";
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

/**
 * 스타성: 수치와 단계, 시그니처 세리머니, 스타성이 있어야 오는 제안(예능·광고·유니폼 수익·시그니처 농구화).
 * 막대 위 눈금이 제안이 열리는 수치예요. 넘은 제안은 밝게, 아직이면 필요한 수치를 보여줘요.
 */
function Stardom({ career: c }: { career: Career }) {
  const v = Math.round(c.star);
  // NIL 후원은 미국 대학 선수만 받아서, 고교·대학 시절에만 보여요.
  const unlocks = STAR_UNLOCKS.filter((u) => u.key !== "nil" || c.stage === "hs" || c.stage === "college");
  return (
    <div className="star">
      <div className="star-head">
        <span className="label">스타성</span>
        <span className="star-tier">{starTier(c.star)}</span>
        {c.perks.celebration && (
          <span className="star-cele">
            세리머니 <b>{c.perks.celebration}</b>
          </span>
        )}
      </div>
      <div className="star-row">
        <div className="track star-track">
          <div className="fill star-fill" style={{ width: `${v}%` }} />
          {unlocks.map((u) => (
            <i key={u.key} className="star-tick" style={{ left: `${u.min}%` }} data-on={c.star >= u.min || undefined} aria-hidden="true" />
          ))}
        </div>
        <span className="v">{v}</span>
      </div>
      <ul className="star-unlocks" aria-label="스타성이 있어야 오는 제안">
        {unlocks.map((u) => {
          const on = c.star >= u.min;
          return (
            <li key={u.key} data-on={on || undefined} title={u.desc}>
              <span>{u.name}</span>
              <b>{on ? "제안 가능" : `${u.min}부터`}</b>
            </li>
          );
        })}
      </ul>
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
      <Stardom career={c} />
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
