"use client";

import { useState } from "react";
import { REPORT_STAT_NAME, fmtNum, josa, type CommunityBoard, type ReportStat, type SeasonReport, type SiteStyle } from "@/game";

const GROUP_NAME = { nba: "NBA", kbl: "KBL", olympics: "올림픽" } as const;
const r1 = (v: number) => (Math.round(v * 10) / 10).toFixed(1);
/** 앞말 받침에 맞는 조사만 돌려줘요. 괄호 뒤에 붙일 때 써요. */
const particle = (word: string, a: string, b: string) => josa(word, a, b).slice(word.length);

/** 리포트 탭: 시즌 개인 스탯, 누적 기록으로 넘은 선수와 이정표, 개인 수상 */
export function ReportView({ report: rp }: { report: SeasonReport }) {
  const { rec } = rp;
  const high = (k: ReportStat) => rp.highs.includes(k);
  const tiles: { label: string; value: string; high?: boolean; sub?: string }[] = [
    { label: "득점", value: r1(rec.pts), high: high("pts") },
    { label: "리바운드", value: r1(rec.reb), high: high("reb") },
    { label: "어시스트", value: r1(rec.ast), high: high("ast") },
    { label: "스틸", value: r1(rec.stl), high: high("stl") },
    { label: "블록", value: r1(rec.blk), high: high("blk") },
    { label: "3점", value: r1(rec.tpm ?? 0), sub: rec.tpp ? `${Math.round(rec.tpp)}%` : undefined },
    { label: "야투", value: rec.fg ? `${r1(rec.fg)}%` : "–" },
    { label: "평점", value: r1(rec.rating) },
    { label: "오버롤", value: String(rec.ovr1), sub: rec.ovr1 !== rec.ovr0 ? `${rec.ovr1 > rec.ovr0 ? "+" : ""}${rec.ovr1 - rec.ovr0}` : undefined },
  ];
  const passedAny = rp.milestones.length + rp.passedReal.length + rp.passedHall.length > 0;

  return (
    <div className="rp">
      <section aria-labelledby="rp-stats">
        <h3 id="rp-stats">
          시즌 개인 스탯 <span>{rec.gp}경기 · 평균 {Math.round(rec.min)}분 · {rec.role}</span>
        </h3>
        <ul className="rp-tiles">
          {tiles.map((t) => (
            <li key={t.label} data-high={t.high || undefined}>
              <span className="rp-l">{t.label}</span>
              <b>{t.value}</b>
              {t.sub && <span className="rp-sub">{t.sub}</span>}
              {t.high && <span className="rp-high">커리어 하이</span>}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="rp-acc">
        <h3 id="rp-acc">누적 기록</h3>
        {rp.totals ? (
          <p className="rp-total">
            프로 통산 {fmtNum(rp.totals.pts)}점 · {fmtNum(rp.totals.reb)}리바운드 · {fmtNum(rp.totals.ast)}어시스트
            <span>이번 시즌 +{fmtNum(rp.added.pts)}점</span>
          </p>
        ) : (
          <p className="rp-total">프로 통산 기록은 프로 무대에 오르면 쌓여요.</p>
        )}
        <ul className="rp-list">
          {rp.milestones.map((m) => (
            <li key={`m-${m.stat}-${m.at}`} data-kind="milestone">
              프로 통산 <b>{fmtNum(m.at)}{REPORT_STAT_NAME[m.stat].name}</b> 돌파
            </li>
          ))}
          {rp.passedReal.map((p) => (
            <li key={`r-${p.stat}-${p.name}`} data-kind="real">
              {GROUP_NAME[p.group]} 통산 {REPORT_STAT_NAME[p.stat].name}: <b>{p.name}</b>({fmtNum(p.v)}
              {REPORT_STAT_NAME[p.stat].unit}){particle(REPORT_STAT_NAME[p.stat].unit, "을", "를")} 넘어 역대 <b>{p.rank}위</b>
            </li>
          ))}
          {rp.passedHall.map((p) => (
            <li key={`h-${p.stat}-${p.name}-${p.retYear}`} data-kind="hall">
              명예의 전당 <b>{p.name}</b>({p.retYear}년 은퇴)의 통산 {REPORT_STAT_NAME[p.stat].name} {fmtNum(p.v)}
              {josa(REPORT_STAT_NAME[p.stat].unit, "을", "를")} 넘었어요
            </li>
          ))}
          {!passedAny && <li className="rp-none">이번 시즌에 넘은 기록은 없어요.</li>}
          {rp.next && (
            <li data-kind="next">
              다음 목표: {GROUP_NAME[rp.next.group]} 통산 {REPORT_STAT_NAME[rp.next.stat].name} {rp.next.rank}위 <b>{rp.next.name}</b>까지{" "}
              {fmtNum(rp.next.gap)}
              {REPORT_STAT_NAME[rp.next.stat].unit}
            </li>
          )}
        </ul>
      </section>

      <section aria-labelledby="rp-awards">
        <h3 id="rp-awards">
          개인 수상 <span>팀 성적 · {rec.result}</span>
        </h3>
        {rp.awards.length ? (
          <ul className="rp-awards">
            {rp.awards.map((a, i) => (
              <li key={`${a.k}-${i}`}>{a.n}</li>
            ))}
          </ul>
        ) : (
          <p className="rp-total">이번 시즌 개인 수상은 없어요.</p>
        )}
      </section>
    </div>
  );
}

const compact = (v: number) => (v >= 10000 ? `${(Math.round(v / 1000) / 10).toFixed(1)}만` : fmtNum(v));

/** 추천을 많이 받은 댓글 표시: 레딧은 TOP, 나머지는 BEST */
const BEST_LABEL: Record<SiteStyle, string> = { dc: "BEST", fm: "BEST", mlbpark: "BEST", reddit: "TOP", realgm: "BEST" };
/** 레딧 업보트는 1.2k처럼 줄여 써요. */
const upCount = (style: SiteStyle, v: number) => (style === "reddit" && v >= 1000 ? `${(v / 1000).toFixed(1)}k` : fmtNum(v));

function Board({ b }: { b: CommunityBoard }) {
  return (
    <article className="cm-post" data-style={b.style} lang={b.kind === "overseas" ? "en" : undefined}>
      <span className="cm-site">{b.site}</span>
      <h3>{b.title}</h3>
      <p className="cm-meta">
        조회 {compact(b.views)} · 댓글 {fmtNum(b.total)}
      </p>
      <ul className="cm-list">
        {b.comments.map((cm, i) => (
          <li key={i} data-mood={cm.mood}>
            <span className="cm-nick">
              {cm.best && <em>{BEST_LABEL[b.style]}</em>}
              {cm.nick}
            </span>
            <p>{cm.text}</p>
            <span className="cm-like" aria-label={`추천 ${cm.likes}`}>
              {b.upLabel} {upCount(b.style, cm.likes)}
            </span>
          </li>
        ))}
      </ul>
    </article>
  );
}

/** 커뮤니티 탭: 국내 커뮤니티와 해외 포럼(영어 원문). 해외 반응이 없으면 안내만 보여줘요. */
export function CommunityView({ domestic, overseas, name }: { domestic: CommunityBoard; overseas: CommunityBoard | null; name: string }) {
  const [tab, setTab] = useState<"domestic" | "overseas">("domestic");
  return (
    <div className="cm">
      <div className="st-tabs cm-tabs" role="group" aria-label="커뮤니티">
        <button type="button" aria-pressed={tab === "domestic"} onClick={() => setTab("domestic")}>
          국내 반응
        </button>
        <button type="button" aria-pressed={tab === "overseas"} onClick={() => setTab("overseas")}>
          해외 반응
        </button>
      </div>
      {tab === "domestic" ? (
        <Board b={domestic} />
      ) : overseas ? (
        <Board b={overseas} />
      ) : (
        <p className="cm-empty">아직 레딧이나 해외 포럼에서는 {josa(name, "을", "를")} 이야기하는 사람이 거의 없어요. 더 큰 무대에 서거나 훌륭한 시즌을 보내면 반응이 생겨요.</p>
      )}
      <p className="cm-note">커뮤니티 이름은 재미로 빌려 썼고, 닉네임과 댓글은 모두 게임 속 가상의 반응이에요.</p>
    </div>
  );
}
