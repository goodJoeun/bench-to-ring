"use client";

import { useState } from "react";
import {
  DONATIONS,
  boughtThisSeason,
  canBuy,
  canDonate,
  money,
  ownedItems,
  owns,
  shopItem,
  shopLineup,
  type Career,
  type ShopCategory,
  type ShopItem,
  type ShopKey,
} from "@/game";
import { gameActions } from "@/lib/game-store";
import { Sheet } from "@/components/common/Sheet";
import { Choice, Funds, Panel } from "@/components/common/ui";

type Pending = { k: "buy"; key: ShopKey } | { k: "donate"; amount: number };

/** 보유 아이템 탭 순서. 일회성 상품은 보유 목록에 남지 않아 탭이 없어요. */
const OWNED_TABS: ReadonlyArray<"전체" | ShopCategory> = ["전체", "장비", "회복·생활", "사치품", "유산"];

/** 보유 중인 아이템을 유형별 탭으로 나눠 보여줘요. 아이템이 없는 유형의 탭은 숨겨요. */
function OwnedItems({ owned }: { owned: ShopItem[] }) {
  const [tab, setTab] = useState<(typeof OWNED_TABS)[number]>("전체");
  const count = (t: (typeof OWNED_TABS)[number]) => (t === "전체" ? owned.length : owned.filter((i) => i.cat === t).length);
  const tabs = OWNED_TABS.filter((t) => t === "전체" || count(t) > 0);
  // 고른 유형의 아이템을 모두 팔 일은 없지만, 다른 커리어로 바뀌어 비면 전체로 돌아가요.
  const current = tabs.includes(tab) ? tab : "전체";
  const shown = current === "전체" ? owned : owned.filter((i) => i.cat === current);
  return (
    <div className="owned">
      <h3>보유 중인 아이템 {owned.length}개</h3>
      {owned.length ? (
        <>
          <div className="cat-tabs" role="tablist" aria-label="아이템 유형">
            {tabs.map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                id={`owned-tab-${t}`}
                aria-selected={current === t}
                aria-controls="owned-panel"
                onClick={() => setTab(t)}
              >
                {t} <span>{count(t)}</span>
              </button>
            ))}
          </div>
          <ul className="owned-list" role="tabpanel" id="owned-panel" aria-labelledby={`owned-tab-${current}`}>
            {shown.map((i) => (
              <li key={i.key}>
                <b>{i.name}</b>
                <span className="owned-cat">{i.cat}</span>
                <span className="owned-fx">{i.effect}</span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="hint">아직 산 아이템이 없어요. 일회성 상품은 쓰고 나면 남지 않아요.</p>
      )}
    </div>
  );
}

/**
 * 홈 탭의 자금 쓰기. 시즌 사이에는 이번 시즌 상점(시즌마다 진열이 바뀌어요)과 기부를,
 * 언제든 보유 중인 아이템과 그 효과를 보여줘요. 사거나 기부하기 전에 확인 시트를 한 번 거쳐요.
 */
export function ShopPanel({ career: c }: { career: Career }) {
  const [pending, setPending] = useState<Pending | null>(null);
  if (c.stage === "retired") return null;
  const lineup = shopLineup(c);
  const owned = ownedItems(c);
  const item = pending?.k === "buy" ? shopItem(pending.key) : null;
  const price = item ? item.price : pending?.k === "donate" ? pending.amount : 0;

  return (
    <Panel title="자금 쓰기">
      <Funds amount={c.earnings} note={c.donated ? `누적 기부 ${money(c.donated)}` : undefined} />
      {c.run ? (
        <p className="hint">상점은 시즌이 끝나면 새 상품으로 다시 열려요.</p>
      ) : (
        <>
          <div className="shop-head">
            <h3>{c.year} 시즌 상점</h3>
            <span className="hint">시즌마다 진열 상품이 바뀌어요</span>
          </div>
          <div className="choices invest-grid">
            {lineup.map((i) => {
              const done = boughtThisSeason(c, i.key) || (!i.repeat && owns(c, i.key));
              return (
                <Choice
                  key={i.key}
                  label={i.name}
                  tag={done ? "구입 완료" : money(i.price)}
                  sub={`${i.cat} · ${i.effect}`}
                  aria-pressed={done}
                  disabled={!done && !canBuy(c, i.key)}
                  onClick={() => !done && setPending({ k: "buy", key: i.key })}
                />
              );
            })}
          </div>
          <div className="donate">
            <span className="label">유소년 농구 기부</span>
            <div className="row-btns">
              {DONATIONS.map((d) => (
                <button key={d} type="button" className="btn" disabled={!canDonate(c, d)} onClick={() => setPending({ k: "donate", amount: d })}>
                  {money(d)}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      <OwnedItems owned={owned} />

      {pending && (
        <Sheet labelledBy="shop-title" onClose={() => setPending(null)}>
          <span className="sheet-kicker">
            보유 자금 {money(c.earnings)} → {money(c.earnings - price)}
          </span>
          <h2 id="shop-title">{item ? `${item.name}, ${money(price)}에 살까요?` : `${money(price)}을 기부할까요?`}</h2>
          <p className="sheet-desc">{item ? `${item.cat} · ${item.effect}` : "기부한 돈은 은퇴 기록에 남아요."}</p>
          <button
            type="button"
            className="sheet-go"
            onClick={() => {
              if (pending.k === "buy") gameActions.buy(pending.key);
              else gameActions.donate(pending.amount);
              setPending(null);
            }}
          >
            {item ? "구입하기" : "기부하기"}
          </button>
          <button type="button" className="sheet-later" onClick={() => setPending(null)}>
            그만둘게요
          </button>
        </Sheet>
      )}
    </Panel>
  );
}
