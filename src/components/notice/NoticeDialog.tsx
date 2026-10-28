"use client";

import { useState } from "react";
import { Sheet } from "@/components/common/Sheet";
import { NOTICE_KIND_NAME, NOTICES, markNoticeRead, useReadNotices, type Notice } from "@/lib/notices";

/** 상단 '공지' 버튼으로 여는 패치노트·공지사항. 목록에서 글을 누르면 상세 보기로 넘어가요. */
export function NoticeDialog({ onClose }: { onClose: () => void }) {
  const read = useReadNotices();
  const [open, setOpen] = useState<Notice | null>(null);

  const show = (n: Notice) => {
    markNoticeRead(n.id);
    setOpen(n);
  };

  return (
    <Sheet labelledBy="nt-title" onClose={onClose}>
      <button type="button" className="sheet-x" aria-label="닫기" onClick={onClose}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6.4 5 12 10.6 17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4-5.6-5.6L6.4 19 5 17.6l5.6-5.6L5 6.4z" />
        </svg>
      </button>
      {open ? (
        <article className="nt-detail">
          {/* 누른 줄이 사라지니 초점을 '목록'으로 옮겨요. */}
          <button type="button" className="nt-back" autoFocus onClick={() => setOpen(null)}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M15.4 5 8.4 12l7 7-1.4 1.4L5.6 12 14 3.6z" />
            </svg>
            목록
          </button>
          <span className="nt-tag">{NOTICE_KIND_NAME[open.kind]}</span>
          <h2 id="nt-title">
            <span aria-hidden="true">{open.icon}</span> {open.title}
          </h2>
          <span className="nt-date">{open.date}</span>
          {open.intro && <p className="nt-intro">{open.intro}</p>}
          {open.sections.map((s) => (
            <section key={s.title} className="nt-sec">
              <h3>{s.title}</h3>
              <ul>
                {s.items.map((it) => (
                  <li key={it}>{it}</li>
                ))}
              </ul>
            </section>
          ))}
        </article>
      ) : (
        <>
          <h2 id="nt-title">공지</h2>
          <ul className="nt-list">
            {NOTICES.map((n) => (
              <li key={n.id}>
                <button type="button" className="nt-row" onClick={() => show(n)}>
                  <span className="nt-tag">{NOTICE_KIND_NAME[n.kind]}</span>
                  <span className="nt-main">
                    <b>
                      <span aria-hidden="true">{n.icon}</span> {n.title}
                      {!read.has(n.id) && <i className="nt-dot" role="img" aria-label="새 글" />}
                    </b>
                    <span className="nt-date">{n.date}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </Sheet>
  );
}
