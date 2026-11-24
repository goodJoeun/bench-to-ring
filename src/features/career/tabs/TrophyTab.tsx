"use client";

import { useState } from "react";
import { AWARDS, type Career } from "@/game";
import { AwardName, Panel } from "@/shared/ui/ui";
import styles from "../career.module.css";

export function TrophyTab({ career: c }: { career: Career }) {
  const [showAll, setShowAll] = useState(false);
  const log = [...c.awardLog].reverse();
  const earned = AWARDS.filter(([k]) => (c.awards[k] ?? 0) > 0);
  const missing = AWARDS.length - earned.length;
  const shown = showAll ? AWARDS : earned;
  return (
    <>
      <Panel title="트로피 진열장">
        {shown.length > 0 ? (
          <div className={styles.trophies}>
            {shown.map(([k, name]) => {
              const n = c.awards[k] ?? 0;
              return (
                <div className={`${styles.tro} ${n ? "has" : "zero"}`} key={k}>
                  <span className="c">{n}</span>
                  <span className="label">{name}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="empty">아직 받은 트로피가 없어요. 시즌을 치르며 첫 트로피를 노려 보세요.</p>
        )}
        {missing > 0 && (
          <div className={styles.rowBtns}>
            <button type="button" className="btn" aria-expanded={showAll} onClick={() => setShowAll(!showAll)}>
              {showAll ? "받은 트로피만 보기" : `아직 못 받은 상 ${missing}개 보기`}
            </button>
          </div>
        )}
      </Panel>
      <Panel title="수상 기록">
        {log.length ? (
          <ul className={styles.loglist}>
            {log.map((l, i) => (
              <li key={`${l.y}-${l.k}-${i}`}>
                <span className={styles.y}>{l.y}</span>
                <span>
                  <AwardName name={l.n} />
                </span>
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
