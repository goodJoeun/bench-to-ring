"""
한글 웹폰트를 굵기마다 파일 하나로 묶어요.

@fontsource의 한글 폰트는 굵기 하나가 unicode-range 조각 90개쯤으로 나뉘어 있어, 한글이 많은 화면은 조각을 수십 개 받아요.
조각 하나하나가 Vercel CDN 요청으로 세져서, 자주 쓰는 글자를 굵기마다 woff2 하나로 묶어 src/app/fonts/에 두고
src/app/fonts/fonts.css가 그 파일을 fontsource보다 나중에 선언해요. 브라우저는 나중에 선언한 쪽을 먼저 쓰니,
묶음에 있는 글자는 묶음 파일 하나로, 없는 드문 글자(플레이어가 지은 이름 등)만 fontsource 조각으로 받아요.

묶음에 넣는 글자: KS X 1001 완성형 한글 2,350자, 인쇄 가능한 ASCII, 그리고 src/ 안의 코드·문구에 쓰인 모든 글자.
문구를 많이 바꿨거나 FACES를 바꿨으면 다시 돌려 결과(woff2·fonts.css)를 함께 올려요. 빌드 때는 돌지 않아요.

  python -m pip install fonttools brotli
  python scripts/fonts.py
"""

import re
import sys
from pathlib import Path

from fontTools.merge import Merger
from fontTools.subset import Options, Subsetter
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parent.parent
FONTSOURCE = ROOT / "node_modules" / "@fontsource"
OUT = ROOT / "src" / "app" / "fonts"

# (fontsource 패키지, CSS 이름 = 굵기, font-family)
FACES = [
    ("black-han-sans", 400, "Black Han Sans"),
    ("ibm-plex-sans-kr", 400, "IBM Plex Sans KR"),
    ("ibm-plex-sans-kr", 500, "IBM Plex Sans KR"),
    ("ibm-plex-sans-kr", 700, "IBM Plex Sans KR"),
]


def ksx1001_hangul() -> set[int]:
    """KS X 1001(EUC-KR) 완성형 한글 2,350자"""
    chars = set()
    for hi in range(0xB0, 0xC9):
        for lo in range(0xA1, 0xFF):
            chars.update(ord(c) for c in bytes([hi, lo]).decode("euc-kr", errors="ignore"))
    return chars


def source_chars() -> set[int]:
    """src/ 안의 코드·문구에 쓰인 글자 (ASCII 밖)"""
    chars = set()
    for p in (ROOT / "src").rglob("*"):
        if p.suffix in {".ts", ".tsx", ".css"}:
            chars.update(ord(c) for c in p.read_text(encoding="utf-8") if ord(c) > 0x7E)
    return chars


def parse_range(text: str) -> set[int]:
    out = set()
    for part in text.split(","):
        part = part.strip().removeprefix("U+").removeprefix("u+")
        if "-" in part:
            a, b = part.split("-")
            out.update(range(int(a, 16), int(b, 16) + 1))
        elif "?" in part:
            out.update(range(int(part.replace("?", "0"), 16), int(part.replace("?", "f"), 16) + 1))
        else:
            out.add(int(part, 16))
    return out


def format_range(points: set[int]) -> str:
    runs = []
    for p in sorted(points):
        if runs and p == runs[-1][1] + 1:
            runs[-1][1] = p
        else:
            runs.append([p, p])
    return ",".join(f"U+{a:x}" if a == b else f"U+{a:x}-{b:x}" for a, b in runs)


def pieces(pkg: str, weight: int) -> list[tuple[Path, set[int]]]:
    """fontsource CSS의 (woff2 조각, unicode-range) 목록"""
    css = (FONTSOURCE / pkg / f"{weight}.css").read_text(encoding="utf-8")
    out = []
    for block in re.findall(r"@font-face\s*\{(.*?)\}", css, re.S):
        url = re.search(r"url\(\./(files/[^)]+\.woff2)\)", block)
        rng = re.search(r"unicode-range:\s*([^;]+);", block)
        if url and rng:
            out.append((FONTSOURCE / pkg / url.group(1), parse_range(rng.group(1))))
    return out


def build(pkg: str, weight: int, family: str, wanted: set[int]) -> str:
    used = [path for path, rng in pieces(pkg, weight) if rng & wanted]
    font = Merger().merge([str(p) for p in used])
    opts = Options()
    opts.flavor = "woff2"
    opts.layout_features = ["*"]
    opts.name_IDs = ["*"]
    opts.notdef_outline = True
    sub = Subsetter(opts)
    sub.populate(unicodes=wanted)
    sub.subset(font)
    covered = set(font.getBestCmap()) & wanted
    name = f"{pkg}-{weight}.woff2"
    font.flavor = "woff2"
    font.save(OUT / name)
    size = (OUT / name).stat().st_size
    print(f"{name}: 조각 {len(used)}개 → 1개 · 글자 {len(covered)}개 · {size / 1024:.0f}KB")
    return "\n".join(
        [
            "@font-face {",
            f"  font-family: '{family}';",
            "  font-style: normal;",
            "  font-display: swap;",
            f"  font-weight: {weight};",
            f"  src: url(./{name}) format('woff2');",
            f"  unicode-range: {format_range(covered)};",
            "}",
        ]
    )


def main() -> None:
    if not FONTSOURCE.exists():
        sys.exit("node_modules/@fontsource가 없어요. npm install을 먼저 하세요.")
    OUT.mkdir(parents=True, exist_ok=True)
    wanted = ksx1001_hangul() | set(range(0x20, 0x7F)) | source_chars()
    faces = [build(pkg, weight, family, wanted) for pkg, weight, family in FACES]
    header = "/* scripts/fonts.py가 만든 파일이에요. 직접 고치지 마세요. fontsource CSS보다 나중에 불러와야 해요(layout.tsx). */"
    (OUT / "fonts.css").write_text("\n\n".join([header, *faces]) + "\n", encoding="utf-8", newline="\n")


if __name__ == "__main__":
    main()
