import { describe, expect, it } from "vitest";
import { FEEDBACK_INTERVAL_MS, FEEDBACK_MAX, feedbackMail, markSent, parseFeedback, tooSoon } from "@/server/feedback";

describe("의견 보내기", () => {
  it("종류와 내용이 있어야 하고, 내용은 500자까지예요", () => {
    expect(parseFeedback({ kind: "bug", message: "시즌이 멈춰요" })).toMatchObject({ ok: true });
    expect(parseFeedback({ kind: "idea", message: "가".repeat(FEEDBACK_MAX), email: "" })).toMatchObject({ ok: true });
    for (const bad of [
      { kind: "bug", message: "   " },
      { kind: "bug", message: "가".repeat(FEEDBACK_MAX + 1) },
      { kind: "spam", message: "안녕" },
      { kind: "etc", message: "안녕", email: "메일 아님" },
      "의견",
    ])
      expect(parseFeedback(bad), JSON.stringify(bad)).toMatchObject({ ok: false });
  });

  it("메일 본문은 HTML을 그대로 넣지 않고, 상황 정보를 붙여요", () => {
    const r = parseFeedback({ kind: "bug", message: "<b>굵게</b>\n둘째 줄", page: "/#mine", career: "김벤치 · 2040년 30세 · LA 레이커스" });
    if (!r.ok) throw new Error(r.error);
    const m = feedbackMail(r.feedback, "TestBrowser/1.0");
    expect(m.subject).toBe("[농구 선수 키우기 · 버그 제보] <b>굵게</b>");
    expect(m.html).toContain("&lt;b&gt;굵게&lt;/b&gt;");
    expect(m.html).not.toContain("<b>굵게");
    expect(m.text).toContain("커리어: 김벤치 · 2040년 30세 · LA 레이커스");
    expect(m.text).toContain("브라우저: TestBrowser/1.0");
  });

  it("보낸 뒤 30초 안에는 같은 곳에서 다시 못 보내요", () => {
    const t = 1_000_000;
    expect(tooSoon("1.2.3.4", t)).toBe(false);
    markSent("1.2.3.4", t);
    expect(tooSoon("1.2.3.4", t + FEEDBACK_INTERVAL_MS - 1)).toBe(true);
    expect(tooSoon("5.6.7.8", t + 1)).toBe(false);
    expect(tooSoon("1.2.3.4", t + FEEDBACK_INTERVAL_MS)).toBe(false);
  });
});
