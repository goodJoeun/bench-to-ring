import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { SITE_NAME, SITE_SUB } from "@/lib/site";

/* 카카오톡·디스코드·X 같은 곳에 링크를 붙일 때 보이는 미리보기 이미지. 빌드할 때 한 번 만들어요. */

export const alt = `${SITE_NAME} · ${SITE_SUB}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// ImageResponse는 woff2를 못 읽어서 woff를 써요. 한글과 영문이 서로 다른 파일에 나뉘어 있어요.
const fontDir = join(process.cwd(), "node_modules/@fontsource/ibm-plex-sans-kr/files");
const fonts = await Promise.all(
  ["korean-700", "latin-700", "korean-400", "latin-400"].map(async (k) => ({
    name: "Plex",
    data: await readFile(join(fontDir, `ibm-plex-sans-kr-${k}-normal.woff`)),
    weight: Number(k.split("-")[1]) as 400 | 700,
    style: "normal" as const,
  })),
);

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          gap: 64,
          padding: "0 96px",
          background: "#0C121B",
          color: "#E6EBF2",
          fontFamily: "Plex",
        }}
      >
        <svg width="240" height="240" viewBox="0 0 32 32">
          <circle cx="16" cy="16" r="14" fill="#EE6A2A" />
          <g fill="none" stroke="#4A2410" strokeWidth="1.4">
            <circle cx="16" cy="16" r="14" />
            <path d="M16 2v28M2 16h28" />
            <path d="M7 5.5c4 3 6 6.5 6 10.5s-2 7.5-6 10.5M25 5.5c-4 3-6 6.5-6 10.5s2 7.5 6 10.5" />
          </g>
        </svg>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 40, fontWeight: 700, color: "#EE6A2A" }}>{SITE_SUB}</div>
          <div style={{ fontSize: 96, fontWeight: 700, lineHeight: 1.15, marginTop: 8 }}>{SITE_NAME}</div>
          <div style={{ fontSize: 34, color: "#93A0B3", marginTop: 28, lineHeight: 1.4 }}>
            고교 벤치에서 KBL·NBA, MVP와 우승 반지까지
          </div>
          <div style={{ fontSize: 28, color: "#6B98EA", marginTop: 36 }}>www.bench2ring.com</div>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
