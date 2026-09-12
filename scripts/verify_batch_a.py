#!/usr/bin/env python3
"""Fail the release when Batch A public-scope or metadata controls regress."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
HOST = "https://pthhs.net"
sys.path.insert(0, str(Path(__file__).parent))
from batch_a_config import BLOG_SLUGS  # noqa: E402
from site_scope import marketing_html_files  # noqa: E402

errors: list[str] = []

required_files = [
    "PTHHS_PUBLIC_FACTS.json",
    "PTHHS_APPROVED_TERMINOLOGY.md",
    "PTHHS_PAYER_EVIDENCE_REGISTER.md",
    "PTHHS_CLAIM_RELEASE_GATE.md",
    "PTHHS_BLOG_SCOPE_TRIAGE.md",
]
for name in required_files:
    if not (ROOT / name).exists():
        errors.append(f"missing governance file: {name}")

for forbidden in ["CRAWL-REPORT.md", "crawl-report.json", "crawl-report.json.new", "crawl.log", "legacy-index-wordpress.html"]:
    if (PUBLIC / forbidden).exists():
        errors.append(f"internal artifact remains deployable: public/{forbidden}")

marketing_pages = marketing_html_files(PUBLIC)
for path in marketing_pages:
    text = path.read_text(errors="ignore")
    rel = path.relative_to(PUBLIC).as_posix()
    if rel == "index.html":
        expected = HOST + "/"
    elif rel.endswith("/index.html"):
        expected = HOST + "/" + rel.removesuffix("/index.html")
    else:
        expected = HOST + "/" + rel.removesuffix(".html")
    canon = re.search(r'<link\s+rel=["\']canonical["\']\s+href=["\']([^"\']+)', text, re.I)
    og = re.search(r'<meta\s+property=["\']og:url["\']\s+content=["\']([^"\']+)', text, re.I)
    if not canon or canon.group(1) != expected:
        errors.append(f"bad canonical: {rel}")
    if not og or og.group(1) != expected:
        errors.append(f"bad og:url: {rel}")
    if "https://www.pthhs.net" in text or "http://pthhs.net" in text:
        errors.append(f"alternate host in metadata/content: {rel}")
    for match in re.finditer(r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>', text, re.I | re.S):
        try:
            json.loads(match.group(1))
        except json.JSONDecodeError:
            errors.append(f"invalid JSON-LD: {rel}")

high_risk_pages = [
    PUBLIC / "home-care-contact-us.html",
    PUBLIC / "home-care-services-medication-reminders.html",
    PUBLIC / "home-care-services/medication-reminders.html",
    PUBLIC / "home-health-agency-in-houston-texas.html",
    PUBLIC / "home-care-careers.html",
    PUBLIC / "home-care-client-reviews.html",
    PUBLIC / "home-care-insurance.html",
    PUBLIC / "index.html",
]
for path in high_risk_pages:
    text = path.read_text(errors="ignore").lower()
    for phrase in ["95k", "100% satisfaction", "awards win", "premier home health agency", "specialized medical attention", "common diagnosis"]:
        if phrase in text:
            errors.append(f"unsupported claim '{phrase}' in {path.relative_to(ROOT)}")

for slug in BLOG_SLUGS:
    path = PUBLIC / f"{slug}.html"
    if not path.exists():
        errors.append(f"missing quarantined route: {slug}")
    elif not re.search(r'<meta\s+name=["\']robots["\'][^>]+noindex', path.read_text(errors="ignore"), re.I):
        errors.append(f"quarantined article lacks noindex: {slug}")

firebase = json.loads((ROOT / "firebase.json").read_text())
redirects = {r.get("source"): r.get("destination") for r in firebase["hosting"].get("redirects", [])}
for slug in BLOG_SLUGS:
    if redirects.get("/" + slug) != "/home-care-blog":
        errors.append(f"missing quarantine redirect: /{slug}")

if errors:
    print("BATCH_A_QA: FAIL")
    for error in errors:
        print("-", error)
    raise SystemExit(1)

print(f"BATCH_A_QA: PASS ({len(marketing_pages)} marketing HTML files checked; {len(BLOG_SLUGS)} articles quarantined)")
