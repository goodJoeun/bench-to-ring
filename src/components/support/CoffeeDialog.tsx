"use client";

import { useState } from "react";
import { Sheet } from "@/components/common/Sheet";
import { SUPPORT_ACCOUNT } from "@/lib/site";

/** 상단 '커피' 버튼으로 여는 후원 안내: 계좌번호를 보여주고 눌러서 복사해요. */
export function CoffeeDialog({ onClose }: { onClose: () => void }) {
  const { bank, number, holder } = SUPPORT_ACCOUNT;
  const [copied, setCopied] = useState<boolean | null>(null);

  const copy = async () => {
    try {
      // 은행 앱에 붙여 넣기 좋게 숫자만 복사해요.
      await navigator.clipboard.writeText(number.replace(/\D/g, ""));
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Sheet labelledBy="cf-title" onClose={onClose}>
      <button type="button" className="sheet-x" aria-label="닫기" onClick={onClose}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6.4 5 12 10.6 17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4-5.6-5.6L6.4 19 5 17.6l5.6-5.6L5 6.4z" />
        </svg>
      </button>
      <span className="cf-cup" aria-hidden="true">
        ☕
      </span>
      <h2 id="cf-title">개발자에게 커피 한 잔</h2>
      <p className="sheet-desc">
        농구 선수 키우기는 광고 없이 무료로 운영하고 있어요. 재밌게 즐기셨다면 커피 한 잔으로 응원해 주세요. 서버비와 다음 업데이트에 보탤게요.
      </p>
      <div className="cf-account">
        <span className="cf-bank">{bank}</span>
        <b className="cf-num">{number}</b>
        {holder && <span className="cf-holder">예금주 {holder}</span>}
      </div>
      <button type="button" className="sheet-go" onClick={() => void copy()}>
        {copied ? "복사했어요!" : "계좌번호 복사하기"}
      </button>
      <p className="cf-note" role="status">
        {copied === false ? "복사하지 못했어요. 계좌번호를 길게 눌러 직접 복사해 주세요." : "보내 주신 마음은 하나하나 감사히 받을게요."}
      </p>
    </Sheet>
  );
}
