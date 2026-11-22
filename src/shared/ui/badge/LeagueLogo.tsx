import { LEAGUES, type LeagueKey } from "@/game";
import { useTextOnly } from "@/shared/lib/text-only";
import { LEAGUE_LOGOS } from "./logos.generated";

/** 로고 파일이 있는 리그인지 */
export const hasLeagueLogo = (lg: LeagueKey | null | undefined): lg is LeagueKey => !!lg && !!LEAGUE_LOGOS[lg];

/** 리그 로고. 로고 파일이 없거나 '텍스트만 보기'면 아무것도 그리지 않아요. */
export function LeagueLogo({ lg, className }: { lg: LeagueKey; className?: string }) {
  const hidden = useTextOnly();
  const src = LEAGUE_LOGOS[lg];
  if (hidden || !src) return null;
  // 크기가 정해진 작은 정적 이미지라 next/image의 최적화가 필요 없어요.
  // eslint-disable-next-line @next/next/no-img-element
  return <img className={className} src={src} alt={`${LEAGUES[lg].name} 로고`} decoding="async" />;
}
