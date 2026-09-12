#!/usr/bin/env python3
"""Release checks for owner-attested content restoration and automatable C/G work."""

from __future__ import annotations

import json
import re
from pathlib import Path
from urllib.parse import urlsplit
from xml.etree import ElementTree

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
errors: list[str] = []


def read(relative: str) -> str:
    path = PUBLIC / relative
    if not path.exists():
        errors.append(f"missing public file: {relative}")
        return ""
    return path.read_text(errors="ignore")


home = read("index.html")
insurance = read("home-care-insurance.html")
reviews = read("home-care-client-reviews.html")
staff = read("home-care-meet-our-staff.html")
profile = read("home-care-meet-our-staff/johnson-nwokorie.html")
contact = read("home-care-contact-us.html")
careers = read("home-care-careers.html")
areas = read("home-care-areas-we-serve.html")
resources = read("home-care-resources.html")

logos = [
    "wellpoint.png",
    "molina.png",
    "united-healthcare.png",
    "medicaid-1.png",
    "texas-chldrn-hlth-plan.png",
    "comm-health-choice.jpg",
]
for logo in logos:
    if logo not in home or logo not in insurance:
        errors.append(f"restored plan logo missing from Home or Insurance: {logo}")
if "medication-reminders" not in home or "Hands organizing a weekly medication reminder box" not in home:
    errors.append("homepage medication-reminder image is missing")

for phrase in ("since 1999", "25+ Years Serving Houston", "Multiple Medicaid Plans", "Protective Supervision"):
    if phrase not in home:
        errors.append(f"owner-approved homepage claim missing: {phrase}")
for phrase in ("34+", "95K", "100%", "Awards earned", "Happy customers"):
    if phrase not in home:
        errors.append(f"owner-approved homepage metric missing: {phrase}")

expected_title = "Insurance &amp; Medicaid Plans | Primetime Home Health Services Houston"
if f"<title>{expected_title}</title>" not in insurance:
    errors.append("restored Insurance title metadata is missing")
if "UnitedHealthcare, Molina, Wellpoint" not in insurance:
    errors.append("restored Insurance description metadata is missing")
for section in ("Public program rules", "Plan decision", "Primetime onboarding"):
    if section not in insurance:
        errors.append(f"Medicaid explainer section missing: {section}")

for reviewer in ("Michelle Gutierrez", "Betty Flowers", "Marlin Thomas", "St. JohnPeter"):
    if reviewer not in reviews:
        errors.append(f"approved Google review missing: {reviewer}")
if "Google Business Profile" not in reviews or "<form" in reviews.lower() or "comment-form" in reviews.lower():
    errors.append("reviews source link or no-form contract failed")

for person in ("Johnson Nwokorie", "Irasema Baron", "Jeremy Nwokorie"):
    if person not in staff:
        errors.append(f"staff profile missing: {person}")
for phrase in ("500 PAS attendants", "10 office supervisors"):
    if phrase not in staff:
        errors.append(f"owner-approved staffing snapshot missing: {phrase}")
if re.search(r'<meta\s+name=["\']robots["\'][^>]*noindex', profile, re.I):
    errors.append("restored Johnson profile remains noindex")

for phrase in ("How care starts", "Monday–Friday, 9 a.m.–5 p.m.", "346-599-2755", "Call 911"):
    if phrase not in contact:
        errors.append(f"contact guidance missing: {phrase}")
for phrase in ("Accessible application process", "general-interest applications", "Applicant privacy"):
    if phrase not in careers:
        errors.append(f"career flow content missing: {phrase}")

location_routes = {f"/locations/{path.stem}" for path in (PUBLIC / "locations").glob("*.html")}
area_links = set(re.findall(r'href=["\'](/locations/[^"\']+)', areas))
if area_links != location_routes:
    errors.append(
        f"Areas inventory differs from location files: missing={sorted(location_routes-area_links)} extra={sorted(area_links-location_routes)}"
    )
if "Region 5 and Region 6" not in areas or "Liberty County" not in areas:
    errors.append("owner-approved region/county coverage is missing")

for phrase in ("Everyday personal assistance", "Caregiver support", "Texas Medicaid navigation"):
    if phrase not in resources:
        errors.append(f"public content-cluster navigation missing: {phrase}")

html_files = sorted(PUBLIC.rglob("*.html"))
for path in html_files:
    text = path.read_text(errors="ignore")
    if text.count('href="/privacy-policy"') < 1 or text.count('href="/terms-of-use"') < 1:
        errors.append(f"footer legal links missing: {path.relative_to(PUBLIC)}")

try:
    sitemap = ElementTree.parse(PUBLIC / "sitemap.xml").getroot()
    rows = sitemap.findall("{http://www.sitemaps.org/schemas/sitemap/0.9}url")
except (OSError, ElementTree.ParseError) as error:
    errors.append(f"sitemap parse failed: {error}")
    rows = []
if len(rows) != 85:
    errors.append(f"expected 85 sitemap rows, found {len(rows)}")
for row in rows:
    loc = row.findtext("{http://www.sitemaps.org/schemas/sitemap/0.9}loc") or ""
    lastmod = row.findtext("{http://www.sitemaps.org/schemas/sitemap/0.9}lastmod") or ""
    if urlsplit(loc).netloc != "pthhs.net" or not re.fullmatch(r"20\d{2}-\d{2}-\d{2}", lastmod):
        errors.append(f"invalid canonical sitemap row: {loc} / {lastmod}")

facts = json.loads((ROOT / "PTHHS_PUBLIC_FACTS.json").read_text())
if facts.get("founded") != 1999 or len(facts.get("approved_payers_and_programs", [])) != 6:
    errors.append("owner-approved fact register is incomplete")
if len(facts.get("approved_service_area", {}).get("counties", [])) != 11:
    errors.append("approved county register is incomplete")
metrics = facts.get("owner_reported_metrics", {})
if metrics.get("pas_attendants_supported") != "500+" or metrics.get("office_supervisors") != 10:
    errors.append("approved staffing snapshot is incomplete")

for artifact in (
    "PTHHS_OWNER_ATTESTATION.md",
    "PTHHS_REVIEW_SOURCE_REGISTER.md",
    "PTHHS_EDITORIAL_POLICY.md",
    "PTHHS_CONTENT_CLUSTER_MAP.md",
    "PTHHS_GBP_AUDIT.md",
    "PTHHS_GOVERNANCE_CADENCE.md",
    "PTHHS_IMPLEMENTATION_BLOCKERS.md",
):
    if not (ROOT / artifact).exists():
        errors.append(f"missing governance artifact: {artifact}")

firebase = json.loads((ROOT / "firebase.json").read_text())
headers = [item for rule in firebase["hosting"].get("headers", []) for item in rule.get("headers", [])]
if not any(item.get("key") == "Strict-Transport-Security" and "max-age=31536000" in item.get("value", "") for item in headers):
    errors.append("HSTS deployment configuration is missing")

plan = (ROOT / "plan.md").read_text()
for item in (35, 48, 49, 50, 61, 78, 98, 99, 101, 103, 104, 105, 106, 107, 110):
    if not re.search(rf"- \[x\] \*\*{item}\. ", plan):
        errors.append(f"completed plan item is not checked: {item}")

if errors:
    print("OWNER_CONTENT_QA: FAIL")
    for error in errors:
        print("-", error)
    raise SystemExit(1)

print(
    "OWNER_CONTENT_QA: PASS "
    f"({len(html_files)} pages; {len(location_routes)} location routes; {len(rows)} sitemap rows; "
    "6 plan logos; 4 sourced Google reviews; legal footer links sitewide)"
)
