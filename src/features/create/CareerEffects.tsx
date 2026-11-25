import styles from "./careerEffects.module.css";

const effects = {
  bench: (
    <g className={styles.sigh} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M69 44q8 1 9 6t8 6" />
      <path d="M68 49q4 1 5 5" />
    </g>
  ),
  debut: (
    <g className={styles.whistle} fill="currentColor">
      <path d="M71 23l14-14 3 4zM74 28l18-6 1 4zM67 19l5-13 3 1z" />
    </g>
  ),
  champ: (
    <>
      <g className={styles.confetti}>
        <path fill="#eead37" d="m12 10 6 2-2 7-5-3zM86 25l5-4 4 4-6 4z" />
        <path fill="#448e85" d="m21 40 5-3 3 4-5 4z" />
        <path fill="#dc7255" d="m66 0 4 2-3 7-3-3z" />
      </g>
      <g className={styles.confetti} style={{ animationDelay: "1.6s" }}>
        <path fill="#dc7255" d="m5 34 6 1-2 4-5-1zM79 4l6-3 2 5-5 2z" />
        <path fill="#eead37" d="m28 3 3-3 5 4-3 3z" />
        <path fill="#448e85" d="m92 43 2-6 4 2-3 5z" />
      </g>
    </>
  ),
  mvp: (
    <g className={styles.gold}>
      <path d="M68 3q1 9 9 10-8 1-9 10-1-9-9-10 8-1 9-10z" />
      <path className={styles.smallGlint} d="M78 15q1 5 5 6-4 1-5 6-1-5-5-6 4-1 5-6z" />
    </g>
  ),
};

export type CoverStage = keyof typeof effects | "nba";

export function CareerEffects({ stage }: { stage: CoverStage }) {
  if (stage === "nba") {
    return <span className={`${styles.effects} ${styles.pressFlash}`} aria-hidden="true" />;
  }
  return (
    <>
      {stage === "mvp" && <span className={`${styles.effects} ${styles.halo}`} aria-hidden="true" />}
      <svg className={styles.effects} viewBox="0 0 100 150" aria-hidden="true" focusable="false">
        {effects[stage]}
      </svg>
    </>
  );
}
