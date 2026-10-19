import { POS, POS_KEYS, type CareerPath, type PosKey } from "@/game";
import type { SegmentOption } from "@/components/common/ui";

/* 선수 생성 화면의 고르기 항목 */

export const PATHS: SegmentOption<CareerPath>[] = [
  { key: "abroad", big: "해외 경로", sm: "고교 → NCAA → NBA 드래프트" },
  { key: "domestic", big: "국내 경로", sm: "고교 → U-리그 → KBL → NBA·유로리그 도전" },
];

export const POSITIONS: SegmentOption<PosKey>[] = POS_KEYS.map((k) => ({ key: k, big: k, sm: POS[k].name }));
