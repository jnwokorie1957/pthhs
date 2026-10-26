#!/usr/bin/env python3
"""Verify selective Service schema, breadcrumbs, 404 behavior, and robots policy."""

from __future__ import annotations

import html
import json
import re
from html.parser import HTMLParser
from pathlib import Path

from site_scope import marketing_html_files

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
HOST = "https://pthhs.net"
ERRORS: list[str] = []

SERVICE_ROUTES = {
    "/home-care-services",
    "/home-care-services/activities-of-daily-living-adl",
    "/home-care-services/attendant-care-services",
    "/home-care-services/personal-care",
    "/home-care-services/respite-care",
}


class BreadcrumbParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.in_breadcrumb = False
        self.depth = 0
        self.items: list[dict[str, str]] = []
        self.current: dict[str, str] | None = None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = {key: value or "" for key, value in attrs}
        if tag == "nav" and "breadcrumb" in values.get("class", "").split():
            self.in_breadcrumb = True
            self.depth = 1
            return
        if not self.in_breadcrumb:
            return
        if tag == "nav":
            self.depth += 1
        if tag == "li":
            self.current = {"name": "", "href": "", "current": values.get("aria-current", "")}
        elif tag == "a" and self.current is not None:
            self.current["href"] = values.get("href", "")

    def handle_data(self, data: str) -> None:
        if self.in_breadcrumb and self.current is not None:
            self.current["name"] += data

    def handle_endtag(self, tag: str) -> None:
        if not self.in_breadcrumb:
            return
        if tag == "li" and self.current is not None:
            self.current["name"] = " ".join(self.current["name"].split())
            self.items.append(self.current)
            self.current = None
        if tag == "nav":
            self.depth -= 1
            if self.depth == 0:
                self.in_breadcrumb = False


def route_for(path: Path) -> str:
    relative = path.relative_to(PUBLIC).as_posix()
    if relative == "index.html":
        return "/"
    if relative.endswith("/index.html"):
        return "/" + relative.removesuffix("/index.html")
    return "/" + relative.removesuffix(".html")


def is_noindex(text: str) -> bool:
    return bool(re.search(r'<meta\s+name=["\']robots["\'][^>]*content=["\'][^"\']*noindex', text, re.I))


def target_breadcrumb_route(route: str) -> bool:
    return route.startswith("/locations/") or route.startswith("/home-care-services/") or route == "/home-care-blog"


service_count = 0
breadcrumb_count = 0
for path in marketing_html_files(PUBLIC):
    relative = path.relative_to(PUBLIC).as_posix()
    route = route_for(path)
    text = path.read_text(errors="strict")
    footer = re.search(r"<footer\b[^>]*>(.*?)</footer>", text, re.I | re.S)
    legal = re.search(r'<nav\b[^>]*aria-label="Legal"[^>]*>(.*?)</nav>', footer.group(1), re.I | re.S) if footer else None
    if not legal or any(f'href="{target}"' not in legal.group(1) for target in ("/privacy-policy", "/terms-of-use")):
        ERRORS.append(f"missing public footer policy navigation: {relative}")
    blocks = re.findall(r'<script\b[^>]*type=["\']application/ld\+json["\'][^>]*>([\s\S]*?)</script>', text, re.I)
    graphs = []
    for block in blocks:
        try:
            graphs.extend(json.loads(block).get("@graph", []))
        except (json.JSONDecodeError, AttributeError) as error:
            ERRORS.append(f"invalid schema in {relative}: {error}")

    services = [node for node in graphs if node.get("@type") == "Service"]
    breadcrumbs = [node for node in graphs if node.get("@type") == "BreadcrumbList"]
    if route in SERVICE_ROUTES:
        if len(services) != 1:
            ERRORS.append(f"expected one Service node on {route}; found {len(services)}")
        else:
            service_count += 1
            node = services[0]
            allowed = {"@type", "@id", "name", "description", "url", "serviceType", "provider"}
            if set(node) - allowed:
                ERRORS.append(f"unapproved Service fields on {route}: {sorted(set(node) - allowed)}")
            if node.get("url") != f"{HOST}{route}" or node.get("provider") != {"@id": f"{HOST}/#organization"}:
                ERRORS.append(f"Service identity/provider mismatch on {route}")
            h1_match = re.search(r"<h1[^>]*>(.*?)</h1>", text, re.I | re.S)
            description_match = re.search(
                r'<meta\s+name=["\']description["\']\s+content=["\']([^"\']+)',
                text,
                re.I,
            )
            visible_name = html.unescape(re.sub(r"<[^>]+>", "", h1_match.group(1))).strip() if h1_match else ""
            visible_description = html.unescape(description_match.group(1)).strip() if description_match else ""
            if node.get("name") != visible_name or node.get("description") != visible_description:
                ERRORS.append(f"Service name/description is not grounded in visible page metadata on {route}")
            serialized = json.dumps(node).lower()
            for prohibited in ("areaServed", "offers", "review", "aggregateRating", "award", "credential"):
                if prohibited.lower() in serialized:
                    ERRORS.append(f"prohibited Service claim field on {route}: {prohibited}")
    elif services:
        ERRORS.append(f"Service schema outside allowlist: {route}")

    wants_breadcrumb = not is_noindex(text) and target_breadcrumb_route(route)
    parser = BreadcrumbParser()
    parser.feed(text)
    if wants_breadcrumb:
        if len(breadcrumbs) != 1 or len(parser.items) < 2:
            ERRORS.append(f"missing structured/visible breadcrumb on {route}")
            continue
        breadcrumb_count += 1
        rows = breadcrumbs[0].get("itemListElement", [])
        if len(rows) != len(parser.items):
            ERRORS.append(f"breadcrumb length mismatch on {route}")
            continue
        for position, (row, visible) in enumerate(zip(rows, parser.items), start=1):
            if row.get("@type") != "ListItem" or row.get("position") != position:
                ERRORS.append(f"breadcrumb position/type mismatch on {route}")
            if row.get("name") != html.unescape(visible["name"]):
                ERRORS.append(f"breadcrumb label mismatch on {route}")
            if position < len(rows):
                expected = f"{HOST}{'/' if visible['href'] == '/' else visible['href']}"
                if row.get("item") != expected:
                    ERRORS.append(f"breadcrumb URL mismatch on {route} position {position}")
            elif row.get("item") is not None or visible.get("current") != "page":
                ERRORS.append(f"breadcrumb current-page mismatch on {route}")
    elif breadcrumbs:
        ERRORS.append(f"BreadcrumbList outside approved scope: {route}")

# Selected area lists must retain their approved wording and real canonical links.
contextual_lists = {
    "alief": [
        ("Attendant care and help with daily routines", None, ""),
        ("Bathing, grooming, dressing and toileting assistance", "personal-care", ""),
        ("Mobility and transfer support", None, ""),
        ("Meal-related assistance and light housekeeping tied to the care plan", None, ""),
        ("Respite support for family caregivers", "respite-care", ""),
        ("Non-medical medication reminders", "medication-reminders", " when authorized"),
    ],
    "southwest-houston": [
        ("Personal care and hygiene assistance", "personal-care", ""),
        ("Activities of Daily Living support", "activities-of-daily-living-adl", ""),
        ("Attendant care services", None, ""),
        ("Respite care", "respite-care", ""),
        ("Mobility and transfer assistance", None, ""),
        ("Medication reminders", "medication-reminders", " when authorized"),
    ],
    "sugar-land": [
        ("Attendant and personal care", None, ""),
        ("Bathing, dressing and grooming assistance", "personal-care", ""),
        ("Mobility, positioning and transfers", None, ""),
        ("Meal-related support and light housekeeping tied to the care plan", None, ""),
        ("Respite care for family caregivers", "respite-care", ""),
        ("Medication reminders", "medication-reminders", " when allowed by the authorized plan"),
    ],
}
def matches_contextual_list(text: str, expected: str) -> bool:
    return re.findall(r'<ul class="service-list">(.*?)</ul>', text, re.S) == [expected]


for area, rows in contextual_lists.items():
    text = (PUBLIC / "locations" / f"{area}.html").read_text(encoding="utf-8")
    expected = []
    for label, slug, qualifier in rows:
        if slug:
            route = f"/home-care-services/{slug}"
            target = PUBLIC / f"{route.lstrip('/')}.html"
            if not target.exists():
                target = PUBLIC / route.lstrip("/") / "index.html"
            if not target.exists() or f'<link rel="canonical" href="{HOST}{route}">' not in target.read_text(encoding="utf-8"):
                ERRORS.append(f"contextual destination is not canonical: {area}: {route}")
            label = f'<a href="{route}">{label}</a>'
        expected.append(f"<li>{label}{qualifier}</li>")
    if not matches_contextual_list(text, "".join(expected)):
        ERRORS.append(f"contextual service links or approved wording changed: {area}")

    if area == "alief":
        # Negative fixtures ensure list-local wording and destination checks cannot
        # be satisfied by an unrelated footer link or a weakened qualifier.
        anchor = '<a href="/home-care-services/medication-reminders">Non-medical medication reminders</a>'
        for invalid in (
            text.replace(anchor, "Non-medical medication reminders"),
            text.replace(anchor, anchor.replace("/medication-reminders", "/personal-care")),
            text.replace(anchor + " when authorized", anchor + " whenever requested"),
            text.replace(anchor + " when authorized", anchor.replace("</a>", " when authorized</a>")),
        ):
            if invalid == text or matches_contextual_list(invalid, "".join(expected)):
                ERRORS.append("Alief contextual navigation negative fixture was not rejected")

# Official resource links must identify their destination independently of card headings.
RESOURCE_LINKS = [
    ("https://www.hhs.texas.gov/services/health/medicaid-chip", "Texas Medicaid &amp; CHIP information"),
    ("https://www.hhs.texas.gov/services/aging/long-term-care", "Texas long-term care information"),
    ("https://www.yourtexasbenefits.com/Learn/Home", "Apply or manage Your Texas Benefits"),
    ("https://www.hhs.texas.gov/services/health/medicaid-chip/medicaid-chip-programs-services/programs-children-adults-disabilities/medicaid-elderly-people-disabilities", "Texas Medicaid for older adults and people with disabilities"),
    ("https://www.medicaid.gov/medicaid/long-term-services-supports/self-directed-services", "Medicaid.gov self-directed services"),
    ("https://www.211texas.org/", "Search 2-1-1 Texas resources"),
]
RESOURCE_ANCHORS = [
    f'<a class="card-link" href="{url}" target="_blank" rel="noopener noreferrer">{label} '
    '<span aria-hidden="true">↗</span><span class="sr-only"> (opens in a new tab)</span></a>'
    for url, label in RESOURCE_LINKS
]


def resource_links_match(text: str) -> bool:
    return re.findall(r'<a class="card-link"[^>]*>.*?</a>', text, re.S) == RESOURCE_ANCHORS


resource_page = (PUBLIC / "home-care-resources.html").read_text(encoding="utf-8")
resource_generator = (ROOT / "scripts/batch_b1_migration.py").read_text(encoding="utf-8")
if not resource_links_match(resource_page):
    ERRORS.append("official resource labels, destinations or new-tab safeguards changed")
if any(resource_generator.count(anchor) != 1 for anchor in RESOURCE_ANCHORS):
    ERRORS.append("resource generator does not preserve official link contracts")
for invalid in (
    resource_page.replace(RESOURCE_LINKS[0][1], "Open official resource"),
    resource_page.replace(RESOURCE_LINKS[0][0], RESOURCE_LINKS[1][0]),
    resource_page.replace(RESOURCE_ANCHORS[0], ""),
    resource_page.replace(RESOURCE_ANCHORS[0], RESOURCE_ANCHORS[0] * 2),
    resource_page.replace(' (opens in a new tab)', ''),
    resource_page.replace('rel="noopener noreferrer"', 'rel="nofollow"'),
    resource_page.replace('class="card-link"', 'class="card-link" aria-label="Open official resource"'),
):
    if invalid == resource_page or resource_links_match(invalid):
        ERRORS.append("official resource navigation negative fixture was not rejected")

if service_count != 5:
    ERRORS.append(f"expected 5 Service nodes; found {service_count}")
if breadcrumb_count != 71:
    ERRORS.append(f"expected 71 breadcrumb routes; found {breadcrumb_count}")

robots = (PUBLIC / "robots.txt").read_text(errors="strict")
expected_robots = "User-agent: *\nAllow: /\n\nSitemap: https://pthhs.net/sitemap.xml\n"
if robots != expected_robots:
    ERRORS.append("robots.txt does not match the canonical generated policy")
if len(re.findall(r"(?im)^sitemap:", robots)) != 1 or "www.pthhs.net" in robots or "http://pthhs.net" in robots:
    ERRORS.append("robots.txt has duplicate or alternate-host sitemap directives")

not_found = (PUBLIC / "404.html").read_text(errors="strict")
for required in ('name="robots" content="noindex,follow"', "We couldn’t find that page.", 'href="/"', 'href="/home-care-services"', 'href="/home-care-areas-we-serve"', 'href="/home-care-contact-us"'):
    if required not in not_found:
        ERRORS.append(f"404 recovery contract missing: {required}")
if "https://pthhs.net/404" in (PUBLIC / "sitemap.xml").read_text():
    ERRORS.append("404 route must not appear in sitemap")

firebase = json.loads((ROOT / "firebase.json").read_text())
if firebase.get("hosting", {}).get("public") != "public":
    ERRORS.append("Firebase public directory does not expose public/404.html")
for rewrite in firebase.get("hosting", {}).get("rewrites", []):
    if rewrite.get("source") in {"**", "/**"}:
        ERRORS.append("catch-all rewrite would prevent the custom 404 response")

plan = (ROOT / "plan.md").read_text()
for item in (58, 59, 66, 67):
    if not re.search(rf"- \[x\] \*\*{item}\. ", plan):
        ERRORS.append(f"completed plan item is not checked: {item}")
if not (ROOT / "PTHHS_STRUCTURED_NAVIGATION_REGISTER.md").exists():
    ERRORS.append("structured navigation register is missing")

if ERRORS:
    print("STRUCTURED_NAVIGATION_QA: FAIL")
    for error in ERRORS:
        print("-", error)
    raise SystemExit(1)

print(
    f"STRUCTURED_NAVIGATION_QA: PASS ({service_count} Service nodes; "
    f"{breadcrumb_count} breadcrumb routes; canonical robots; custom 404 contract)"
)
