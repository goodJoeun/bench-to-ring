import type { Metadata } from "next";
import { RankingsScreen } from "@/features/rankings/RankingsScreen";
import { OG_IMAGE, SITE_NAME } from "@/shared/lib/site";

const title = `랭킹 · ${SITE_NAME}`;
const description = "모든 플레이어가 은퇴하며 올린 선수들의 랭킹과 역대 베스트 5, 나의 기록.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/rankings" },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    siteName: SITE_NAME,
    url: "/rankings",
    title,
    description,
    images: OG_IMAGE,
  },
  twitter: { card: "summary_large_image", title, description, images: OG_IMAGE },
};

export default function RankingsPage() {
  return <RankingsScreen />;
}
