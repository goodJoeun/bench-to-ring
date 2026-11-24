import { useId } from "react";
import { useTextOnly } from "@/shared/lib/text-only";
import { FLAG_ATLAS, LOGO_ATLAS, type AtlasSheet } from "./atlas.generated";
import { emblemOf, type Emblem, type EmblemKind } from "./emblem";
import { FLAGS } from "./flags.generated";
import { LOGOS } from "./logos.generated";
import styles from "./TeamBadge.module.css";

/** 모듈 클래스에 더해, 다른 화면 CSS가 자리에 맞게 꾸밀 때 쓰는 전역 이름(badge, flag)도 달아요. */
const classOf = (...names: (string | undefined)[]) => names.filter(Boolean).join(" ");

/** 리그마다 다른 엠블럼 바탕 모양 (viewBox 0 0 40 44) */
export const SHAPES: Record<EmblemKind, string> = {
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
  // B.리그: 둥근 사각
  bleague: "M10 3H30Q37 3 37 10V34Q37 41 30 41H10Q3 41 3 34V10Q3 3 10 3Z",
  // CBA: 팔각형
  cba: "M12 3H28L37 12V32L28 41H12L3 32V12Z",
  // PBA: 아래가 둥근 방패
  pba: "M4 3H36V24A16 17 0 0 1 4 24Z",
  // 호주 NBL: 오각형
  nbl: "M4 4H36V28L20 42L4 28Z",
  // 프랑스 LNB: 위가 둥근 아치
  lnb: "M4 42V19A16 16 0 0 1 36 19V42Z",
  // 스페인 ACB: 지붕이 뾰족한 집 모양
  acb: "M20 2L37 14V41H3V14Z",
  // 아드리아틱 ABA 리그: 양옆이 뾰족한 육각형
  aba: "M11 3H29L38 22L29 41H11L2 22Z",
  // 캐나다 CEBL: 아래로 좁아지는 사다리꼴
  cebl: "M3 3H37L31 41H9Z",
  // 캐나다 대학 U 스포츠: U-리그와 같은 문장
  usports: "M5 3H35L37 18C37 31 29 39 20 43C11 39 3 31 3 18Z",
  // 아시아 대학 리그: U-리그와 같은 문장
  juniv: "M5 3H35L37 18C37 31 29 39 20 43C11 39 3 31 3 18Z",
  uaap: "M5 3H35L37 18C37 31 29 39 20 43C11 39 3 31 3 18Z",
  cubal: "M5 3H35L37 18C37 31 29 39 20 43C11 39 3 31 3 18Z",
};

/** 무늬: 없음, 사선 띠, 가로 띠, 갈매기, 반쪽, 윗머리 */
export const PATTERNS: (string | null)[] = [
  null,
  "M-6 34L34-6L44 4L4 44Z",
  "M0 25H40V33H0Z",
  "M0 27L20 16L40 27V35L20 24L0 35Z",
  "M20 0H40V44H20Z",
  "M0 0H40V13H0Z",
];

/** 모노그램 글자 크기 (viewBox 단위). 글자가 많을수록 작아요. */
export function monoSize(e: Emblem): number {
  const len = [...e.mono].length;
  return e.latin ? (len <= 2 ? 17 : len === 3 ? 13 : 10.5) : len === 1 ? 19 : len === 2 ? 14 : 11;
}

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

/** 이 크기(px) 이하의 로고는 묶음 이미지에서 그려요. 더 크면 선명하게 보이도록 로고 파일을 따로 받아요. */
const ATLAS_LOGO_MAX = 24;

/** 묶음 이미지(scripts/atlas.mjs)의 한 칸을 그려요. 여러 아이콘이 CDN 요청 한 건을 함께 써요. clipId를 주면 원형으로 잘라요. */
function AtlasIcon({
  sheet,
  index,
  className,
  width,
  height,
  label,
  clipId,
}: {
  sheet: AtlasSheet;
  index: number;
  className: string;
  width: number;
  height: number;
  label?: string;
  clipId?: string;
}) {
  const { cell, step, cols } = sheet;
  const x = (index % cols) * step;
  const y = Math.floor(index / cols) * step;
  return (
    <svg
      className={className}
      viewBox={`0 0 ${cell} ${cell}`}
      width={width}
      height={height}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {clipId && (
        <defs>
          <clipPath id={clipId}>
            <circle cx={cell / 2} cy={cell / 2} r={cell / 2} />
          </clipPath>
        </defs>
      )}
      <g clipPath={clipId ? `url(#${clipId})` : undefined}>
        {/* 안쪽 svg가 이 칸 밖의 옆 칸을 잘라요. */}
        <svg width={cell} height={cell} viewBox={`${x} ${y} ${cell} ${cell}`}>
          <image href={sheet.src} width={sheet.width} height={sheet.height} />
        </svg>
      </g>
    </svg>
  );
}

/**
 * 구단·학교·국가 엠블럼. 나라(또는 'OO 대표팀')면 국기를 원형으로, public/logos/에 로고가 있으면 로고를,
 * 없으면 이름과 대표색으로 만든 엠블럼을 보여줘요. 모르는 이름이거나 '텍스트만 보기'면 아무것도 그리지 않아요.
 * 국기와 작은 로고는 묶음 이미지를 함께 써서, 아이콘이 많은 목록도 요청이 늘지 않아요.
 */
export function TeamBadge({ name, kind, color, size = 28, className, decorative = true }: TeamBadgeProps) {
  // clipPath id에 쓸 수 없는 글자를 빼요.
  const id = `badge${useId().replace(/[^A-Za-z0-9_-]/g, "")}`;
  if (useTextOnly()) return null;
  const nation = name.replace(/ 대표팀$/, "");
  if (FLAGS[nation])
    return (
      <AtlasIcon
        sheet={FLAG_ATLAS}
        index={FLAG_ATLAS.at[nation]}
        className={classOf(styles.badge, styles.flag, "badge flag", className)}
        width={size}
        height={size}
        label={decorative ? undefined : `${nation} 국기`}
        clipId={id}
      />
    );
  const logoName = LOGOS[name] ? name : nation;
  const logo = LOGOS[logoName];
  if (logo) {
    const logoClass = classOf(styles.badge, styles.logo, "badge", className);
    const logoHeight = (size * 44) / 40;
    if (size <= ATLAS_LOGO_MAX)
      return (
        <AtlasIcon
          sheet={LOGO_ATLAS}
          index={LOGO_ATLAS.at[logoName]}
          className={logoClass}
          width={size}
          height={logoHeight}
          label={decorative ? undefined : `${name} 로고`}
        />
      );
    return (
      // 크기가 정해진 작은 정적 이미지라 next/image의 최적화가 필요 없어요.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        className={logoClass}
        src={logo}
        width={size}
        height={logoHeight}
        alt={decorative ? "" : `${name} 로고`}
        aria-hidden={decorative || undefined}
        loading="lazy"
        decoding="async"
      />
    );
  }
  const e = emblemOf(name, kind, color);
  if (!e) return null;
  const shape = SHAPES[e.kind];
  const pattern = PATTERNS[e.pattern];
  const font = monoSize(e);
  return (
    <svg
      className={classOf(styles.badge, "badge", className)}
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
        className={e.latin ? `${styles.mono} ${styles.latin}` : styles.mono}
        stroke={e.edge}
        strokeWidth={0.6}
        paintOrder="stroke"
      >
        {e.mono}
      </text>
    </svg>
  );
}
