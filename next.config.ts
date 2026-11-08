import type { NextConfig } from "next";

/** 1년. 주소에 내용 해시(?v=)가 붙어 있어서, 파일이 바뀌면 주소도 바뀌어요. */
const IMMUTABLE = "public, max-age=31536000, immutable";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // public/ 파일은 Vercel 기본값(max-age=0)이면 화면을 열 때마다 다시 확인 요청을 보내고, 그 304도 CDN 요청으로 세요.
  // 로고·국기는 scripts/logos.mjs·flags.mjs가 주소에 내용 해시를 붙이니 브라우저가 오래 갖고 있게 해요.
  async headers() {
    return ["/logos/:path*", "/flags/:path*"].map((source) => ({
      source,
      headers: [{ key: "Cache-Control", value: IMMUTABLE }],
    }));
  },
};

export default nextConfig;
