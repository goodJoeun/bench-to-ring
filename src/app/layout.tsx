import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "@fontsource/black-han-sans/400.css";
import "@fontsource/ibm-plex-sans-kr/400.css";
import "@fontsource/ibm-plex-sans-kr/500.css";
import "@fontsource/ibm-plex-sans-kr/700.css";
import "@fontsource/saira-condensed/500.css";
import "@fontsource/saira-condensed/600.css";
import "@fontsource/saira-condensed/700.css";
import "./globals.css";
import { THEME_BOOT } from "@/lib/theme";
import { SITE_DESCRIPTION, SITE_KEYWORDS, SITE_NAME, SITE_TITLE, SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: SITE_KEYWORDS,
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
      <body suppressHydrationWarning>
        {children}
        {/* 저장된 화면 테마를 하이드레이션 전에 적용해요. html의 data-theme 차이는 suppressHydrationWarning이 넘겨요. */}
        <Script id="theme-boot" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </body>
    </html>
  );
}
