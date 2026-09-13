#!/usr/bin/env python3
"""Verify substantial, bounded, locally distinct location content."""

from __future__ import annotations

import re
from html.parser import HTMLParser
from pathlib import Path

from location_content_quality import LOCATION_GROUPS

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
LOCATIONS = PUBLIC / "locations"
errors: list[str] = []


class TextParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.in_main = False
        self.text: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag == "main":
            self.in_main = True

    def handle_endtag(self, tag: str) -> None:
        if tag == "main":
            self.in_main = False

    def handle_data(self, data: str) -> None:
        if self.in_main:
            self.text.append(data)


files = sorted(LOCATIONS.glob("*.html"))
profiled = {slug for slugs in LOCATION_GROUPS.values() for slug in slugs}
actual = {path.stem for path in files}
relationship_profiles: dict[tuple[str, ...], list[str]] = {}
if actual != profiled:
    errors.append(f"profile inventory differs from location routes: missing={sorted(actual-profiled)} extra={sorted(profiled-actual)}")

for path in files:
    text = path.read_text(errors="strict")
    relative = path.relative_to(ROOT)
    parser = TextParser()
    parser.feed(text)
    words = re.findall(r"[A-Za-z0-9’'+-]+", " ".join(parser.text))
    if len(words) < 360:
        errors.append(f"thin location main content ({len(words)} words): {relative}")
    if text.count("<!-- local-context:start -->") != 1 or text.count("<!-- local-context:end -->") != 1:
        errors.append(f"local context module count invalid: {relative}")
    if f'data-location-profile="{path.stem}"' not in text:
        errors.append(f"location profile identity missing: {relative}")
    module_match = re.search(r"<!-- local-context:start -->([\s\S]*?)<!-- local-context:end -->", text)
    module = module_match.group(1) if module_match else ""
    links = re.findall(r'href="(/locations/[^"#?]+)"', module)
    relationship_profiles.setdefault(tuple(links), []).append(path.stem)
    if len(set(links)) < 4:
        errors.append(f"fewer than four distinct related location links: {relative}")
    for link in links:
        target = PUBLIC / f"{link.lstrip('/')}.html"
        if not target.exists():
            errors.append(f"missing related location target {link}: {relative}")
    required = (
        "non-medical personal assistance",
        "exact ZIP code",
        "payer participation",
        "authorization",
        "caregiver availability",
        "/home-care-contact-us",
        "tel:7139777721",
    )
    lowered = module.lower()
    for value in required:
        if value.lower() not in lowered:
            errors.append(f"required local qualification missing ({value}): {relative}")

for routes in relationship_profiles.values():
    if len(routes) > 1:
        errors.append(f"duplicate related-location profile: {routes}")

plan = (ROOT / "plan.md").read_text(errors="strict")
if not re.search(r"- \[x\] \*\*97\. ", plan):
    errors.append("plan.md item 97 is not marked complete")

if errors:
    print(f"LOCATION_CONTENT_QA: FAIL ({len(errors)})")
    for error in errors:
        print(f"- {error}")
    raise SystemExit(1)

print(f"LOCATION_CONTENT_QA: PASS ({len(files)} location pages; minimum 360 main-content words; complete profile inventory)")
