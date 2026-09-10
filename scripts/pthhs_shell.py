"""Reusable HTML shell for verified PTHHS static pages."""

from __future__ import annotations

import html
import json

HOST = "https://pthhs.net"


def render_page(
    *,
    title: str,
    description: str,
    path: str,
    eyebrow: str,
    heading: str,
    lead: str,
    body: str,
    robots: str | None = None,
) -> str:
    canonical = f"{HOST}{path}"
    schema = {
        "@context": "https://schema.org",
        "@type": "WebPage",
        "@id": f"{canonical}#webpage",
        "url": canonical,
        "name": title,
        "description": description,
        "isPartOf": {"@id": f"{HOST}/#website"},
    }
    robots_meta = (
        f'<meta name="robots" content="{html.escape(robots, quote=True)}">'
        if robots
        else ""
    )
    escaped_title = html.escape(title)
    escaped_description = html.escape(description, quote=True)
    return f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{escaped_title}</title>
<meta name="description" content="{escaped_description}">
{robots_meta}
<link rel="canonical" href="{canonical}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Primetime Home Health Services">
<meta property="og:title" content="{html.escape(title, quote=True)}">
<meta property="og:description" content="{escaped_description}">
<meta property="og:url" content="{canonical}">
<meta property="og:image" content="{HOST}/assets/meta/og-default.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<link rel="stylesheet" href="/assets/modern.css">
<link rel="stylesheet" href="/assets/polish.css">
<link rel="stylesheet" href="/assets/section-pages.css?v=20260910">
<script type="application/ld+json">{json.dumps(schema, separators=(",", ":"))}</script>
</head>
<body class="modern-page template-refresh">
  <a class="skip-link" href="#main-content">Skip to main content</a>
  <header class="site-header">
    <div class="shell nav-wrap">
      <a class="brand" href="/" aria-label="Primetime Home Health Services home"><img src="/wp-content/themes/primetimehomeie989/images/main-logo.png" alt="Primetime Home Health Services, Inc." width="410" height="203"></a>
      <nav class="site-nav" aria-label="Primary navigation">
        <a href="/home-care-about-us">About</a>
        <a href="/home-care-services">Services</a>
        <a href="/home-care-areas-we-serve">Areas</a>
        <a href="/home-care-insurance">Insurance &amp; Eligibility</a>
        <a href="/home-care-resources">Resources</a>
        <a href="/home-care-careers">Careers</a>
        <a class="nav-cta" href="/home-care-contact-us">Get Started</a>
      </nav>
    </div>
  </header>
  <main id="main-content" tabindex="-1">
    <section class="page-hero"><div class="shell">
      <nav class="breadcrumb" aria-label="Breadcrumb"><a href="/">Home</a> / <span aria-current="page">{html.escape(heading)}</span></nav>
      <span class="eyebrow">{html.escape(eyebrow)}</span>
      <h1>{html.escape(heading)}</h1>
      <p class="section-lead">{html.escape(lead)}</p>
    </div></section>
    {body}
  </main>
  <footer class="site-footer"><div class="shell footer-grid">
    <div><a href="/" aria-label="Primetime home"><img class="footer-logo" src="/wp-content/themes/primetimehomeie989/images/footer-logo.png" alt="Primetime Home Health Services" width="410" height="203" loading="lazy"></a><p>Non-medical personal assistance services for eligible children, adults, and seniors throughout Greater Houston.</p></div>
    <div><h2>Explore</h2><ul><li><a href="/home-care-about-us">About</a></li><li><a href="/home-care-services">Services</a></li><li><a href="/home-care-areas-we-serve">Areas We Serve</a></li><li><a href="/home-care-insurance">Insurance &amp; Eligibility</a></li><li><a href="/home-care-resources">Resources</a></li></ul></div>
    <div><h2>Contact</h2><ul><li><a href="tel:7139777721">713-977-7721</a></li><li><a href="mailto:pas@pthhs.net">pas@pthhs.net</a></li><li>11602 Burdine St, Suite A<br>Houston, TX 77035</li><li><a href="/home-care-contact-us">Get Started</a></li></ul></div>
  </div><div class="shell footer-bottom">© 2026 Primetime Home Health Services, Inc. All rights reserved.</div></footer>
  <div class="mobile-care-bar" aria-label="Quick contact"><a href="tel:7139777721">Call Now</a><a href="/home-care-contact-us">Get Started</a></div>
  <script src="/assets/site-enhancements.js" defer></script>
</body>
</html>
'''


def section(content: str, *, soft: bool = False, section_id: str | None = None) -> str:
    classes = "section section-soft" if soft else "section"
    id_attr = f' id="{html.escape(section_id, quote=True)}"' if section_id else ""
    return f'<section class="{classes}"{id_attr}><div class="shell">{content}</div></section>'
