import { TIER_NAME, type AchievementTier } from "@/game";
import { useTextOnly } from "@/shared/lib/text-only";
import styles from "./Medal.module.css";

/** 메달 등급마다 바깥 테·바깥 면·안쪽 면·별 색 */
const MEDAL_COLORS: Record<Exclude<AchievementTier, "mvp">, [edge: string, face: string, inner: string, star: string]> = {
  bronze: ["#A8622E", "#E8A26B", "#CD7F42", "#FBE3CC"],
  silver: ["#8E9AAB", "#EEF2F7", "#C9D2DE", "#FFFFFF"],
  gold: ["#E2A93B", "#FFD66B", "#F5B83D", "#FFF7D6"],
};

/** 가운데가 (cx, cy)이고 바깥 꼭짓점까지 r인 별 */
function starPoints(cx: number, cy: number, r: number): string {
  return Array.from({ length: 10 }, (_, i) => {
    const d = i % 2 ? r * 0.42 : r;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    return `${(cx + d * Math.cos(a)).toFixed(2)},${(cy + d * Math.sin(a)).toFixed(2)}`;
  }).join(" ");
}

/** MVP 트로피: 별이 새겨진 금빛 우승컵과 보라 받침 */
function Trophy({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" aria-hidden="true" focusable="false" data-tier="mvp">
      <path d="M18 12H10c0 10 5 16 12 17" fill="none" stroke="#E2A93B" strokeWidth="4" strokeLinecap="round" />
      <path d="M46 12h8c0 10-5 16-12 17" fill="none" stroke="#E2A93B" strokeWidth="4" strokeLinecap="round" />
      <path d="M16 6h32v12c0 11-7 19-16 20C23 37 16 29 16 18z" fill="#FFD66B" stroke="#E2A93B" strokeWidth="3" strokeLinejoin="round" />
      <polygon points={starPoints(32, 19, 8)} fill="#FFF7D6" />
      <rect x="28" y="38" width="8" height="8" fill="#F5B83D" />
      <path d="M20 46h24l3 6H17z" fill="#8B6CFF" />
      <rect x="14" y="52" width="36" height="8" rx="2" fill="#6A4BE0" />
      <rect x="25" y="54.5" width="14" height="3" rx="1" fill="#FFD66B" />
    </svg>
  );
}

/**
 * 업적 메달: 빨강·파랑 리본에 걸린 별 메달. 등급마다 동·은·금 색이고, MVP 트로피 등급은 우승컵이에요.
 * 업적 달성 축하 팝업과 딴 업적 카드의 훈장이 같이 써요. 등급을 모르는 예전 축하는 금메달이에요. '텍스트만 보기'에서는 그리지 않아요.
 */
export function Medal({ className, tier = "gold" }: { className?: string; tier?: AchievementTier }) {
  if (useTextOnly()) return null;
  if (tier === "mvp") return <Trophy className={className} />;
  const [edge, face, inner, star] = MEDAL_COLORS[tier];
  return (
    <svg className={className} viewBox="0 0 64 64" aria-hidden="true" focusable="false" data-tier={tier}>
      <polygon points="18,2 30,2 36,24 26,28" fill="#E0503A" />
      <polygon points="34,2 46,2 38,28 28,24" fill="#3D7BFF" />
      <circle cx="32" cy="40" r="20" fill={face} stroke={edge} strokeWidth="3" />
      <circle cx="32" cy="40" r="14" fill={inner} />
      <polygon points={starPoints(32, 40, 10)} fill={star} />
    </svg>
  );
}

/** 딴 업적 카드의 오른쪽 위에 다는 훈장. 화면 낭독기에는 '금메달 달성'처럼 읽혀요. 업적 목록과 텍스트만 보기 CSS가 achv-badge 이름으로 꾸며요. */
export function AchievedBadge({ tier = "gold" }: { tier?: AchievementTier }) {
  return (
    <span className={`${styles.badge} achv-badge`} data-tier={tier}>
      <Medal className={styles.medal} tier={tier} />
      <span className="sr-only">{TIER_NAME[tier]} 달성</span>
    </span>
  );
}
