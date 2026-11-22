import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "@fontsource/black-han-sans/400.css";
import "@fontsource/ibm-plex-sans-kr/400.css";
import "@fontsource/ibm-plex-sans-kr/500.css";
import "@fontsource/ibm-plex-sans-kr/700.css";
import "@fontsource/saira-condensed/500.css";
import "@fontsource/saira-condensed/600.css";
import "@fontsource/saira-condensed/700.css";
// 자주 쓰는 한글을 굵기마다 파일 하나로 묶은 폰트(scripts/fonts.py). fontsource보다 나중에 선언해야 먼저 쓰여요.
// 묶음에 없는 드문 글자만 위 fontsource 조각으로 받아요.
import "./fonts/fonts.css";
import "./globals.css";
import { THEME_BOOT } from "@/shared/lib/theme";
import { QueryProvider } from "@/shared/query/QueryProvider";
import { SITE_DESCRIPTION, SITE_ICON, SITE_KEYWORDS, SITE_NAME, SITE_TITLE, SITE_URL } from "@/shared/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: SITE_KEYWORDS,
  icons: { icon: [{ url: SITE_ICON, sizes: "any", type: "image/svg+xml" }] },
  alternates: { canonical: "/" },
  // 미리보기 이미지는 opengraph-image.tsx가 채워요.
  openGraph: {
    type: "website",
    locale: "ko_KR",
    siteName: SITE_NAME,
    url: "/",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  twitter: { card: "summary_large_image", title: SITE_TITLE, description: SITE_DESCRIPTION },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#E7EBF0" },
    { media: "(prefers-color-scheme: dark)", color: "#0C121B" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // 브라우저 확장 프로그램이 html·body에 속성(event-clipboard-installed 등)을 붙여 하이드레이션 경고가 나요.
  // suppressHydrationWarning은 이 두 요소 자신의 속성 차이만 넘기고, 안쪽 내용은 그대로 검사해요.
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        {/* 저장된 화면 테마를 첫 화면이 그려지기 전에 적용해요. html의 data-theme 차이는 suppressHydrationWarning이 넘겨요. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body suppressHydrationWarning>
        <QueryProvider>{children}</QueryProvider>
        {/* Vercel 웹 분석: 페이지 방문 수를 세요. Vercel에 배포된 사이트에서만 데이터를 보내요. */}
        <Analytics />
        {/* Vercel Speed Insights: 실제 방문자 기기에서 잰 페이지 성능(LCP·INP·CLS 등)을 모아요. 마찬가지로 Vercel 배포에서만 보내요. */}
        {/* 추세를 보기에는 방문자의 4분의 1이면 충분해서, 수집 요청을 그만큼 줄여요. */}
        <SpeedInsights sampleRate={0.25} />
      </body>
    </html>
  );
}
