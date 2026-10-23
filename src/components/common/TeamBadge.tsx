import { useId } from "react";
import { emblemOf, type EmblemKind } from "./emblem";
import { LOGOS } from "./logos.generated";

/** 리그마다 다른 엠블럼 바탕 모양 (viewBox 0 0 40 44) */
const SHAPES: Record<EmblemKind, string> = {
  // NBA·국가대표: 원형 배지
  nba: "M20 3a19 19 0 1 1 0 38a19 19 0 1 1 0-38Z",
  nat: "M20 3a19 19 0 1 1 0 38a19 19 0 1 1 0-38Z",
  // KBL·군 부대: 방패
  kbl: "M20 2L37 8V22C37 33 29 40 20 43C11 40 3 33 3 22V8Z",
  mil: "M20 2L37 8V22C37 33 29 40 20 43C11 40 3 33 3 22V8Z",
  // G리그: 육각형
  gleague: "M20 2L37 12V32L20 42L3 32V12Z",
  // 유로리그·U-리그: 윗변이 평평한 문장
  euro: "M5 3H35L37 18C37 31 29 39 20 43C11 39 3 31 3 18Z",
  kuniv: "M5 3H35L37 18C37 31 29 39 20 43C11 39 3 31 3 18Z",
  // NCAA: 뾰족한 방패
  ncaa: "M4 4H36V20C36 32 28 39 20 43C12 39 4 32 4 20Z",
  // 고교: 둥근 깃발
  hs: "M7 3H33Q37 3 37 7V29Q37 35 20 42Q3 35 3 29V7Q3 3 7 3Z",
};

/** 무늬: 없음, 사선 띠, 가로 띠, 갈매기, 반쪽, 윗머리 */
const PATTERNS: (string | null)[] = [
  null,
  "M-6 34L34-6L44 4L4 44Z",
  "M0 25H40V33H0Z",
  "M0 27L20 16L40 27V35L20 24L0 35Z",
  "M20 0H40V44H20Z",
  "M0 0H40V13H0Z",
];

interface TeamBadgeProps {
  /** 팀·학교·부대·국가 이름 */
  name: string;
  /** 모르면 이름으로 찾아요. */
  kind?: EmblemKind;
  color?: string;
  /** 너비(px). 높이는 조금 더 커요. */
  size?: number;
  className?: string;
  /** 옆에 이름이 같이 보이면 화면 읽기 프로그램에서는 건너뛰어요. */
  decorative?: boolean;
}

/**
 * 구단·학교 엠블럼. public/logos/에 그 팀 로고 파일이 있으면 로고를, 없으면 이름과 대표색으로 만든 엠블럼을 보여줘요.
 * 모르는 이름이면 아무것도 그리지 않아요.
 */
export function TeamBadge({ name, kind, color, size = 28, className, decorative = true }: TeamBadgeProps) {
  // clipPath id에 쓸 수 없는 글자를 빼요.
  const id = `badge${useId().replace(/[^A-Za-z0-9_-]/g, "")}`;
  const logo = LOGOS[name] ?? LOGOS[name.replace(/ 대표팀$/, "")];
  if (logo)
    return (
      // 크기가 정해진 작은 정적 이미지라 next/image의 최적화가 필요 없어요.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        className={className ? `badge logo ${className}` : "badge logo"}
        src={logo}
        width={size}
        height={(size * 44) / 40}
        alt={decorative ? "" : `${name} 로고`}
        aria-hidden={decorative || undefined}
        decoding="async"
      />
    );
  const e = emblemOf(name, kind, color);
  if (!e) return null;
  const shape = SHAPES[e.kind];
  const pattern = PATTERNS[e.pattern];
  const len = [...e.mono].length;
  const font = e.latin ? (len <= 2 ? 17 : len === 3 ? 13 : 10.5) : len === 1 ? 19 : len === 2 ? 14 : 11;
  return (
    <svg
      className={className ? `badge ${className}` : "badge"}
      viewBox="0 0 40 44"
      width={size}
      height={(size * 44) / 40}
      role={decorative ? undefined : "img"}
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : `${name} 엠블럼`}
    >
      <defs>
        <clipPath id={id}>
          <path d={shape} />
        </clipPath>
      </defs>
      <path d={shape} fill={e.fill} />
      {pattern && <path d={pattern} fill={e.accent} clipPath={`url(#${id})`} />}
      {/* 안쪽 테두리로 엠블럼다운 느낌을 내요. */}
      <path d={shape} fill="none" stroke={e.ink} strokeOpacity={0.35} strokeWidth={1.2} transform="translate(20 22) scale(0.86) translate(-20 -22)" />
      <path d={shape} fill="none" stroke={e.edge} strokeWidth={1.6} />
      <text
        x="20"
        y="23"
        textAnchor="middle"
        dominantBaseline="central"
        fill={e.ink}
        fontSize={font}
        className={e.latin ? "badge-mono latin" : "badge-mono"}
        stroke={e.edge}
        strokeWidth={0.6}
        paintOrder="stroke"
      >
        {e.mono}
      </text>
    </svg>
  );
}
