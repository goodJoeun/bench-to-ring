import type { Metadata, Viewport } from "next";
import "@fontsource/black-han-sans/400.css";
import "@fontsource/ibm-plex-sans-kr/400.css";
import "@fontsource/ibm-plex-sans-kr/500.css";
import "@fontsource/ibm-plex-sans-kr/700.css";
import "@fontsource/saira-condensed/500.css";
import "@fontsource/saira-condensed/600.css";
import "@fontsource/saira-condensed/700.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "벤치에서 반지까지",
  description: "고교 벤치 멤버로 시작해 KBL과 NBA를 거쳐 MVP와 우승 반지에 도전하는 농구 커리어 게임.",
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
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
