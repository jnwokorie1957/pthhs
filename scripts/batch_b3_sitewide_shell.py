#!/usr/bin/env python3
"""Retire final legacy aliases and normalize every HTML file to one site shell."""

from __future__ import annotations

import re
from pathlib import Path

from site_scope import marketing_html_files

from pthhs_shell import (
    footer_markup,
    header_markup,
    mobile_bar_markup,
    render_page,
    section,
    skip_link_markup,
)

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"

ALIASES = {
    "home-care-baytown-texas": "/locations/baytown",
    "home-care-conroe-texas": "/locations/conroe",
    "home-care-cypress-texas": "/locations/cypress",
    "home-care-friendswood-texas": "/home-care-areas-we-serve",
    "home-care-houston-texas": "/locations/houston",
    "home-care-katy-texas": "/locations/katy",
    "home-care-league-city-texas": "/locations/league-city",
    "home-care-missouri-city-texas": "/locations/missouri-city",
    "home-care-pasadena-texas": "/locations/pasadena",
    "home-care-pearland-texas": "/locations/pearland",
    "home-care-spring-texas": "/locations/spring",
    "home-care-sugar-land-texas": "/locations/sugar-land",
}


def alias_page(slug: str, destination: str) -> str:
    body = section(
        f'''<div class="content-wrap"><h2>Use the current location directory</h2><p>This former location URL is retired. Service availability depends on the current service area, program, authorization, and caregiver availability.</p><p><a class="btn-secondary" href="{destination}">Continue to current location information</a></p></div>'''
    )
    return render_page(
        title="Location Page Moved | Primetime Home Health",
        description="This former Primetime location URL redirects to current service-area information.",
        path=f"/{slug}",
        eyebrow="Retired Location URL",
        heading="This location page has moved",
        lead="Use the current directory and contact Primetime to confirm individual service availability.",
        body=body,
        robots="noindex,nofollow",
    )


for slug, destination in ALIASES.items():
    (PUBLIC / f"{slug}.html").write_text(alias_page(slug, destination))


def route_for(path: Path) -> str:
    rel = path.relative_to(PUBLIC).as_posix()
    if rel == "index.html":
        return "/"
    if rel.endswith("/index.html"):
        return "/" + rel.removesuffix("/index.html")
    return "/" + rel.removesuffix(".html")


def current_section(route: str) -> str | None:
    if route.startswith("/home-care-about") or route.startswith("/home-care-meet"):
        return "About"
    if "service" in route or route == "/home-health-agency-in-houston-texas":
        return "Services"
    if route.startswith("/locations/") or "areas-we-serve" in route or route in {f"/{x}" for x in ALIASES}:
        return "Areas"
    if "insurance" in route:
        return "Insurance & Eligibility"
    if "resource" in route or "blog" in route:
        return "Resources"
    if "career" in route:
        return "Careers"
    if "contact" in route or "appointment" in route:
        return "Get Started"
    return None


def add_body_classes(match: re.Match[str]) -> str:
    tag = match.group(0)
    class_match = re.search(r'class=["\']([^"\']*)["\']', tag, re.I)
    classes = class_match.group(1).split() if class_match else []
    for required in ("modern-page", "template-refresh"):
        if required not in classes:
            classes.append(required)
    value = " ".join(classes)
    if class_match:
        return tag[: class_match.start()] + f'class="{value}"' + tag[class_match.end() :]
    return tag[:-1] + f' class="{value}">'


def normalize_actions(text: str) -> str:
    def action(match: re.Match[str]) -> str:
        attrs, content = match.group(1), match.group(2)
        class_match = re.search(r'class=["\']([^"\']*)["\']', attrs, re.I)
        href_match = re.search(r'href=["\']([^"\']+)["\']', attrs, re.I)
        if not class_match or not href_match:
            return match.group(0)
        classes, href = class_match.group(1), href_match.group(1)
        if "btn-primary" in classes:
            if href == "/home-care-contact-us":
                content = "Get Started"
            else:
                classes = re.sub(r"\bbtn-primary\b", "btn-secondary", classes)
                attrs = attrs[: class_match.start(1)] + classes + attrs[class_match.end(1) :]
        if href == "tel:7139777721" and ("btn-primary" in classes or "btn-secondary" in classes):
            content = "Call 713-977-7721"
        return f"<a{attrs}>{content}</a>"

    return re.sub(r"<a\b([^>]*)>(.*?)</a>", action, text, flags=re.I | re.S)


marketing_pages = marketing_html_files(PUBLIC)
for path in marketing_pages:
    text = path.read_text(errors="ignore")
    route = route_for(path)
    text = normalize_actions(text)
    text = re.sub(r'<a\b[^>]*class=["\'][^"\']*skip-link[^"\']*["\'][^>]*>.*?</a>', "", text, flags=re.I | re.S)
    text = re.sub(r'<div\b[^>]*class=["\'][^"\']*mobile-care-bar[^"\']*["\'][^>]*>.*?</div>', "", text, flags=re.I | re.S)
    text, header_count = re.subn(r"<header\b[^>]*>.*?</header>", header_markup(current_section(route)), text, count=1, flags=re.I | re.S)
    text, footer_count = re.subn(r"<footer\b[^>]*>.*?</footer>", footer_markup() + mobile_bar_markup(), text, count=1, flags=re.I | re.S)
    if header_count != 1 or footer_count != 1:
        raise RuntimeError(f"expected one header and footer in {path.relative_to(ROOT)}")
    text, main_count = re.subn(r"<main\b[^>]*>", '<main id="main-content" tabindex="-1">', text, count=1, flags=re.I)
    if main_count != 1:
        raise RuntimeError(f"expected one main in {path.relative_to(ROOT)}")
    text, body_count = re.subn(r"<body\b[^>]*>", add_body_classes, text, count=1, flags=re.I)
    if body_count != 1:
        raise RuntimeError(f"expected one body in {path.relative_to(ROOT)}")
    text = re.sub(r"(<body\b[^>]*>)", rf"\1{skip_link_markup()}", text, count=1, flags=re.I)
    if "/assets/components.css" not in text:
        text = re.sub(r"(<link\s+rel=[\"']stylesheet[\"']\s+href=[\"']/assets/modern\.css[\"']>)", r'\1<link rel="stylesheet" href="/assets/components.css">', text, count=1, flags=re.I)
    text = "\n".join(line.rstrip() for line in text.splitlines()) + "\n"
    path.write_text(text)

print(f"Retired {len(ALIASES)} location aliases and normalized {len(marketing_pages)} marketing HTML shells.")
