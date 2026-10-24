import type { Metadata } from "next";
import { RankingsScreen } from "@/components/rankings/RankingsScreen";

export const metadata: Metadata = {
  title: "랭킹 · 농구 선수 키우기",
  description: "모든 플레이어가 은퇴하며 올린 선수들의 랭킹과 역대 베스트 5, 나의 기록.",
};

export default function RankingsPage() {
  return <RankingsScreen />;
}
