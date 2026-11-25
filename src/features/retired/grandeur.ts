import { LEGACY_TIERS, type CareerSummary } from "@/game";

/**
 * 레거시 등급의 순위(프로 무대를 못 밟았으면 0, '프로의 꿈을 이룬 선수' 1 … '역대 최고 논쟁의 주인공' 10)마다
 * 엔딩 배경의 화려함 단계(0~7, shared/ui/sprite/courtArt.ts의 LegacyStage)예요. GOAT에 가까울수록 성대해져요.
 */
const BY_RANK = [0, 1, 1, 2, 2, 3, 4, 5, 5, 6, 7];

/** 은퇴 기록의 레거시 등급으로 엔딩 배경의 화려함 단계를 정해요. 모르는 등급 이름이면 프로 시즌이 있는지로만 가려요. */
export function legacyGrandeur(s: Pick<CareerSummary, "legacy" | "seasons">): number {
  const i = LEGACY_TIERS.findIndex((t) => t.name === s.legacy);
  const rank = i < 0 ? (s.seasons ? 1 : 0) : LEGACY_TIERS.length - i;
  return BY_RANK[rank];
}
