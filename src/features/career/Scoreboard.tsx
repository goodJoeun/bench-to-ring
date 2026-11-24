import { ovr, type Career } from "@/game";
import styles from "./career.module.css";

export function Scoreboard({ career: c }: { career: Career }) {
  return (
    <section className={styles.sb} aria-label="선수 요약">
      <div className={styles.cell}>
        <span className="k">오버롤</span>
        <span className="v big">{ovr(c.p)}</span>
      </div>
      <div className={styles.cell}>
        <span className="k">나이</span>
        <span className="v">{c.age}</span>
      </div>
      <div className={styles.cell}>
        <span className="k">키</span>
        <span className="v">
          {c.p.h}
          <small>cm</small>
        </span>
      </div>
    </section>
  );
}
