import type { NextConfig } from "next";
import { SITE_ICON } from "./src/shared/lib/site";

/** 1년. 주소에 내용 해시(?v=)가 붙어 있어서, 파일이 바뀌면 주소도 바뀌어요. */
const IMMUTABLE = "public, max-age=31536000, immutable";
/** 1주일. 주소가 그대로인 파일이라 바뀌면 늦어도 일주일 뒤에 새것을 받아요. */
const WEEK = "public, max-age=604800";

const cacheFor = (value: string, sources: string[]) =>
  sources.map((source) => ({ source, headers: [{ key: "Cache-Control", value }] }));

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // public/ 파일은 Vercel 기본값(max-age=0)이면 화면을 열 때마다 다시 확인 요청을 보내고, 그 304도 CDN 요청으로 세요.
  // 로고·국기와 그 묶음 이미지는 scripts/logos.mjs·flags.mjs·atlas.mjs가, 사이트 아이콘은 SITE_ICON이 주소에 내용 해시를 붙이니 브라우저가 오래 갖고 있게 해요.
  // 앱 정보(manifest)는 주소에 해시가 없어서 일주일만 갖고 있어요.
  async headers() {
    return [
      ...cacheFor(IMMUTABLE, ["/logos/:path*", "/leagues/:path*", "/flags/:path*", "/atlas/:path*", "/icons/:path*"]),
      ...cacheFor(WEEK, ["/manifest.webmanifest"]),
    ];
  },
  // 설치된 앱이나 예전 페이지가 들고 있는 옛 아이콘 주소를 새 주소로 보내요.
  async redirects() {
    return [{ source: "/icon.svg", destination: SITE_ICON, permanent: true }];
  },
};

export default nextConfig;
