"use client";

import { useState } from "react";
import { Sheet } from "@/components/common/Sheet";
import type { ApiError } from "@/lib/leaderboard/types";

type Kind = "bug" | "idea" | "etc";

const KINDS: { key: Kind; name: string; hint: string }[] = [
  { key: "bug", name: "버그 제보", hint: "어떤 화면에서 무엇을 했을 때 문제가 생겼는지 알려 주세요." },
  { key: "idea", name: "개선 제안", hint: "무엇이 바뀌면 더 재미있을지 알려 주세요." },
  { key: "etc", name: "기타", hint: "하고 싶은 이야기를 자유롭게 적어 주세요." },
];

/** 서버(src/server/feedback.ts)와 같은 길이 제한 */
const MAX = 500;

interface FeedbackDialogProps {
  onClose: () => void;
  /** 진행 중인 커리어 한 줄 (버그를 따라가 보려고 함께 보내요) */
  career?: string;
}

/** 상단 '의견' 버튼으로 여는 의견 보내기. 버그 제보·개선 제안·기타를 골라 운영자 메일로 보내요. */
export function FeedbackDialog({ onClose, career }: FeedbackDialogProps) {
  const [kind, setKind] = useState<Kind>("bug");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);
  const hint = KINDS.find((k) => k.key === kind)!.hint;

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || state === "sending") return;
    setState("sending");
    setError(null);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, message, email: email.trim(), page: location.pathname + location.hash, career, website }),
      });
      if (res.ok) return setState("sent");
      const body = (await res.json().catch(() => null)) as ApiError | null;
      setError(body?.error ?? "보내지 못했어요. 잠시 뒤에 다시 시도해 주세요.");
    } catch {
      setError("인터넷 연결을 확인하고 다시 시도해 주세요.");
    }
    setState("idle");
  };

  return (
    <Sheet labelledBy="fb-title" onClose={onClose}>
      <button type="button" className="sheet-x" aria-label="닫기" onClick={onClose}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6.4 5 12 10.6 17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4-5.6-5.6L6.4 19 5 17.6l5.6-5.6L5 6.4z" />
        </svg>
      </button>
      <h2 id="fb-title">의견 보내기</h2>
      {state === "sent" ? (
        <div className="fb-done" role="status">
          <b>의견을 보냈어요</b>
          <span>소중한 의견 고마워요. 꼼꼼히 읽어 볼게요.</span>
          <button type="button" className="sheet-go" onClick={onClose}>
            닫기
          </button>
        </div>
      ) : (
        <form className="fb" onSubmit={(e) => void send(e)}>
          <p className="fb-q" id="fb-kind">
            어떤 이야기인가요?
          </p>
          <div className="fb-kinds" role="radiogroup" aria-labelledby="fb-kind">
            {KINDS.map((k) => (
              <button type="button" key={k.key} role="radio" aria-checked={kind === k.key} onClick={() => setKind(k.key)}>
                {k.name}
              </button>
            ))}
          </div>
          <textarea
            className="fb-text"
            aria-label="의견 내용"
            placeholder={hint}
            maxLength={MAX}
            rows={6}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <span className="fb-count" aria-live="polite">
            {message.length}/{MAX}
          </span>
          <input
            className="fb-mail"
            type="email"
            inputMode="email"
            autoComplete="email"
            aria-label="답장 받을 이메일 (선택)"
            placeholder="답장 받을 이메일 (선택)"
            maxLength={120}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {/* 봇만 채우는 숨은 칸 */}
          <input className="fb-hp" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" value={website} onChange={(e) => setWebsite(e.target.value)} />
          {error && (
            <p className="fb-err" role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="sheet-go" disabled={!message.trim() || state === "sending"}>
            {state === "sending" ? "보내는 중…" : "보내기"}
          </button>
          <p className="fb-foot">보던 화면과 브라우저 정보가 함께 전달돼요. 답장이 필요하면 이메일을 적어 주세요.</p>
        </form>
      )}
    </Sheet>
  );
}
