"use client";

import { Sheet } from "@/components/common/Sheet";
import { kstDay } from "@/lib/leaderboard/days";
import type { Notice } from "@/lib/notices";

const HIDE_KEY = "b2r-notice-alert-hidden";
/** 공지 목록을 열어 이미 안내한 글 id. 이 글들로는 다시 안내하지 않아요. */
const SEEN_KEY = "b2r-notice-alert-seen";

/** 공지 목록을 연 적이 있어 이미 안내한 글 */
export function noticesAlerted(): Set<string> {
  try {
    return new Set((localStorage.getItem(SEEN_KEY) ?? "").split(",").filter(Boolean));
  } catch {
    return new Set();
  }
}

/** 공지 목록을 열었어요. 지금 있는 글은 다시 안내하지 않아요. */
export function markNoticesAlerted(ids: string[]): void {
  try {
    localStorage.setItem(SEEN_KEY, [...new Set([...noticesAlerted(), ...ids])].join(","));
  } catch {
    // 저장소를 쓸 수 없으면 다음 접속에 다시 안내해요.
  }
}

/** 오늘(한국 시간) '오늘 하루 보지 않기'를 눌렀는지. 저장소를 못 쓰면 보여줘요. */
export function noticeAlertHiddenToday(): boolean {
  try {
    return localStorage.getItem(HIDE_KEY) === kstDay(Date.now());
  } catch {
    return false;
  }
}

function hideToday(): void {
  try {
    localStorage.setItem(HIDE_KEY, kstDay(Date.now()));
  } catch {
    // 저장소를 쓸 수 없으면 이번에만 닫혀요.
  }
}

/**
 * 접속했을 때 안 읽은 새 공지가 있으면 띄우는 안내. 공지 목록을 한 번 열면 그때까지의 글로는 다시 띄우지 않아요. 가장 최근 안 읽은 글 제목을 보여주고,
 * 바로 공지를 열거나, 닫거나, 오늘 하루 보지 않게 할 수 있어요.
 */
export function NoticeAlert({ latest, count, onOpen, onClose }: { latest: Notice; count: number; onOpen: () => void; onClose: () => void }) {
  return (
    <Sheet labelledBy="na-title" onClose={onClose}>
      <span className="na-icon" aria-hidden="true">
        📣
      </span>
      <h2 id="na-title">새로운 소식이 있어요</h2>
      <p className="sheet-desc">
        새로운 패치 내용이 있어요. 상단의 <b>📣 공지</b>를 눌러 확인해 주세요.
      </p>
      <div className="na-latest">
        <span className="nt-tag">{count > 1 ? `새 글 ${count}개` : "새 글"}</span>
        <b>
          <span aria-hidden="true">{latest.icon}</span> {latest.title}
        </b>
      </div>
      <button type="button" className="sheet-go" onClick={onOpen}>
        지금 공지 보기
      </button>
      <div className="na-actions">
        <button
          type="button"
          className="sheet-later"
          onClick={() => {
            hideToday();
            onClose();
          }}
        >
          오늘 하루 보지 않기
        </button>
        <button type="button" className="sheet-later" onClick={onClose}>
          닫기
        </button>
      </div>
    </Sheet>
  );
}
