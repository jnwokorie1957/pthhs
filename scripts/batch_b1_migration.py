#!/usr/bin/env python3
"""Migrate the remaining staff route and refresh the maintained resource hub."""

from __future__ import annotations

from pathlib import Path

from pthhs_shell import render_page, section

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"


team_body = section(
    '''<div class="grid grid-2">
<article class="card"><h2>Client and family support</h2><p>Our office team helps with service questions, agency onboarding, scheduling, and communication about authorized non-medical personal assistance services.</p><p><a class="btn-primary" href="/home-care-contact-us">Get Started</a></p></article>
<article class="card"><h2>Attendant support</h2><p>Attendants follow the client’s authorized service plan and agency policies while helping with approved everyday activities. Duties vary by client and do not include unapproved clinical tasks.</p><p><a class="btn-secondary" href="/home-care-careers">Explore Careers</a></p></article>
</div>
<div class="notice"><strong>Profile review:</strong> Individual biographies, role histories, credentials, training claims, and staffing figures are withheld until current documentation and publication approval are recorded.</div>'''
) + section(
    '''<div class="content-wrap"><h2>How the team works with you</h2><p>Primetime coordinates non-medical services after eligibility, authorization, service area, and caregiver availability are confirmed. The applicable program or health plan—not this website—determines covered tasks and authorized hours.</p><p>For questions about an existing service plan, use the contact process provided by the agency. Do not send diagnoses, medication lists, or other sensitive health information through ordinary email or social media.</p></div>''',
    soft=True,
)

(PUBLIC / "home-care-meet-our-staff.html").write_text(
    render_page(
        title="Our Team | Primetime Home Health Services",
        description="Learn how Primetime's Houston office and attendants support authorized, non-medical personal assistance services.",
        path="/home-care-meet-our-staff",
        eyebrow="Houston Personal Assistance Team",
        heading="The people who support your service",
        lead="Our office team and attendants coordinate respectful, authorized everyday support while individual staff profiles undergo verification.",
        body=team_body,
    )
)

profile_body = section(
    '''<div class="content-wrap"><h2>This profile is being reviewed</h2><p>We have removed the previous biography while current role, credential, education, employment-history, and publication records are revalidated. No professional qualification or historical claim should be inferred from the former page.</p><p>Use the team page for current information about how Primetime supports clients and attendants.</p><p><a class="btn-primary" href="/home-care-meet-our-staff">Visit Our Team</a></p></div>'''
)

(PUBLIC / "home-care-meet-our-staff/johnson-nwokorie.html").write_text(
    render_page(
        title="Staff Profile Review | Primetime Home Health Services",
        description="This archived Primetime staff biography is withheld while its role, credential, and history claims are revalidated.",
        path="/home-care-meet-our-staff/johnson-nwokorie",
        eyebrow="Archived Staff Profile",
        heading="Profile verification in progress",
        lead="Current documentation and publication approval are required before individual staff claims return to the website.",
        body=profile_body,
        robots="noindex,follow",
    )
)

resources_body = section(
    '''<div class="section-heading"><h2 class="section-title">Official starting points</h2><p class="section-lead">These public agencies maintain the linked program and benefits information. Links were reviewed September 10, 2026; program details can change.</p></div>
<div class="grid grid-3 article-grid">
<article class="card text-card"><p class="resource-domain">Texas Health and Human Services</p><h3>Medicaid &amp; CHIP</h3><p>State information about Texas Medicaid and CHIP programs.</p><a class="card-link" href="https://www.hhs.texas.gov/services/health/medicaid-chip" target="_blank" rel="noopener noreferrer">Open official resource <span aria-hidden="true">↗</span><span class="sr-only"> (opens in a new tab)</span></a></article>
<article class="card text-card"><p class="resource-domain">Texas Health and Human Services</p><h3>Long-term care</h3><p>State information about long-term services, supports, and ways to find help.</p><a class="card-link" href="https://www.hhs.texas.gov/services/aging/long-term-care" target="_blank" rel="noopener noreferrer">Open official resource <span aria-hidden="true">↗</span><span class="sr-only"> (opens in a new tab)</span></a></article>
<article class="card text-card"><p class="resource-domain">Texas Health and Human Services</p><h3>Your Texas Benefits</h3><p>Apply for, renew, and manage eligible Texas benefit programs.</p><a class="card-link" href="https://www.yourtexasbenefits.com/Learn/Home" target="_blank" rel="noopener noreferrer">Open official resource <span aria-hidden="true">↗</span><span class="sr-only"> (opens in a new tab)</span></a></article>
<article class="card text-card"><p class="resource-domain">Texas Health and Human Services</p><h3>Medicaid for older adults and people with disabilities</h3><p>State eligibility and program information for these populations.</p><a class="card-link" href="https://www.hhs.texas.gov/services/health/medicaid-chip/medicaid-chip-programs-services/programs-children-adults-disabilities/medicaid-elderly-people-disabilities" target="_blank" rel="noopener noreferrer">Open official resource <span aria-hidden="true">↗</span><span class="sr-only"> (opens in a new tab)</span></a></article>
<article class="card text-card"><p class="resource-domain">Medicaid.gov</p><h3>Self-directed services</h3><p>Federal background about Medicaid self-direction options; state implementation varies.</p><a class="card-link" href="https://www.medicaid.gov/medicaid/long-term-services-supports/self-directed-services" target="_blank" rel="noopener noreferrer">Open official resource <span aria-hidden="true">↗</span><span class="sr-only"> (opens in a new tab)</span></a></article>
<article class="card text-card"><p class="resource-domain">2-1-1 Texas</p><h3>Community resource search</h3><p>Search Texas health and human-services resources or call 2-1-1 for assistance.</p><a class="card-link" href="https://www.211texas.org/" target="_blank" rel="noopener noreferrer">Open official resource <span aria-hidden="true">↗</span><span class="sr-only"> (opens in a new tab)</span></a></article>
</div>
<div class="notice"><strong>Important:</strong> External information does not prove eligibility, authorization, coverage, or PTHHS network participation. Confirm current requirements with the responsible agency or plan and confirm agency participation directly with Primetime.</div>''',
    section_id="official-resources",
) + section(
    '''<div class="grid grid-2"><article class="card"><h2>Questions about Primetime services?</h2><p>Our Houston team can explain the agency onboarding process after eligibility and authorization are confirmed.</p><p><a class="btn-primary" href="/home-care-contact-us">Get Started</a></p></article><article class="card"><h2>Prefer to call?</h2><p>Call to ask about non-medical personal assistance, current service-area availability, or the information needed for next steps.</p><p><a class="btn-secondary" href="tel:7139777721">Call 713-977-7721</a></p></article></div>''',
    soft=True,
)

(PUBLIC / "home-care-resources.html").write_text(
    render_page(
        title="Official Home Care Resources | Primetime Houston",
        description="Use maintained official Texas and federal resources for Medicaid, benefits, long-term supports, and community assistance information.",
        path="/home-care-resources",
        eyebrow="Maintained Public Resources",
        heading="Find information from the responsible source",
        lead="Start with official public resources, then confirm eligibility, authorization, and current agency participation for the individual situation.",
        body=resources_body,
    )
)

print("Migrated staff index, archived profile, and official resource hub.")
