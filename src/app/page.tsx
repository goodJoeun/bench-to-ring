import { Game } from "@/components/Game";
import { SITE_DESCRIPTION, SITE_NAME, SITE_SUB, SITE_URL } from "@/lib/site";

/** 검색 엔진이 게임을 이해하도록 붙이는 구조화 데이터(schema.org) */
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "VideoGame",
  name: SITE_NAME,
  alternateName: SITE_SUB,
  description: SITE_DESCRIPTION,
  url: SITE_URL,
  image: `${SITE_URL}/opengraph-image`,
  inLanguage: "ko",
  genre: ["스포츠", "시뮬레이션", "육성"],
  gamePlatform: "Web browser",
  applicationCategory: "GameApplication",
  operatingSystem: "Any",
  isAccessibleForFree: true,
  offers: { "@type": "Offer", price: 0, priceCurrency: "KRW" },
};

export default function Home() {
  return (
    <>
      <Game />
      {/* 게임 화면은 브라우저에서 그려져요. 이 소개 글은 서버가 HTML에 바로 담아 검색 엔진도 읽을 수 있어요. */}
      <section className="about" aria-labelledby="about-title">
        <h1 id="about-title">
          {SITE_NAME} <span>{SITE_SUB}</span>
        </h1>
        <p>
          고교 농구부 벤치 멤버로 시작해 대학 농구, KBL, G리그, 유로리그를 거쳐 NBA 무대에서 MVP와 우승 반지에
          도전하는 무료 웹 농구 커리어 게임이에요. 설치나 가입 없이 브라우저에서 바로 플레이하고, 진행은 자동 저장돼요.
        </p>
        <ul>
          <li>시즌마다 훈련 초점과 투자를 정하고, 출전 시간을 따내며 능력치를 키워요.</li>
          <li>드래프트와 이적 제안, 국가대표 대회, 병역까지 실제 선수처럼 진로를 골라요.</li>
          <li>은퇴하면 명예의 전당에 올라 다른 플레이어의 선수들과 랭킹을 겨뤄요.</li>
        </ul>
      </section>
      <p className="foot">비공식 팬 게임이에요. 리그·구단·대회 명칭과 로고의 권리는 각 권리자에게 있어요.</p>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
    </>
  );
}
