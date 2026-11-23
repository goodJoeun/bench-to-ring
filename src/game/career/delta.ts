import { ATTRS, SHORT } from "../core/data";
import type { Career } from "../core/types";
import { money } from "../core/util";

const signed = (v: number) => `${v > 0 ? "+" : ""}${v}`;

/**
 * 결정 하나로 실제 바뀐 값을 한 줄로 알려줘요. 예: "건강 -3 · 코치 신뢰 상승".
 * 소식 문장(msg)에 이미 능력치 수치가 있으면 능력치는 다시 적지 않아요.
 */
export function decisionDelta(before: Career, after: Career, msg = ""): string {
  const parts: string[] = [];
  if (!/[+-]\d/.test(msg))
    for (const [k] of ATTRS) {
      const d = Math.round(after.p.attrs[k]) - Math.round(before.p.attrs[k]);
      if (d) parts.push(`${SHORT[k]} ${signed(d)}`);
    }
  const health = Math.round(after.health) - Math.round(before.health);
  if (health) parts.push(`건강 ${signed(health)}`);
  const earned = after.earnings - before.earnings;
  if (Math.abs(earned) >= 0.01) parts.push(earned > 0 ? `수입 +${money(earned)}` : `비용 ${money(-earned)}`);
  if (after.trust !== before.trust) parts.push(after.trust > before.trust ? "코치 신뢰 상승" : "코치 신뢰 하락");
  const star = Math.round(after.star) - Math.round(before.star);
  if (star) parts.push(`스타성 ${signed(star)}`);
  const form = (after.run?.form ?? 0) - (before.run?.form ?? 0);
  if (before.run && after.run && form) parts.push(form > 0 ? "경기력 상승" : "경기력 하락");
  return parts.join(" · ");
}
