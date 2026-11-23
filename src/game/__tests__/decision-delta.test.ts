import { describe, expect, it } from "vitest";
import { decisionDelta } from "../career/delta";
import type { Career } from "../core/types";

const career = (patch: Partial<Career> = {}, attrs: Partial<Career["p"]["attrs"]> = {}): Career =>
  ({
    p: { attrs: { sht: 50, hdl: 50, pas: 50, def: 50, iq: 50, ath: 50, ...attrs } },
    health: 80,
    earnings: 1,
    trust: 0,
    star: 10,
    run: null,
    ...patch,
  }) as unknown as Career;

describe("decisionDelta", () => {
  it("실제로 바뀐 값만 한 줄로 알려줘요", () => {
    expect(decisionDelta(career(), career({ health: 77, trust: 1 }))).toBe("건강 -3 · 코치 신뢰 상승");
    expect(decisionDelta(career(), career())).toBe("");
  });

  it("보이는 수치가 그대로면 소수점 변화는 적지 않아요", () => {
    expect(decisionDelta(career(), career({ health: 80.2 }, { sht: 50.3 }))).toBe("");
  });

  it("소식에 능력치 수치가 있으면 능력치만 다시 적지 않아요", () => {
    const after = career({ health: 75 }, { hdl: 51, iq: 51 });
    expect(decisionDelta(career(), after, "전지훈련에서 땀을 흘렸어요. 볼 핸들링·BQ +1")).toBe("건강 -5");
    expect(decisionDelta(career(), after, "전지훈련에서 땀을 흘렸어요.")).toBe("볼 핸들링 +1 · BQ +1 · 건강 -5");
  });

  it("돈과 시즌 중 경기력 변화도 알려줘요", () => {
    const run = { form: 0 } as Career["run"];
    const after = career({ earnings: 0.5, run: { form: 0.4 } as Career["run"] });
    expect(decisionDelta(career({ run }), after)).toBe("비용 5,000만 · 경기력 상승");
  });
});
