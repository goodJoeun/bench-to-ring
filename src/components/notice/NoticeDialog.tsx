"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { Sheet } from "@/components/common/Sheet";
import { NOTICE_KIND_NAME, NOTICES, markNoticeRead, useReadNotices, type Notice } from "@/lib/notices";

/** 목록에 한 번에 보이는 글 수. 더 있으면 목록 안에서 내려서 봐요. */
const SHOWN = 5;

/** 상단 '공지' 버튼으로 여는 패치노트·공지사항. 목록에서 글을 누르면 상세 보기로 넘어가요. */
export function NoticeDialog({ onClose }: { onClose: () => void }) {
  const read = useReadNotices();
  const [open, setOpen] = useState<Notice | null>(null);
  const listRef = useRef<HTMLUListElement>(null);
  // 목록 끝까지 내렸는지. 아래에 글이 남았으면 끝을 흐리게 해서 더 있다는 걸 알려요.
  const [atEnd, setAtEnd] = useState(NOTICES.length <= SHOWN);

  // 제목이 두 줄인 글도 있어서, SHOWN번째 글의 아래 끝까지를 재서 목록 높이로 써요.
  useLayoutEffect(() => {
    const list = listRef.current;
    if (open || !list || list.children.length <= SHOWN) return;
    const last = list.children[SHOWN - 1] as HTMLElement;
    list.style.maxHeight = `${last.getBoundingClientRect().bottom - list.getBoundingClientRect().top}px`;
  }, [open]);

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
          {open.body?.map((para) => (
            <p key={para} className="nt-body">
              {para}
            </p>
          ))}
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
          <ul
            ref={listRef}
            className="nt-list"
            data-scroll={NOTICES.length > SHOWN || undefined}
            data-end={atEnd || undefined}
            tabIndex={NOTICES.length > SHOWN ? 0 : undefined}
            aria-label={`공지 ${NOTICES.length}개`}
            onScroll={(e) => {
              const el = e.currentTarget;
              setAtEnd(el.scrollTop + el.clientHeight >= el.scrollHeight - 4);
            }}
          >
            {NOTICES.map((n) => (
              <li key={n.id} data-pinned={n.pinned || undefined}>
                <button type="button" className="nt-row" onClick={() => show(n)}>
                  <span className="nt-tag">{n.pinned ? "📌 고정" : NOTICE_KIND_NAME[n.kind]}</span>
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
          {NOTICES.length > SHOWN && (
            <p className="nt-more" aria-hidden="true">
              {atEnd ? `공지 ${NOTICES.length}개를 모두 봤어요` : `내려서 더 보기 · 공지 ${NOTICES.length}개`}
            </p>
          )}
        </>
      )}
    </Sheet>
  );
}
