#!/usr/bin/env python3
"""Build PTHHS metadata, verified schema, sitemap, and redirect controls."""

from __future__ import annotations

import html
import json
import re
import subprocess
from datetime import datetime
from zoneinfo import ZoneInfo
from pathlib import Path

from site_scope import marketing_html_files
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
HOST = "https://pthhs.net"

# Additional historical paths documented in the repository's redirect map.
DOCUMENTED_LEGACY_REDIRECTS = {
    "/locations/houston-texas": "/locations/houston",
    "/houston-home-care": "/locations/houston",
    "/home-care-houston": "/locations/houston",
    "/pasadena-home-care": "/locations/pasadena",
    "/baytown-home-care": "/locations/baytown",
    "/cypress-home-care": "/locations/cypress",
}

SERVICE_SCHEMA_TYPES = {
    "/home-care-services": "Non-medical personal assistance services",
    "/home-care-services/activities-of-daily-living-adl": "Activities of daily living assistance",
    "/home-care-services/attendant-care-services": "Attendant care services",
    "/home-care-services/personal-care": "Personal care assistance",
    "/home-care-services/respite-care": "Respite care",
}


def route_for(path: Path) -> str:
    relative = path.relative_to(PUBLIC).as_posix()
    if relative == "index.html":
        return "/"
    if relative.endswith("/index.html"):
        return "/" + relative.removesuffix("/index.html")
    return "/" + relative.removesuffix(".html")


def file_for_route(route: str) -> Path:
    if route == "/":
        return PUBLIC / "index.html"
    flat = PUBLIC / f"{route.lstrip('/')}".replace("//", "/")
    html_file = flat.with_suffix(".html")
    index_file = flat / "index.html"
    if html_file.exists():
        return html_file
    if index_file.exists():
        return index_file
    raise FileNotFoundError(f"no HTML page for sitemap route {route}")


def head_value(text: str, pattern: str, label: str, path: Path) -> str:
    match = re.search(pattern, text, re.I | re.S)
    if not match:
        raise RuntimeError(f"missing {label}: {path.relative_to(ROOT)}")
    return html.unescape(re.sub(r"\s+", " ", match.group(1)).strip())


def is_noindex(text: str) -> bool:
    return bool(
        re.search(
            r'<meta\s+name=["\']robots["\'][^>]*content=["\'][^"\']*noindex',
            text,
            re.I,
        )
    )


def breadcrumb_items(route: str, text: str) -> list[tuple[str, str]]:
    if route.startswith("/home-care-services/"):
        current = head_value(text, r"<h1[^>]*>(.*?)</h1>", "H1", file_for_route(route))
        return [("Home", "/"), ("Services", "/home-care-services"), (current, route)]
    if route.startswith("/locations/"):
        current = route.rsplit("/", 1)[-1].replace("-", " ").title()
        return [("Home", "/"), ("Areas We Serve", "/home-care-areas-we-serve"), (current, route)]
    if route == "/home-care-blog":
        return [("Home", "/"), ("Home Care Information", route)]
    return []


def absolute_url(route: str) -> str:
    return f"{HOST}{'/' if route == '/' else route}"


def render_breadcrumb(items: list[tuple[str, str]]) -> str:
    rows = []
    for position, (name, route) in enumerate(items, start=1):
        escaped_name = html.escape(name)
        if position == len(items):
            rows.append(f'<li aria-current="page">{escaped_name}</li>')
        else:
            rows.append(f'<li><a href="{html.escape(route)}">{escaped_name}</a></li>')
    return '<nav class="breadcrumb" aria-label="Breadcrumb"><ol>' + "".join(rows) + "</ol></nav>"


def normalize_visible_breadcrumb(text: str, items: list[tuple[str, str]], path: Path) -> str:
    if not items:
        return text
    rendered = render_breadcrumb(items)
    pattern = r'<nav\s+class=["\']breadcrumb["\'][^>]*>[\s\S]*?</nav>'
    if re.search(pattern, text, re.I):
        return re.sub(pattern, rendered, text, count=1, flags=re.I)
    updated, count = re.subn(
        r'(<section\s+class=["\']page-hero["\'][^>]*>\s*<div\s+class=["\']shell["\']>)',
        rf"\1{rendered}",
        text,
        count=1,
        flags=re.I,
    )
    if count != 1:
        raise RuntimeError(f"unable to insert breadcrumb: {path.relative_to(ROOT)}")
    return updated


def verified_schema(
    canonical: str,
    title: str,
    description: str,
    facts: dict,
    service_type: str | None,
    service_name: str | None,
    breadcrumbs: list[tuple[str, str]],
) -> dict:
    organization_id = f"{HOST}/#organization"
    website_id = f"{HOST}/#website"
    address = facts["address"]
    webpage = {
        "@type": "WebPage",
        "@id": f"{canonical}#webpage",
        "url": canonical,
        "name": title,
        "description": description,
        "isPartOf": {"@id": website_id},
        "about": {"@id": organization_id},
    }
    graph = [
            {
                "@type": "Organization",
                "@id": organization_id,
                "name": facts["business_name"],
                "url": f"{HOST}/",
                "telephone": facts["phone_e164"],
                "email": facts["public_email"],
                "address": {
                    "@type": "PostalAddress",
                    "streetAddress": address["street"],
                    "addressLocality": address["city"],
                    "addressRegion": address["state"],
                    "postalCode": address["postal_code"],
                    "addressCountry": address["country"],
                },
            },
            {
                "@type": "WebSite",
                "@id": website_id,
                "url": f"{HOST}/",
                "name": facts["business_name"],
                "publisher": {"@id": organization_id},
            },
            webpage,
    ]
    if service_type:
        service_id = f"{canonical}#service"
        graph.append(
            {
                "@type": "Service",
                "@id": service_id,
                "name": service_name,
                "description": description,
                "url": canonical,
                "serviceType": service_type,
                "provider": {"@id": organization_id},
            }
        )
        webpage["mainEntity"] = {"@id": service_id}
    if breadcrumbs:
        breadcrumb_id = f"{canonical}#breadcrumb"
        breadcrumb_rows = []
        for position, (name, route) in enumerate(breadcrumbs, start=1):
            row = {"@type": "ListItem", "position": position, "name": name}
            if position < len(breadcrumbs):
                row["item"] = absolute_url(route)
            breadcrumb_rows.append(row)
        graph.append(
            {
                "@type": "BreadcrumbList",
                "@id": breadcrumb_id,
                "itemListElement": breadcrumb_rows,
            }
        )
        webpage["breadcrumb"] = {"@id": breadcrumb_id}
    return {"@context": "https://schema.org", "@graph": graph}


def process_html(path: Path, facts: dict) -> tuple[str, bool]:
    text = path.read_text(errors="strict")
    text = re.sub(r'<meta\s+name=["\']keywords["\'][^>]*>', "", text, flags=re.I)
    text = re.sub(
        r'<script\b[^>]*type=["\']application/ld\+json["\'][^>]*>[\s\S]*?</script>',
        "",
        text,
        flags=re.I,
    )

    route = route_for(path)
    canonical = head_value(
        text,
        r'<link\s+rel=["\']canonical["\'][^>]*href=["\']([^"\']+)',
        "canonical",
        path,
    )
    expected = f"{HOST}{'/' if route == '/' else route}"
    if canonical != expected:
        raise RuntimeError(f"canonical mismatch: {path.relative_to(ROOT)} ({canonical} != {expected})")

    noindex = is_noindex(text)
    if not noindex:
        title = head_value(text, r"<title>(.*?)</title>", "title", path)
        description = head_value(
            text,
            r'<meta\s+name=["\']description["\'][^>]*content=["\']([^"\']*)',
            "description",
            path,
        )
        breadcrumbs = breadcrumb_items(route, text)
        text = normalize_visible_breadcrumb(text, breadcrumbs, path)
        service_type = SERVICE_SCHEMA_TYPES.get(route)
        service_name = (
            head_value(text, r"<h1[^>]*>(.*?)</h1>", "H1", path)
            if service_type
            else None
        )
        payload = json.dumps(
            verified_schema(
                canonical,
                title,
                description,
                facts,
                service_type,
                service_name,
                breadcrumbs,
            ),
            ensure_ascii=False,
            separators=(",", ":"),
        )
        text = re.sub(
            r"</head>",
            f'<script type="application/ld+json">{payload}</script></head>',
            text,
            count=1,
            flags=re.I,
        )

    text = "\n".join(line.rstrip() for line in text.splitlines()) + "\n"
    path.write_text(text)
    return route, not noindex


def reliable_lastmod(path: Path) -> str:
    relative = path.relative_to(ROOT).as_posix()
    dirty = subprocess.run(
        ["git", "status", "--porcelain", "--", relative],
        cwd=ROOT,
        check=True,
        text=True,
        capture_output=True,
    ).stdout.strip()
    if dirty:
        return datetime.now(ZoneInfo("America/Chicago")).date().isoformat()
    committed = subprocess.run(
        ["git", "log", "-1", "--format=%cs", "--", relative],
        cwd=ROOT,
        check=True,
        text=True,
        capture_output=True,
    ).stdout.strip()
    if committed:
        return committed
    return subprocess.run(
        ["git", "show", "-s", "--format=%cs", "HEAD"],
        cwd=ROOT,
        check=True,
        text=True,
        capture_output=True,
    ).stdout.strip()


def generate_sitemap(indexable: set[str]) -> None:
    rows = []
    for route in sorted(indexable, key=lambda value: (value != "/", value)):
        path = file_for_route(route)
        text = path.read_text(errors="strict")
        if route not in indexable or is_noindex(text):
            raise RuntimeError(f"sitemap route is not indexable: {route}")
        canonical = head_value(
            text,
            r'<link\s+rel=["\']canonical["\'][^>]*href=["\']([^"\']+)',
            "canonical",
            path,
        )
        expected = f"{HOST}{'/' if route == '/' else route}"
        if canonical != expected:
            raise RuntimeError(f"sitemap canonical mismatch: {route}")
        rows.append(
            f"  <url><loc>{html.escape(canonical)}</loc>"
            f"<lastmod>{reliable_lastmod(path)}</lastmod></url>"
        )
    sitemap = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "\n".join(rows)
        + "\n</urlset>\n"
    )
    (PUBLIC / "sitemap.xml").write_text(sitemap)


def generate_robots() -> None:
    (PUBLIC / "robots.txt").write_text(
        "User-agent: *\nAllow: /\n\nSitemap: https://pthhs.net/sitemap.xml\n"
    )


def expand_redirects() -> int:
    config_path = ROOT / "firebase.json"
    config = json.loads(config_path.read_text())
    redirects = config["hosting"].setdefault("redirects", [])
    known = {row.get("source"): row for row in redirects}

    for source, destination in DOCUMENTED_LEGACY_REDIRECTS.items():
        if source not in known:
            row = {"source": source, "destination": destination, "type": 301}
            redirects.append(row)
            known[source] = row

    permanent = [row for row in redirects if row.get("type") == 301]
    additions = []
    for row in permanent:
        source = row["source"]
        if any(token in source for token in ("*", ":")) or source.endswith(".html"):
            continue
        html_source = f"{source}.html"
        if html_source not in known:
            additions.append(
                {"source": html_source, "destination": row["destination"], "type": 301}
            )
            known[html_source] = additions[-1]
    redirects.extend(additions)
    config_path.write_text(json.dumps(config, indent=2) + "\n")
    return len(additions)


def main() -> None:
    facts = json.loads((ROOT / "PTHHS_PUBLIC_FACTS.json").read_text())
    if facts.get("canonical_host") != HOST:
        raise RuntimeError("verified public facts do not match the canonical host")
    results = [process_html(path, facts) for path in marketing_html_files(PUBLIC)]
    indexable = {route for route, can_index in results if can_index and route != "/404"}
    generate_sitemap(indexable)
    generate_robots()
    html_redirects = expand_redirects()
    print(
        f"SEO foundation generated for {len(results)} pages "
        f"({len(indexable)} indexable schemas and sitemap URLs, "
        f"{html_redirects} explicit .html redirects added)."
    )


if __name__ == "__main__":
    main()
