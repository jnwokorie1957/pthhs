#!/usr/bin/env python3
"""Release checks for the P1 metadata, schema, sitemap, and URL foundation."""

from __future__ import annotations

import html
import json
import re
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit
from xml.etree import ElementTree

from site_scope import marketing_html_files

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
HOST = "https://pthhs.net"
errors: list[str] = []


class LinkAudit(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.hrefs: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag != "a":
            return
        attr = {key: value or "" for key, value in attrs}
        if attr.get("href"):
            self.hrefs.append(attr["href"])


def route_for(path: Path) -> str:
    relative = path.relative_to(PUBLIC).as_posix()
    if relative == "index.html":
        return "/"
    if relative.endswith("/index.html"):
        return "/" + relative.removesuffix("/index.html")
    return "/" + relative.removesuffix(".html")


def match_value(text: str, pattern: str) -> str:
    match = re.search(pattern, text, re.I | re.S)
    return html.unescape(re.sub(r"\s+", " ", match.group(1)).strip()) if match else ""


def noindex(text: str) -> bool:
    return bool(re.search(r'<meta\s+name=["\']robots["\'][^>]*content=["\'][^"\']*noindex', text, re.I))


firebase = json.loads((ROOT / "firebase.json").read_text())
redirect_rows = firebase["hosting"].get("redirects", [])
redirects = {row.get("source"): row for row in redirect_rows if row.get("type") == 301}

titles: dict[str, list[str]] = {}
descriptions: dict[str, list[str]] = {}
indexable_routes: set[str] = set()
schema_count = 0
anchor_count = 0

for path in marketing_html_files(PUBLIC):
    relative = path.relative_to(PUBLIC).as_posix()
    route = route_for(path)
    text = path.read_text(errors="ignore")
    if re.search(r'<meta\s+name=["\']keywords["\']', text, re.I):
        errors.append(f"meta keywords remains: {relative}")
    for unsafe in ("specialized medical attention",):
        if unsafe.lower() in text.lower():
            errors.append(f"unsupported claim remains in {relative}: {unsafe}")

    expected = f"{HOST}{'/' if route == '/' else route}"
    canonical = match_value(text, r'<link\s+rel=["\']canonical["\'][^>]*href=["\']([^"\']+)')
    if canonical != expected:
        errors.append(f"canonical mismatch: {relative} ({canonical!r})")

    schemas = re.findall(
        r'<script\b[^>]*type=["\']application/ld\+json["\'][^>]*>([\s\S]*?)</script>',
        text,
        re.I,
    )
    if noindex(text):
        if schemas:
            errors.append(f"noindex page exposes structured data: {relative}")
    else:
        indexable_routes.add(route)
        title = match_value(text, r"<title>(.*?)</title>")
        description = match_value(
            text,
            r'<meta\s+name=["\']description["\'][^>]*content=["\']([^"\']*)',
        )
        if not title or not description:
            errors.append(f"missing indexable metadata: {relative}")
        titles.setdefault(title, []).append(route)
        descriptions.setdefault(description, []).append(route)
        if len(schemas) != 1:
            errors.append(f"expected one JSON-LD block: {relative}")
        else:
            try:
                payload = json.loads(schemas[0])
                graph = payload.get("@graph", [])
                types = {node.get("@type") for node in graph}
                required_types = {"Organization", "WebSite", "WebPage"}
                allowed_types = required_types | {"Service", "BreadcrumbList"}
                if not required_types.issubset(types) or types - allowed_types:
                    errors.append(f"unexpected schema types: {relative} ({sorted(types)})")
                organization = next((node for node in graph if node.get("@type") == "Organization"), {})
                allowed = {"@type", "@id", "name", "url", "telephone", "email", "address"}
                if set(organization) - allowed:
                    errors.append(f"unapproved organization schema fields: {relative}")
                webpage = next((node for node in graph if node.get("@type") == "WebPage"), {})
                if webpage.get("url") != canonical or webpage.get("name") != title:
                    errors.append(f"WebPage schema disagrees with metadata: {relative}")
                if any("www.pthhs.net" in json.dumps(node) or "http://pthhs.net" in json.dumps(node) for node in graph):
                    errors.append(f"schema uses alternate host: {relative}")
                schema_count += 1
            except (json.JSONDecodeError, StopIteration) as error:
                errors.append(f"invalid JSON-LD in {relative}: {error}")

    parser = LinkAudit()
    parser.feed(text)
    anchor_count += len(parser.hrefs)
    for href in parser.hrefs:
        if href.startswith(("#", "mailto:", "tel:")):
            continue
        parsed = urlsplit(href)
        if parsed.scheme in {"http", "https"}:
            if parsed.netloc in {"pthhs.net", "www.pthhs.net"}:
                errors.append(f"absolute internal anchor in {relative}: {href}")
            continue
        clean_path = parsed.path
        if clean_path.endswith(".html") or clean_path.startswith(("./", "../")):
            errors.append(f"noncanonical internal anchor in {relative}: {href}")
        if clean_path in redirects:
            errors.append(f"anchor points through redirect in {relative}: {href}")

for value, routes in titles.items():
    if len(routes) > 1:
        errors.append(f"duplicate indexable title {value!r}: {', '.join(routes)}")
for value, routes in descriptions.items():
    if len(routes) > 1:
        errors.append(f"duplicate indexable description {value!r}: {', '.join(routes)}")

try:
    sitemap_root = ElementTree.parse(PUBLIC / "sitemap.xml").getroot()
    sitemap_rows = sitemap_root.findall("{http://www.sitemaps.org/schemas/sitemap/0.9}url")
    sitemap_urls = [node.findtext("{http://www.sitemaps.org/schemas/sitemap/0.9}loc") or "" for node in sitemap_rows]
    sitemap_lastmods = [node.findtext("{http://www.sitemaps.org/schemas/sitemap/0.9}lastmod") or "" for node in sitemap_rows]
except (ElementTree.ParseError, OSError) as error:
    errors.append(f"invalid sitemap.xml: {error}")
    sitemap_urls = []
    sitemap_lastmods = []

if len(sitemap_urls) != len(set(sitemap_urls)):
    errors.append("sitemap contains duplicate URLs")
for url in sitemap_urls:
    parsed = urlsplit(url)
    route = parsed.path or "/"
    if parsed.scheme != "https" or parsed.netloc != "pthhs.net":
        errors.append(f"sitemap uses noncanonical host: {url}")
    if route not in indexable_routes:
        errors.append(f"sitemap route is not indexable: {route}")
    if route in redirects:
        errors.append(f"sitemap route redirects: {route}")
if set(urlsplit(url).path or "/" for url in sitemap_urls) != indexable_routes:
    errors.append("sitemap does not exactly match the indexable route inventory")
for value in sitemap_lastmods:
    if not re.fullmatch(r"20\d{2}-\d{2}-\d{2}", value):
        errors.append(f"invalid or missing sitemap lastmod: {value!r}")

for source, row in redirects.items():
    if any(token in source for token in ("*", ":")) or source.endswith(".html"):
        continue
    html_source = f"{source}.html"
    twin = redirects.get(html_source)
    if not twin or twin.get("destination") != row.get("destination"):
        errors.append(f"missing explicit .html redirect twin: {source}")

for required in (
    "/locations/houston-texas",
    "/houston-home-care",
    "/home-care-houston",
    "/pasadena-home-care",
    "/baytown-home-care",
    "/cypress-home-care",
):
    if required not in redirects:
        errors.append(f"documented legacy redirect missing: {required}")

plan = (ROOT / "plan.md").read_text()
for item in (53, 54, 56, 57, 60, 62, 63):
    if not re.search(rf"- \[x\] \*\*{item}\. ", plan):
        errors.append(f"completed plan item is not checked: {item}")

if errors:
    print("BATCH_B4_QA: FAIL")
    for error in errors:
        print("-", error)
    raise SystemExit(1)

print(
    f"BATCH_B4_QA: PASS ({len(indexable_routes)} unique metadata/schema pages; "
    f"{len(sitemap_urls)} sitemap URLs; {len(redirects)} permanent redirects; "
    f"{anchor_count} canonical anchor checks)"
)
