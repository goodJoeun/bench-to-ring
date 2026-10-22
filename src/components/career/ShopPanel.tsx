"use client";

import { useState } from "react";
import { DONATIONS, SHOP, canBuy, canDonate, money, owns, shopItem, type Career, type ShopKey } from "@/game";
import { gameActions } from "@/lib/game-store";
import { Sheet } from "@/components/common/Sheet";
import { Choice, Panel } from "@/components/common/ui";

type Pending = { k: "buy"; key: ShopKey } | { k: "donate"; amount: number };

/** 시즌 사이 홈 탭의 자금 쓰기: 한 번 사면 계속 남는 것들과 기부. 고르면 확인 시트를 한 번 거쳐요. */
export function ShopPanel({ career: c }: { career: Career }) {
  const [pending, setPending] = useState<Pending | null>(null);
  if (c.stage === "retired" || c.run) return null;
  const item = pending?.k === "buy" ? shopItem(pending.key) : null;
  const price = item ? item.price : pending?.k === "donate" ? pending.amount : 0;

  return (
    <Panel kicker={`보유 자금 ${money(c.earnings)}${c.donated ? ` · 누적 기부 ${money(c.donated)}` : ""}`} title="자금 쓰기">
      <p className="hint">한 번 사면 커리어 내내 효과가 남아요. 시즌 투자와 달리 매 시즌 돈이 들지 않아요.</p>
      <div className="choices invest-grid">
        {SHOP.map((i) => {
          const have = owns(c, i.key);
          return (
            <Choice
              key={i.key}
              label={i.name}
              tag={have ? "보유" : money(i.price)}
              sub={i.effect}
              aria-pressed={have}
              disabled={!have && !canBuy(c, i.key)}
              onClick={() => !have && setPending({ k: "buy", key: i.key })}
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
      {pending && (
        <Sheet labelledBy="shop-title" onClose={() => setPending(null)}>
          <span className="sheet-kicker">
            보유 자금 {money(c.earnings)} → {money(c.earnings - price)}
          </span>
          <h2 id="shop-title">{item ? `${item.name}, ${money(price)}에 살까요?` : `${money(price)}을 기부할까요?`}</h2>
          <p className="sheet-desc">{item ? item.effect : "기부한 돈은 은퇴 기록에 남아요."}</p>
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
