import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL, changeFrequency: "weekly", priority: 1 },
    // 랭킹은 플레이어가 은퇴할 때마다 바뀌어요.
    { url: `${SITE_URL}/rankings`, changeFrequency: "daily", priority: 0.8 },
  ];
}
