#!/usr/bin/env python3
"""Verify the public business-identity audit and its explicit account boundary."""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
AUDIT = ROOT / "PTHHS_GBP_AUDIT.md"
errors: list[str] = []

facts = json.loads((ROOT / "PTHHS_PUBLIC_FACTS.json").read_text())
audit = AUDIT.read_text() if AUDIT.exists() else ""
plan = (ROOT / "plan.md").read_text()
home = (PUBLIC / "index.html").read_text(errors="ignore")
areas = (PUBLIC / "home-care-areas-we-serve.html").read_text(errors="ignore")

address = facts.get("address", {})
identity_values = (
    facts.get("business_name", ""),
    facts.get("phone_display", ""),
    facts.get("canonical_host", ""),
    address.get("street", ""),
    address.get("city", ""),
    address.get("state", ""),
    address.get("postal_code", ""),
)
for value in identity_values:
    if not value or value not in audit:
        errors.append(f"canonical identity value missing from public-profile audit: {value!r}")

for source in (
    "https://pthhs.net/",
    "https://careavailability.com/",
    "https://www.waze.com/",
    "https://www.newlifestyles.com/",
):
    if source not in audit:
        errors.append(f"public-profile evidence source missing: {source}")

for boundary in (
    "item 100 remains open",
    "Account check required",
    "do not select a clinical category",
):
    if boundary not in audit:
        errors.append(f"public-profile account boundary missing: {boundary}")

if not re.search(r"- \[ \] \*\*100\. .*Public audit Sep 14:", plan):
    errors.append("plan item 100 must remain open with dated public-audit progress")

if facts.get("phone_display") not in home or address.get("street") not in home:
    errors.append("homepage NAP differs from the canonical fact register")

counties = facts.get("approved_service_area", {}).get("counties", [])
if len(counties) != 11:
    errors.append(f"expected 11 approved service-area counties, found {len(counties)}")
for county in counties:
    if f"{county} County" not in areas:
        errors.append(f"approved county missing from Areas source of truth: {county}")
    if county not in audit:
        errors.append(f"approved county missing from account reconciliation list: {county}")

if errors:
    print("PUBLIC_PROFILE_AUDIT_QA: FAIL")
    for error in errors:
        print("-", error)
    raise SystemExit(1)

print(
    "PUBLIC_PROFILE_AUDIT_QA: PASS "
    "(4 evidence surfaces; 11 service-area counties; account-only fields explicitly blocked)"
)
