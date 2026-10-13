import { AWARDS, type Career } from "@/game";

export function TrophyTab({ career: c }: { career: Career }) {
  const log = [...c.awardLog].reverse();
  return (
    <>
      <section className="panel">
        <h2 className="sec">트로피 진열장</h2>
        <div className="trophies">
          {AWARDS.map(([k, name]) => {
            const n = c.awards[k] ?? 0;
            return (
              <div className={`tro ${n ? "has" : "zero"}`} key={k}>
                <span className="c">{n}</span>
                <span className="label">{name}</span>
              </div>
            );
          })}
        </div>
      </section>
      <section className="panel">
        <h2 className="sec">수상 기록</h2>
        {log.length ? (
          <ul className="loglist">
            {log.map((l, i) => (
              <li key={`${l.y}-${l.k}-${i}`}>
                <span>{l.y}</span>
                {l.n}
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty">아직 수상 기록이 없어요.</p>
        )}
      </section>
    </>
  );
}
