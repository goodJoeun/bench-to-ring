"use client";

import { useEffect, useState } from "react";
import type { Career } from "@/game";
import { gameActions } from "@/lib/game-store";
import { Sheet } from "@/components/common/Sheet";
import { SITE_NAME } from "@/lib/site";
import { CARD_H, CARD_W, drawCard } from "./careerCard";

type CardState = { url: string; file: File } | "loading" | "error";

/** 파일 이름에 쓸 수 없는 글자를 빼요. */
const fileName = (name: string): string => `bench2ring-${name.replace(/[\\/:*?"<>|\s]+/g, "_")}.png`;

/** 이미지를 클립보드에 넣을 수 있는 브라우저인지 */
const canCopyImage = (): boolean => typeof ClipboardItem !== "undefined" && typeof navigator.clipboard?.write === "function";

/**
 * 기록 카드 시트: 열면 카드를 그려 미리 보여주고, 카드 이미지를 공유하거나 저장해요.
 * 공유는 휴대폰이면 공유 창을 띄우고, PC면 이미지를 복사해 카카오톡 대화창에 붙여 넣게 해요. 둘 다 안 되면 저장해요.
 */
export function ShareSheet({ career: c, onClose }: { career: Career; onClose: () => void }) {
  const [card, setCard] = useState<CardState>("loading");
  useEffect(() => {
    let live = true;
    let url = "";
    drawCard(c)
      .then((blob) => {
        if (!live) return;
        url = URL.createObjectURL(blob);
        setCard({ url, file: new File([blob], fileName(c.p.name), { type: "image/png" }) });
      })
      .catch(() => live && setCard("error"));
    return () => {
      live = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [c]);

  const ready = typeof card === "object" ? card : null;

  const save = () => {
    if (!ready) return;
    const a = document.createElement("a");
    a.href = ready.url;
    a.download = ready.file.name;
    a.click();
  };

  // 공유 창은 누른 순간에 열어야 해서(iOS), 카드는 시트를 열 때 미리 그려 둬요.
  const share = async () => {
    if (!ready) return;
    // PC의 공유 창(윈도우 등)에는 메신저가 잘 없어서, 휴대폰·태블릿만 공유 창을 띄우고 PC는 복사해요.
    const touch = matchMedia("(pointer: coarse)").matches;
    if (touch && navigator.canShare?.({ files: [ready.file] })) {
      try {
        await navigator.share({ files: [ready.file], title: `${c.p.name}의 커리어 · ${SITE_NAME}` });
      } catch (e) {
        if (!(e instanceof DOMException && e.name === "AbortError")) gameActions.notify("카드를 공유하지 못했어요. 이미지 저장 뒤 보내 주세요");
      }
      return;
    }
    if (canCopyImage()) {
      try {
        await navigator.clipboard.write([new ClipboardItem({ "image/png": ready.file })]);
        gameActions.notify("카드 이미지를 복사했어요. 카카오톡 대화창에 붙여 넣어 보내세요");
        return;
      } catch {
        // 복사도 안 되면 저장으로 이어가요.
      }
    }
    save();
    gameActions.notify("카드 이미지를 저장했어요. 카카오톡 등에서 사진으로 보내세요");
  };

  return (
    <Sheet labelledBy="share-title" onClose={onClose}>
      <span className="sheet-kicker">은퇴 기록</span>
      <h2 id="share-title">기록 카드</h2>
      <div className="card-preview" style={{ aspectRatio: `${CARD_W} / ${CARD_H}` }}>
        {ready ? (
          // 방금 그린 카드(blob 주소)라 next/image가 필요 없어요.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={ready.url} alt={`${c.p.name} 기록 카드`} />
        ) : (
          <span className="hint">{card === "error" ? "카드를 그리지 못했어요" : "카드를 그리고 있어요…"}</span>
        )}
      </div>
      <div className="share-actions">
        <button type="button" className="sheet-go" disabled={!ready} onClick={() => void share()}>
          카드 공유하기
        </button>
        <button type="button" className="btn" disabled={!ready} onClick={save}>
          이미지 저장
        </button>
      </div>
      <p className="sheet-desc share-tip">카카오톡 등으로 카드 이미지를 보내요. 휴대폰에서는 카드를 길게 눌러 저장할 수도 있어요.</p>
    </Sheet>
  );
}
