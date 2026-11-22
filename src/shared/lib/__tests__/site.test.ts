import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SITE_ICON } from "../site";

describe("SITE_ICON", () => {
  it("주소의 v가 아이콘 파일 내용의 해시와 같아요 (파일만 바꾸면 브라우저가 옛 아이콘을 1년 동안 보여줘요)", () => {
    const [path, query] = SITE_ICON.split("?");
    const file = readFileSync(`public${path}`);
    expect(query).toBe(`v=${createHash("sha1").update(file).digest("hex").slice(0, 8)}`);
  });
});
