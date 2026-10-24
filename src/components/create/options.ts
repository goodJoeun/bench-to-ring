import { POS, POS_KEYS, type PosKey } from "@/game";
import type { SegmentOption } from "@/components/common/ui";

/* 선수 생성 화면의 고르기 항목 */

export const POSITIONS: SegmentOption<PosKey>[] = POS_KEYS.map((k) => ({ key: k, big: k, sm: POS[k].name }));
