import { AWARDS, type Career } from "@/game";
import { Panel } from "../ui";

export function TrophyTab({ career: c }: { career: Career }) {
  const log = [...c.awardLog].reverse();
  return (
    <>
      <Panel title="트로피 진열장">
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
      </Panel>
      <Panel title="수상 기록">
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
      </Panel>
    </>
  );
}
