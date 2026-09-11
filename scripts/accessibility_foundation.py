#!/usr/bin/env python3
"""Apply deterministic, sitewide accessibility-foundation improvements."""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"

RUNTIME_ASSETS = {
    "assets/components.css",
    "assets/home.css",
    "assets/modern.css",
    "assets/polish.css",
    "assets/section-pages.css",
    "assets/site-enhancements.js",
}


def put_hero_inside_main(text: str) -> str:
    """Make the page heading and hero part of the primary landmark."""
    pattern = re.compile(
        r'(</header>)'
        r'((?:\s*<section\b[^>]*class=["\'][^"\']*\bpage-hero\b[^"\']*["\'][^>]*>)[\s\S]*?)'
        r'(<main\s+id=["\']main-content["\']\s+tabindex=["\']-1["\']>)',
        re.I | re.S,
    )
    return pattern.sub(r"\1\3\2", text, count=1)


def semantic_breadcrumbs(text: str) -> str:
    text = re.sub(
        r'<div\s+class=["\']breadcrumb["\']>',
        '<nav class="breadcrumb" aria-label="Breadcrumb">',
        text,
        flags=re.I,
    )
    # Breadcrumbs have no nested divs in the generated templates.
    if '<nav class="breadcrumb" aria-label="Breadcrumb">' in text:
        start = 0
        while True:
            start = text.find('<nav class="breadcrumb" aria-label="Breadcrumb">', start)
            if start < 0:
                break
            close = text.find("</div>", start)
            nav_close = text.find("</nav>", start)
            if close >= 0 and (nav_close < 0 or close < nav_close):
                text = text[:close] + "</nav>" + text[close + len("</div>") :]
            start += 1
    return text


def normalize_404_headings(path: Path, text: str) -> str:
    if path.name != "404.html":
        return text
    return re.sub(
        r'<h3>(Need Care\?|Find Your Area|Talk With Us)</h3>',
        r'<h2>\1</h2>',
        text,
    )


changed = 0
for path in sorted(PUBLIC.rglob("*.html")):
    original = path.read_text(errors="strict")
    text = put_hero_inside_main(original)
    text = semantic_breadcrumbs(text)
    text = normalize_404_headings(path, text)
    if text != original:
        path.write_text(text)
        changed += 1

removed_bytes = 0
removed_files = 0
for path in sorted(PUBLIC.rglob("*")):
    if not path.is_file() or path.suffix.lower() not in {".css", ".js"}:
        continue
    relative = path.relative_to(PUBLIC).as_posix()
    if relative in RUNTIME_ASSETS:
        continue
    removed_bytes += path.stat().st_size
    removed_files += 1
    path.unlink()

print(
    f"Applied accessibility foundation to {len(list(PUBLIC.rglob('*.html')))} HTML files "
    f"({changed} changed); removed {removed_files} unused runtime files ({removed_bytes} bytes)."
)
