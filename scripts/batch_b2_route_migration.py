#!/usr/bin/env python3
"""Finalize the safe core-route migration and retire legacy content payloads."""

from __future__ import annotations

from pathlib import Path

from batch_a_config import BLOG_SLUGS
from pthhs_shell import render_page, section

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"


blog_body = section(
    '''<!-- No imported article is currently retained for publication. -->
<div class="grid grid-2">
<article class="card"><h2>What kind of help do you need?</h2><p>Start with the distinction between non-medical personal assistance and skilled home health before choosing your next step.</p><p><a class="btn-secondary" href="/home-health-agency-in-houston-texas">Understand non-medical home care</a></p></article>
<article class="card"><h2>How can support fit daily routines?</h2><p>Explore assistance with everyday activities. Tasks and hours depend on the applicable program, authorization and current availability.</p><p><a class="btn-secondary" href="/home-care-services">Explore personal assistance services</a></p></article>
</div>'''
) + section(
    '''<div class="grid grid-2"><article class="card"><h2>Who confirms eligibility and authorization?</h2><p>Your program or plan determines its requirements. Review the distinctions and questions to discuss before confirming a service arrangement.</p><p><a class="btn-secondary" href="/home-care-insurance">Review eligibility and program information</a></p></article><article class="card"><h2>What should you have ready for a call?</h2><p>Use the practical checklist and official public resources. Keep health records and member IDs out of public forms and ordinary email.</p><p><a class="btn-secondary" href="/home-care-resources">Use the before-you-call checklist</a></p></article></div>''',
    soft=True,
) + section(
    '''<div class="content-wrap"><h2>Ask Primetime about your next step</h2><p>Call to discuss non-medical personal assistance, current service-area and staffing availability, and the information needed for agency onboarding.</p><p><a class="btn-secondary" href="tel:7139777721">Call 713-977-7721</a> <a class="btn-primary" href="/home-care-contact-us">Get Started</a></p></div>'''
)
(PUBLIC / "home-care-blog.html").write_text(
    render_page(
        title="Home Care Guide | Primetime Houston",
        description="Explore non-medical personal assistance, understand eligibility questions, and prepare for a call with Primetime using our home care guide.",
        path="/home-care-blog",
        eyebrow="Home Care Guide",
        heading="Find the next step for home care",
        lead="Choose the question that fits your situation. These pages explain non-medical personal assistance and the information to confirm before services can begin.",
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
