#!/usr/bin/env python3
"""Release checks for core-route migration and retired legacy payloads."""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
errors: list[str] = []

from batch_a_config import BLOG_SLUGS

modern_routes = [
    "home-care-contact-us.html",
    "home-care-careers.html",
    "home-care-blog.html",
    "home-care-client-reviews.html",
    "home-care-services.html",
    "home-care-services/activities-of-daily-living-adl.html",
    "home-care-services/attendant-care-services/index.html",
    "home-care-services/medication-reminders.html",
    "home-care-services/personal-care.html",
    "home-care-services/respite-care/index.html",
]


def legacy_runtime(text: str) -> bool:
    tags = re.findall(r"<(?:link|script)\b[^>]*>", text, re.I)
    return any(
        re.search(r"wp-content/(?:themes|plugins|cache)|wp-includes|rocketlazyloadscript", tag, re.I)
        for tag in tags
    ) or bool(re.search(r"<!--\[if\s+(?:lt|gt|IE)", text, re.I))


for relative in modern_routes:
    text = (PUBLIC / relative).read_text(errors="ignore")
    if "modern-page" not in text:
        errors.append(f"modern shell missing: {relative}")
    if text.count("<h1") != 1:
        errors.append(f"expected one H1: {relative}")
    if legacy_runtime(text):
        errors.append(f"legacy runtime dependency remains: {relative}")
    if not re.search(r'<a[^>]+href="/home-care-contact-us"', text):
        errors.append(f"canonical Get Started route missing: {relative}")

blog = (PUBLIC / "home-care-blog.html").read_text(errors="ignore").lower()
if "no imported article is currently retained" not in blog:
    errors.append("Blog does not state the zero-retained-post decision")

reviews = (PUBLIC / "home-care-client-reviews.html").read_text(errors="ignore").lower()
for forbidden in ["comment-form", "replytocom", "leave a reply", "testimonial-text"]:
    if forbidden in reviews:
        errors.append(f"legacy review/comment UI remains: {forbidden}")

retired = BLOG_SLUGS + ["home-care-set-an-appointment"]
for slug in retired:
    text = (PUBLIC / f"{slug}.html").read_text(errors="ignore")
    if not re.search(r'<meta\s+name="robots"\s+content="noindex,nofollow">', text, re.I):
        errors.append(f"retired page is indexable: {slug}")
    if "modern-page" not in text or legacy_runtime(text):
        errors.append(f"retired fallback still contains legacy runtime: {slug}")
    if len(text.encode()) > 12_000:
        errors.append(f"retired fallback is unexpectedly heavy: {slug}")

firebase = json.loads((ROOT / "firebase.json").read_text())
redirects = {row.get("source"): row for row in firebase["hosting"].get("redirects", [])}
for slug in BLOG_SLUGS:
    row = redirects.get(f"/{slug}")
    if not row or row.get("destination") != "/home-care-blog" or row.get("type") != 301:
        errors.append(f"Blog retirement redirect missing: {slug}")
appointment = redirects.get("/home-care-set-an-appointment")
if not appointment or appointment.get("destination") != "/home-care-contact-us" or appointment.get("type") != 301:
    errors.append("appointment redirect does not enforce canonical Get Started flow")

plan = (ROOT / "plan.md").read_text()
for item in (20, 21, 24, 25, 26, 27):
    if not re.search(rf"- \[x\] \*\*{item}\. ", plan):
        errors.append(f"completed plan item is not checked: {item}")

if not (ROOT / "PTHHS_ROUTE_MIGRATION_REGISTER.md").exists():
    errors.append("route migration register missing")

if errors:
    print("BATCH_B2_QA: FAIL")
    for error in errors:
        print("-", error)
    raise SystemExit(1)

print(
    "BATCH_B2_QA: PASS "
    f"({len(modern_routes)} core routes verified; {len(retired)} legacy payloads retired)"
)
