import { ovr, potentialRange, type Career } from "@/game";

export function Scoreboard({ career: c }: { career: Career }) {
  return (
    <section className="sb" aria-label="선수 요약">
      <div className="cell">
        <span className="k">오버롤</span>
        <span className="v big">{ovr(c.p)}</span>
      </div>
      <div className="cell">
        <span className="k">잠재력 추정</span>
        <span className="v">{potentialRange(c)}</span>
      </div>
      <div className="cell">
        <span className="k">나이</span>
        <span className="v">{c.age}</span>
      </div>
      <div className="cell">
        <span className="k">키</span>
        <span className="v">
          {c.p.h}
          <small>cm</small>
        </span>
      </div>
    </section>
  );
}
