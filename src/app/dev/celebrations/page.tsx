import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CelebrationLab } from "@/features/dev/CelebrationLab";

export const metadata: Metadata = {
  title: "세리머니 모션 확인",
  robots: { index: false, follow: false },
};

/** 시그니처 세리머니의 움직임을 하나씩 돌려 보는 개발용 화면. 개발 서버(next dev)에서만 열리고, 배포한 사이트에서는 없는 주소예요. */
export default function CelebrationLabPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <CelebrationLab />;
}
