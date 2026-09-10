#!/usr/bin/env python3
"""Regression checks for the staff and maintained-resources migration."""

from __future__ import annotations

import json
import re
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
errors: list[str] = []

pages = {
    "home-care-meet-our-staff.html": False,
    "home-care-meet-our-staff/johnson-nwokorie.html": True,
    "home-care-resources.html": False,
}

for relative, should_noindex in pages.items():
    path = PUBLIC / relative
    text = path.read_text(errors="ignore")
    lower = text.lower()
    if '<body class="modern-page template-refresh">' not in text:
        errors.append(f"modern shared shell missing: {relative}")
    if text.count("<h1") != 1:
        errors.append(f"expected exactly one H1: {relative}")
    if '<main id="main-content" tabindex="-1">' not in text:
        errors.append(f"named main target missing: {relative}")
    if '<a class="skip-link" href="#main-content">' not in text:
        errors.append(f"skip link missing: {relative}")
    if 'aria-label="primary navigation"' not in lower:
        errors.append(f"primary navigation label missing: {relative}")
    if any(token in lower for token in ["rocketlazyloadscript", "wp rocket", "wp-includes", "wp-content/plugins", "<!--[if"]):
        errors.append(f"legacy runtime dependency remains: {relative}")
    if "meta name=\"keywords\"" in lower:
        errors.append(f"obsolete meta keywords remain: {relative}")
    if ("noindex" in lower) != should_noindex:
        errors.append(f"unexpected robots indexing state: {relative}")
    for raw in re.findall(r'<script[^>]+type="application/ld\+json"[^>]*>(.*?)</script>', text, re.I | re.S):
        try:
            json.loads(raw)
        except json.JSONDecodeError:
            errors.append(f"invalid JSON-LD: {relative}")

staff_text = (PUBLIC / "home-care-meet-our-staff.html").read_text(errors="ignore").lower()
profile_text = (PUBLIC / "home-care-meet-our-staff/johnson-nwokorie.html").read_text(errors="ignore").lower()
for claim in ["500 pas attendants", "10 office supervisors", "bachelor", "master's", "certification", "texas southern university", "founder"]:
    if claim in staff_text or claim in profile_text:
        errors.append(f"unverified staff claim remains: {claim}")

resource_text = (PUBLIC / "home-care-resources.html").read_text(errors="ignore")
allowed_hosts = {"www.hhs.texas.gov", "www.yourtexasbenefits.com", "www.medicaid.gov", "www.211texas.org"}
external_links = re.findall(r'<a class="card-link" href="(https://[^"]+)"', resource_text)
for url in external_links:
    if urlparse(url).hostname not in allowed_hosts:
        errors.append(f"non-authoritative resource link: {url}")
if len(external_links) != 6:
    errors.append(f"expected 6 maintained resources, found {len(external_links)}")
if "Links were reviewed September 10, 2026" not in resource_text:
    errors.append("resource last-reviewed date missing")
if not (ROOT / "PTHHS_RESOURCE_LINK_REGISTER.md").exists():
    errors.append("resource link register missing")

plan = (ROOT / "plan.md").read_text()
for item in (22, 23, 102):
    if not re.search(rf"- \[x\] \*\*{item}\. ", plan):
        errors.append(f"completed plan item is not checked: {item}")

if errors:
    print("BATCH_B1_QA: FAIL")
    for error in errors:
        print("-", error)
    raise SystemExit(1)

print("BATCH_B1_QA: PASS (staff claims suppressed; 3 pages on shared shell; 6 resources governed)")
