import { useId } from "react";
import styles from "./progress.module.css";

/** 반지 머리 둘레에 박힌 다이아몬드 자리 */
const DIAMONDS = Array.from({ length: 16 }, (_, i) => {
  const a = (i / 16) * Math.PI * 2;
  return [Math.round((60 + 28 * Math.cos(a)) * 100) / 100, Math.round((42 + 28 * Math.sin(a)) * 100) / 100];
});

/** 네 갈래 반짝임: 가운데 x, y와 크기 */
const SPARKS: [number, number, number][] = [
  [16, 16, 7],
  [108, 30, 5],
  [104, 100, 6],
];

/** 우승 반지: 금반지에 다이아몬드를 두르고, 가운데 보석은 팀 색이에요. 아래쪽 띠에 우승한 시즌을 새겨요. */
export function ChampionRing({ color, year }: { color: string; year: number }) {
  const id = useId().replace(/[^A-Za-z0-9_-]/g, "");
  const gold = `ring-gold-${id}`;
  return (
    <svg className={styles.cheerRing} viewBox="0 0 120 136" role="img" aria-label={`${year} 시즌 우승 반지`}>
      <defs>
        <linearGradient id={gold} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFF3B8" />
          <stop offset="0.4" stopColor="#FFD66B" />
          <stop offset="0.72" stopColor="#C98A16" />
          <stop offset="1" stopColor="#FFE89A" />
        </linearGradient>
      </defs>
      <path
        d="M16 88a44 44 0 1 0 88 0a44 44 0 1 0-88 0ZM29 88a31 31 0 1 1 62 0a31 31 0 1 1-62 0Z"
        fill={`url(#${gold})`}
        fillRule="evenodd"
        stroke="#8A5B0A"
        strokeWidth="1.2"
      />
      <text x="60" y="129.5" textAnchor="middle" fontSize="10" fontWeight="700" fill="#5C3F00" className={styles.cheerRingYear}>
        {year}
      </text>
      <path d="M38 3H82L99 20V64L82 81H38L21 64V20Z" fill={`url(#${gold})`} stroke="#8A5B0A" strokeWidth="1.4" />
      <circle cx="60" cy="42" r="34" fill="#1B2238" />
      {DIAMONDS.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="3.2" fill="#FFFFFF" stroke="#B9D6FF" strokeWidth="0.8" />
      ))}
      <circle cx="60" cy="42" r="21" fill={color} stroke="#FFD66B" strokeWidth="2" />
      <path d="M60 22V62M40 42H80M46 28C52 36 52 48 46 56M74 28C68 36 68 48 74 56" fill="none" stroke="#FFFFFF" strokeOpacity="0.9" strokeWidth="1.7" strokeLinecap="round" />
      <ellipse cx="52" cy="32" rx="9" ry="5" fill="#FFFFFF" opacity="0.28" transform="rotate(-28 52 32)" />
      {SPARKS.map(([x, y, s], i) => (
        <path
          key={i}
          className={styles.cheerRingSpark}
          style={{ animationDelay: `${i * 0.45}s` }}
          d={`M${x} ${y - s}Q${x} ${y} ${x + s} ${y}Q${x} ${y} ${x} ${y + s}Q${x} ${y} ${x - s} ${y}Q${x} ${y} ${x} ${y - s}Z`}
          fill="#FFFFFF"
        />
      ))}
    </svg>
  );
}
