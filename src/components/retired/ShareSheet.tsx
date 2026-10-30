"use client";

import { useEffect, useState } from "react";
import type { Career } from "@/game";
import { gameActions } from "@/lib/game-store";
import { Sheet } from "@/components/common/Sheet";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { CARD_H, CARD_W, drawCard } from "./careerCard";

type CardState = { url: string; file: File } | "loading" | "error";

/** 파일 이름에 쓸 수 없는 글자를 빼요. */
const fileName = (name: string): string => `bench2ring-${name.replace(/[\\/:*?"<>|\s]+/g, "_")}.png`;

/** 이미지를 클립보드에 넣을 수 있는 브라우저인지 */
const canCopyImage = (): boolean => typeof ClipboardItem !== "undefined" && typeof navigator.clipboard?.write === "function";

/** 카드와 함께 보내는 한 줄과 게임 링크 */
const shareText = (name: string): string => `${name}의 농구 커리어 기록 카드 🏀\n나도 선수 키워 보기 👉 ${SITE_URL}`;

/**
 * 기록 카드 시트: 열면 카드를 그려 미리 보여주고, 카드 이미지를 공유하거나 저장해요.
 * 공유는 휴대폰이면 공유 창으로 카드와 게임 링크를 함께 보내고, PC면 이미지를 복사해 카카오톡 대화창에 붙여 넣게 해요.
 * PC 클립보드에는 이미지와 글을 함께 넣을 수 없어서, 게임 링크는 '게임 링크 복사'로 따로 복사해요. 둘 다 안 되면 저장해요.
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
        // 링크는 url 대신 글에 넣어요. 사진과 함께 보낼 때 url 칸을 버리는 앱(안드로이드 카카오톡 등)이 있어서요.
        await navigator.share({ files: [ready.file], title: `${c.p.name}의 커리어 · ${SITE_NAME}`, text: shareText(c.p.name) });
      } catch (e) {
        if (!(e instanceof DOMException && e.name === "AbortError")) gameActions.notify("카드를 공유하지 못했어요. 이미지 저장 뒤 보내 주세요");
      }
      return;
    }
    if (canCopyImage()) {
      try {
        await navigator.clipboard.write([new ClipboardItem({ "image/png": ready.file })]);
        gameActions.notify("카드 이미지를 복사했어요. 대화창에 붙여 넣은 뒤 '게임 링크 복사'로 링크도 함께 보내세요");
        return;
      } catch {
        // 복사도 안 되면 저장으로 이어가요.
      }
    }
    save();
    gameActions.notify("카드 이미지를 저장했어요. 사진으로 보낼 때 '게임 링크 복사'로 링크도 함께 보내세요");
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareText(c.p.name));
      gameActions.notify("게임 링크를 복사했어요. 카드와 함께 붙여 넣어 보내세요");
    } catch {
      gameActions.notify(`링크를 복사하지 못했어요. ${SITE_URL.replace(/^https?:\/\//, "")}을 직접 보내 주세요`);
    }
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
        <button type="button" className="btn" onClick={() => void copyLink()}>
          게임 링크 복사
        </button>
      </div>
    </Sheet>
  );
}
