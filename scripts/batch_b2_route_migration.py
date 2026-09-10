#!/usr/bin/env python3
"""Finalize the safe core-route migration and retire legacy content payloads."""

from __future__ import annotations

from pathlib import Path

from batch_a_config import BLOG_SLUGS
from pthhs_shell import render_page, section

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"


blog_body = section(
    '''<div class="grid grid-2">
<article class="card"><h2>Article review underway</h2><p>The imported article archive is withheld while each post is reviewed for current sources, accurate non-medical service scope, privacy, and approved terminology.</p><p>No imported article is currently retained for publication.</p></article>
<article class="card"><h2>Use verified information</h2><p>For current information about Primetime, use the service, eligibility, location, and official-resource pages or call the Houston office.</p><p><a class="btn-primary" href="/home-care-services">View Services</a></p></article>
</div>'''
) + section(
    '''<div class="grid grid-2"><article class="card"><h2>Official public resources</h2><p>Start with maintained Texas and federal sources for program and benefits information.</p><p><a class="btn-primary" href="/home-care-resources">Browse Resources</a></p></article><article class="card"><h2>Questions about Primetime?</h2><p>Ask about non-medical personal assistance, service-area availability, or agency onboarding after eligibility and authorization are confirmed.</p><p><a class="btn-secondary" href="tel:7139777721">Call 713-977-7721</a></p></article></div>''',
    soft=True,
)
(PUBLIC / "home-care-blog.html").write_text(
    render_page(
        title="Home Care Information | Primetime Houston",
        description="Use verified Primetime service information and maintained official resources while the imported article archive remains under review.",
        path="/home-care-blog",
        eyebrow="Verified Information",
        heading="Home care information you can verify",
        lead="The imported article archive remains unpublished until every retained item passes source, scope, privacy, and terminology review.",
        body=blog_body,
    )
)


reviews_body = section(
    '''<div class="grid grid-2"><article class="card"><h2>Testimonials remain withheld</h2><p>Individual statements are not published unless source, permission, attribution, current accuracy, and privacy approval are documented. Raw WordPress comments are not approved testimonials.</p></article><article class="card"><h2>Share service feedback privately</h2><p>Current clients, authorized representatives, and attendants can call the office with feedback. Do not post health details or identifying information publicly.</p><p><a class="btn-primary" href="tel:7139777721">Call 713-977-7721</a></p></article></div>'''
) + section(
    '''<div class="content-wrap"><h2>Questions about getting started?</h2><p>Contact the Houston team to ask about authorized non-medical personal assistance and the applicable agency onboarding process.</p><p><a class="btn-primary" href="/home-care-contact-us">Get Started</a></p></div>''',
    soft=True,
)
(PUBLIC / "home-care-client-reviews.html").write_text(
    render_page(
        title="Client Feedback | Primetime Home Health Houston",
        description="Learn how Primetime receives service feedback and withholds testimonials until permission, attribution, accuracy, and privacy checks are complete.",
        path="/home-care-client-reviews",
        eyebrow="Feedback and Privacy",
        heading="Client feedback",
        lead="Individual testimonials remain unpublished until their source, permission, attribution, accuracy, and privacy review is documented.",
        body=reviews_body,
    )
)


def retired_page(slug: str, *, destination: str, kind: str) -> None:
    body = section(
        f'''<div class="content-wrap"><h2>This {kind} is not published</h2><p>The former content is unavailable while accuracy, scope, source, privacy, and publication requirements are reviewed. Do not rely on an archived or cached copy.</p><p><a class="btn-primary" href="{destination}">Continue to verified information</a></p></div>'''
    )
    (PUBLIC / f"{slug}.html").write_text(
        render_page(
            title="Archived Content | Primetime Home Health",
            description="This former Primetime page is unpublished and redirects to current, verified information.",
            path=f"/{slug}",
            eyebrow="Archived Content",
            heading="This page has moved",
            lead="Use the current destination for verified Primetime information.",
            body=body,
            robots="noindex,nofollow",
        )
    )


for slug in BLOG_SLUGS:
    retired_page(slug, destination="/home-care-blog", kind="article or archive page")

retired_page(
    "home-care-set-an-appointment",
    destination="/home-care-contact-us",
    kind="appointment page",
)

print(f"Migrated Blog and Reviews; replaced {len(BLOG_SLUGS) + 1} retired legacy payloads.")
