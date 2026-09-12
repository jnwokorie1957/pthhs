#!/usr/bin/env python3
"""Release checks for PTHHS native accessibility foundation (items 70–77, 80–83)."""

from __future__ import annotations

import re
from html.parser import HTMLParser
from pathlib import Path

from site_scope import is_internal_app_path, marketing_html_files

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
errors: list[str] = []


class AccessibilityAudit(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.headers = self.mains = self.footers = 0
        self.main_depth = 0
        self.lang = ""
        self.title = ""
        self.in_title = False
        self.ids: list[str] = []
        self.nav_labels: list[str] = []
        self.skip_targets: list[str] = []
        self.headings: list[tuple[int, bool, str]] = []
        self.current_heading: tuple[int, bool, str] | None = None
        self.image_count = 0
        self.link_count = 0
        self.form_count = 0
        self.anchor: dict[str, str] | None = None
        self.button: dict[str, str] | None = None
        self.unnamed_links = 0
        self.unnamed_buttons = 0
        self.bad_images = 0
        self.bad_buttons = 0
        self.fake_controls = 0
        self.div_breadcrumbs = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attr = {key.lower(): value or "" for key, value in attrs}
        classes = attr.get("class", "").split()
        if tag == "html":
            self.lang = attr.get("lang", "")
        if tag == "title":
            self.in_title = True
        if attr.get("id"):
            self.ids.append(attr["id"])
        if tag == "header":
            self.headers += 1
        if tag == "main":
            self.mains += 1
            self.main_depth += 1
        if tag == "footer":
            self.footers += 1
        if tag == "nav":
            self.nav_labels.append(attr.get("aria-label", ""))
        if tag == "div" and "breadcrumb" in classes:
            self.div_breadcrumbs += 1
        if tag == "form":
            self.form_count += 1
        if tag == "img":
            self.image_count += 1
            alt = attr.get("alt")
            if alt is None or re.fullmatch(r"\s*(?:image|photo|picture|graphic)\s*", alt, re.I):
                self.bad_images += 1
            if self.anchor is not None:
                self.anchor["name"] += " " + (alt or "")
        if tag == "a":
            self.link_count += 1
            self.anchor = {"name": attr.get("aria-label", ""), "href": attr.get("href", "")}
            if "skip-link" in classes:
                self.skip_targets.append(attr.get("href", ""))
            if attr.get("role") == "button" or "onclick" in attr or attr.get("href", "").lower().startswith("javascript:"):
                self.fake_controls += 1
        if tag == "button":
            self.button = {"name": attr.get("aria-label", ""), "type": attr.get("type", "")}
            if not attr.get("type"):
                self.bad_buttons += 1
        elif "onclick" in attr:
            self.fake_controls += 1
        if re.fullmatch(r"h[1-6]", tag):
            self.current_heading = (int(tag[1]), self.main_depth > 0, "")

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self.handle_starttag(tag, attrs)

    def handle_endtag(self, tag: str) -> None:
        if tag == "title":
            self.in_title = False
        if tag == "main":
            self.main_depth = max(0, self.main_depth - 1)
        if tag == "a" and self.anchor is not None:
            if not re.sub(r"\s+", " ", self.anchor["name"]).strip():
                self.unnamed_links += 1
            self.anchor = None
        if tag == "button" and self.button is not None:
            if not re.sub(r"\s+", " ", self.button["name"]).strip():
                self.unnamed_buttons += 1
            self.button = None
        if re.fullmatch(r"h[1-6]", tag) and self.current_heading is not None:
            self.headings.append(self.current_heading)
            self.current_heading = None

    def handle_data(self, data: str) -> None:
        if self.in_title:
            self.title += data
        if self.anchor is not None:
            self.anchor["name"] += data
        if self.button is not None:
            self.button["name"] += data
        if self.current_heading is not None:
            level, in_main, value = self.current_heading
            self.current_heading = (level, in_main, value + data)


page_count = image_count = link_count = form_count = 0
marketing_pages = marketing_html_files(PUBLIC)
for path in marketing_pages:
    relative = path.relative_to(PUBLIC).as_posix()
    text = path.read_text(errors="ignore")
    audit = AccessibilityAudit()
    audit.feed(text)
    page_count += 1
    image_count += audit.image_count
    link_count += audit.link_count
    form_count += audit.form_count

    if audit.lang.lower() != "en" or not audit.title.strip():
        errors.append(f"language or title missing: {relative}")
    if (audit.headers, audit.mains, audit.footers) != (1, 1, 1):
        errors.append(f"landmark count differs from 1/1/1: {relative}")
    if not audit.nav_labels or any(not label.strip() for label in audit.nav_labels):
        errors.append(f"unnamed navigation landmark: {relative}")
    if audit.skip_targets != ["#main-content"] or audit.ids.count("main-content") != 1:
        errors.append(f"skip-link/main target contract invalid: {relative}")
    if len(audit.ids) != len(set(audit.ids)):
        errors.append(f"duplicate id: {relative}")
    if audit.div_breadcrumbs:
        errors.append(f"generic breadcrumb container remains: {relative}")
    if audit.bad_images or audit.unnamed_links or audit.unnamed_buttons or audit.bad_buttons or audit.fake_controls:
        errors.append(
            f"control/media naming issue: {relative} "
            f"(images={audit.bad_images}, links={audit.unnamed_links}, buttons={audit.unnamed_buttons}, "
            f"button-types={audit.bad_buttons}, fake-controls={audit.fake_controls})"
        )

    h1s = [heading for heading in audit.headings if heading[0] == 1]
    if len(h1s) != 1 or not h1s[0][1] or not h1s[0][2].strip():
        errors.append(f"expected one named H1 inside main: {relative}")
    previous = 0
    for level, _in_main, label in audit.headings:
        if not label.strip():
            errors.append(f"empty heading: {relative}")
        if previous and level > previous + 1:
            errors.append(f"heading level jumps H{previous} to H{level}: {relative}")
        previous = level

    if re.search(r"userway|\buwy\b|accessibe|allyable", text, re.I):
        errors.append(f"accessibility overlay dependency found: {relative}")


def rgb(value: str) -> tuple[float, float, float]:
    value = value.removeprefix("#")
    if len(value) == 3:
        value = "".join(character * 2 for character in value)
    return tuple(int(value[index:index + 2], 16) / 255 for index in (0, 2, 4))


def luminance(value: str) -> float:
    channels = tuple(channel / 12.92 if channel <= .04045 else ((channel + .055) / 1.055) ** 2.4 for channel in rgb(value))
    return .2126 * channels[0] + .7152 * channels[1] + .0722 * channels[2]


def contrast(first: str, second: str) -> float:
    lighter, darker = sorted((luminance(first), luminance(second)), reverse=True)
    return (lighter + .05) / (darker + .05)


contrast_pairs = {
    "body text/white": ("#172033", "#ffffff", 4.5),
    "blue link/white": ("#1768b5", "#ffffff", 4.5),
    "muted text/white": ("#5d6878", "#ffffff", 4.5),
    "muted text/soft blue": ("#5d6878", "#edf6ff", 4.5),
    "body copy/white": ("#465467", "#ffffff", 4.5),
    "breadcrumb/hero": ("#627083", "#f6fbff", 4.5),
    "footer text/footer": ("#dceafb", "#0b3156", 4.5),
    "footer secondary/footer": ("#bcd0e2", "#0b3156", 4.5),
    "CTA copy/blue": ("#e8f3ff", "#1768b5", 4.5),
    "dark text/orange": ("#172033", "#f5a623", 4.5),
    "error/white": ("#9b1c1c", "#ffffff", 4.5),
    "success/white": ("#17603a", "#ffffff", 4.5),
    "form border/white": ("#627486", "#ffffff", 3.0),
    "blue focus/white": ("#1768b5", "#ffffff", 3.0),
    "white focus/dark blue": ("#ffffff", "#0b3156", 3.0),
    "white focus/CTA blue": ("#ffffff", "#0d4f8f", 3.0),
}
for label, (foreground, background, minimum) in contrast_pairs.items():
    ratio = contrast(foreground, background)
    if ratio < minimum:
        errors.append(f"contrast below target for {label}: {ratio:.2f}:1 < {minimum}:1")

components = (PUBLIC / "assets/components.css").read_text()
polish = (PUBLIC / "assets/polish.css").read_text()
script = (PUBLIC / "assets/site-enhancements.js").read_text()
for token in (
    ".skip-link:focus",
    "translateY(0)",
    ":focus-visible",
    "min-height: 44px",
    "::placeholder",
    "prefers-reduced-motion: reduce",
    "animation-duration: .01ms",
):
    if token not in components:
        errors.append(f"accessibility CSS token missing: {token}")
for token in (
    "button.type = 'button'",
    "aria-controls",
    "aria-expanded",
    "Open navigation menu",
    "Close navigation menu",
    "event.key === 'Escape'",
    "returnFocus: true",
    "reducedMotion.matches",
):
    if token not in script:
        errors.append(f"keyboard/motion behavior missing: {token}")
if "rgba(23,104,181,.35)" in polish:
    errors.append("translucent focus indicator remains")

plan = (ROOT / "plan.md").read_text()
for item in range(70, 84):
    if not re.search(rf"- \[x\] \*\*{item}\. ", plan):
        errors.append(f"completed plan item is not checked: {item}")

runtime_assets = {
    path.relative_to(PUBLIC).as_posix()
    for path in PUBLIC.rglob("*")
    if (
        path.is_file()
        and path.suffix.lower() in {".css", ".js"}
        and not is_internal_app_path(path, PUBLIC)
    )
}
expected_runtime_assets = {
    "assets/components.css",
    "assets/home.css",
    "assets/modern.css",
    "assets/polish.css",
    "assets/section-pages.css",
    "assets/site-enhancements.js",
}
if runtime_assets != expected_runtime_assets:
    errors.append(
        "unexpected deployed CSS/JS assets: "
        + ", ".join(sorted(runtime_assets ^ expected_runtime_assets))
    )
if not re.search(r"- \[x\] \*\*86\. ", plan):
    errors.append("completed plan item is not checked: 86")

if errors:
    print("ACCESSIBILITY_FOUNDATION_QA: FAIL")
    for error in errors:
        print("-", error)
    raise SystemExit(1)

print(
    f"ACCESSIBILITY_FOUNDATION_QA: PASS ({page_count} pages; {image_count} images; "
    f"{link_count} named links; {len(contrast_pairs)} contrast pairs; {form_count} live forms)"
)
