#!/usr/bin/env python3
"""Release checks for the sitewide shell, IA, actions, and legacy-runtime removal."""

from __future__ import annotations

import json
import re
from html.parser import HTMLParser
from pathlib import Path

from site_scope import marketing_html_files

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
errors: list[str] = []

NAV_HREFS = [
    "/home-care-about-us",
    "/home-care-services",
    "/home-care-areas-we-serve",
    "/home-care-insurance",
    "/home-care-resources",
    "/home-care-careers",
    "/home-care-contact-us",
]


class PageAudit(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.headers = 0
        self.mains = 0
        self.footers = 0
        self.mobile_bars = 0
        self.skip_links = 0
        self.in_primary_nav = False
        self.nav_hrefs: list[str] = []
        self.primary_actions: list[tuple[str, str]] = []
        self.current_anchor: tuple[str, str] | None = None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attr = {key: value or "" for key, value in attrs}
        classes = attr.get("class", "").split()
        if tag == "header": self.headers += 1
        if tag == "main": self.mains += 1
        if tag == "footer": self.footers += 1
        if "mobile-care-bar" in classes: self.mobile_bars += 1
        if "skip-link" in classes: self.skip_links += 1
        if tag == "nav" and attr.get("aria-label", "").lower() == "primary navigation":
            self.in_primary_nav = True
        if tag == "a":
            if self.in_primary_nav: self.nav_hrefs.append(attr.get("href", ""))
            if "btn-primary" in classes:
                self.current_anchor = (attr.get("href", ""), "")

    def handle_endtag(self, tag: str) -> None:
        if tag == "nav" and self.in_primary_nav: self.in_primary_nav = False
        if tag == "a" and self.current_anchor:
            self.primary_actions.append(self.current_anchor)
            self.current_anchor = None

    def handle_data(self, data: str) -> None:
        if self.current_anchor:
            self.current_anchor = (self.current_anchor[0], self.current_anchor[1] + data)


marketing_pages = marketing_html_files(PUBLIC)
for path in marketing_pages:
    relative = path.relative_to(PUBLIC).as_posix()
    text = path.read_text(errors="ignore")
    parser = PageAudit()
    parser.feed(text)
    if "modern-page" not in text or "template-refresh" not in text:
        errors.append(f"shared body classes missing: {relative}")
    if parser.headers != 1 or parser.mains != 1 or parser.footers != 1:
        errors.append(f"expected one header/main/footer: {relative}")
    if parser.mobile_bars != 1 or parser.skip_links != 1:
        errors.append(f"shared mobile bar or skip link missing: {relative}")
    if '<main id="main-content" tabindex="-1">' not in text:
        errors.append(f"canonical main target missing: {relative}")
    if parser.nav_hrefs != NAV_HREFS:
        errors.append(f"information architecture differs: {relative}")
    if "/assets/components.css" not in text:
        errors.append(f"shared component layer missing: {relative}")
    tags = re.findall(r"<(?:link|script)\b[^>]*>", text, re.I)
    if any(re.search(r"wp-content/(?:themes|plugins|cache)|wp-includes|rocketlazyloadscript", tag, re.I) for tag in tags):
        errors.append(f"legacy CSS/JS dependency remains: {relative}")
    if re.search(r"<!--\[if\s+(?:lt|gt|IE)", text, re.I):
        errors.append(f"obsolete IE conditional remains: {relative}")
    for href, label in parser.primary_actions:
        if href != "/home-care-contact-us" or " ".join(label.split()) != "Get Started":
            errors.append(f"nonstandard primary action in {relative}: {href} / {label!r}")
    if "https://www.pthhs.net" in text or "http://pthhs.net" in text:
        errors.append(f"alternate canonical host remains: {relative}")

firebase = json.loads((ROOT / "firebase.json").read_text())
redirects = {row.get("source"): row for row in firebase["hosting"].get("redirects", [])}
expected_aliases = {
    "/home-care-friendswood-texas": "/home-care-areas-we-serve",
    "/home-care-katy-texas": "/locations/katy",
}
for source, destination in expected_aliases.items():
    row = redirects.get(source)
    if not row or row.get("destination") != destination or row.get("type") != 301:
        errors.append(f"canonical location redirect missing: {source}")

sitemap = (PUBLIC / "sitemap.xml").read_text()
robots = (PUBLIC / "robots.txt").read_text()
if "https://pthhs.net/" not in sitemap or "https://www.pthhs.net" in sitemap:
    errors.append("sitemap canonical host is inconsistent")
if "Sitemap: https://pthhs.net/sitemap.xml" not in robots:
    errors.append("robots sitemap host is inconsistent")

for required in ["public/assets/components.css", "PTHHS_SITE_SHELL_REGISTER.md"]:
    if not (ROOT / required).exists(): errors.append(f"missing Batch B3 artifact: {required}")

plan = (ROOT / "plan.md").read_text()
for item in (19, 28, 29, 30, 31, 32, 34, 85):
    if not re.search(rf"- \[x\] \*\*{item}\. ", plan):
        errors.append(f"completed plan item is not checked: {item}")

if errors:
    print("BATCH_B3_QA: FAIL")
    for error in errors: print("-", error)
    raise SystemExit(1)

print(f"BATCH_B3_QA: PASS ({len(marketing_pages)} marketing HTML files share one shell; zero legacy runtimes)")
