#!/usr/bin/env python3
"""Restore business-owner-attested PTHHS content to the modern site shell."""

from __future__ import annotations

import re
import html
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"


def replace_main(relative: str, markup: str) -> None:
    path = PUBLIC / relative
    text = path.read_text()
    updated, count = re.subn(
        r'(<main\s+id=["\']main-content["\'][^>]*>)[\s\S]*?(</main>)',
        rf"\1\n{markup.strip()}\n\2",
        text,
        count=1,
        flags=re.I,
    )
    if count != 1:
        raise RuntimeError(f"unable to replace main content in {relative}")
    path.write_text(updated)


def replace_exact(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        if new in text:
            return text
        raise RuntimeError(f"missing homepage restoration target: {label}")
    return text.replace(old, new)


def restore_home() -> None:
    path = PUBLIC / "index.html"
    text = path.read_text()
    text = re.sub(
        r'<picture\s+data-responsive-image=["\']medication-reminders["\'][^>]*>[\s\S]*?</picture>',
        '<img src="/assets/media/medication-reminders-300.webp" alt="Hands organizing a weekly medication reminder box" width="300" height="200" loading="lazy" decoding="async">',
        text,
        flags=re.I,
    )
    text = text.replace(
        "/wp-content/uploads/2024/10/ensuring-medication-adherence-for-better-health-300x200.jpg",
        "/assets/media/medication-reminders-300.webp",
    )
    logo_grid = '<div class="insurance-grid"><div class="insurance-logo"><img src="/wp-content/themes/primetimehomeie989/images/wellpoint.png" alt="Wellpoint" width="300" height="140" loading="lazy" decoding="async"></div><div class="insurance-logo"><img src="/wp-content/themes/primetimehomeie989/images/molina.png" alt="Molina Healthcare" width="300" height="140" loading="lazy" decoding="async"></div><div class="insurance-logo"><img src="/wp-content/themes/primetimehomeie989/images/united-healthcare.png" alt="UnitedHealthcare" width="300" height="140" loading="lazy" decoding="async"></div><div class="insurance-logo"><img src="/wp-content/themes/primetimehomeie989/images/medicaid-1.png" alt="Texas Medicaid" width="302" height="151" loading="lazy" decoding="async"></div><div class="insurance-logo"><img src="/wp-content/themes/primetimehomeie989/images/texas-chldrn-hlth-plan.png" alt="Texas Children’s Health Plan" width="300" height="140" loading="lazy" decoding="async"></div><div class="insurance-logo"><img src="/wp-content/themes/primetimehomeie989/images/comm-health-choice.jpg" alt="Community Health Choice" width="300" height="123" loading="lazy" decoding="async"></div></div>'
    text, logo_count = re.subn(
        r'<div class="insurance-grid">[\s\S]*?</div>\s*<a class="btn-secondary" href="/home-care-insurance">',
        logo_grid + '<a class="btn-secondary" href="/home-care-insurance">',
        text,
        count=1,
    )
    if logo_count != 1:
        raise RuntimeError("unable to normalize homepage payer logos")
    replacements = (
        ("Houston-based personal assistance", "Houston home care since 1999", "history kicker"),
        (
            "Compassionate, non-medical in-home support for eligible seniors, adults and children throughout Greater Houston—delivered by a local Houston team focused on dignity, consistency, and clear communication.",
            "Compassionate, non-medical in-home support for eligible seniors, adults and children throughout Greater Houston—delivered by a local agency families have turned to for more than 25 years.",
            "history lead",
        ),
        ("Houston-Based Support", "25+ Years Serving Houston", "history trust item"),
        ("Authorization Guidance", "Multiple Medicaid Plans", "payer trust item"),
        (
            '<article class="card"><h3>Medication Reminders</h3><p>Non-medical prompts that help eligible clients follow the medication schedule established by their healthcare provider.</p><a class="card-link" href="/home-care-services/medication-reminders">Learn About Reminders →</a></article>',
            '<article class="card service-card"><div class="service-img"><img src="/assets/media/medication-reminders-300.webp" alt="Hands organizing a weekly medication reminder box" width="300" height="200" loading="lazy" decoding="async"></div><div class="service-body"><h3>Medication Reminders</h3><p>Non-medical prompts that help eligible clients follow the medication schedule established by their healthcare provider.</p><a class="card-link" href="/home-care-services/medication-reminders">Learn About Reminders →</a></div></article>',
            "medication reminder image",
        ),
        (
            '<article class="card text-card"><h3>Authorization-based support</h3><p>Available tasks depend on the client’s program, assessed needs, and current service authorization.</p><a class="card-link" href="/home-care-insurance">Review Eligibility Information →</a></article>',
            '<article class="card"><h3>Protective Supervision</h3><p>Support for eligible individuals who require authorized observation to help reduce safety risks in the home.</p><a class="card-link" href="/home-care-services/attendant-care-services#protective_supervision">Learn About Supervision →</a></article>',
            "protective supervision card",
        ),
        ("Understand eligibility and current plan requirements", "Medicaid and managed-care plans we work with", "payer heading"),
        (
            "Eligibility, network status, and authorization are determined by the applicable plan and can change. Confirm benefits with the plan, then ask Primetime whether the agency can currently accept the referral.",
            "Primetime works with the plans shown below for applicable non-medical personal assistance services. Plan networks and authorizations can change, so contact the plan and Primetime to confirm current participation for the member before services begin.",
            "payer explanation",
        ),
        ('<div class="section-label">Feedback and privacy</div><h3>How Primetime handles client feedback</h3><p>Individual testimonials remain unpublished until source, permission, attribution, accuracy, and privacy checks are documented.</p>', '<div class="stars" aria-hidden="true">★★★★★</div><h3>Read feedback shared by our Google reviewers</h3><p>See recent public feedback about communication, coordination and support from the Primetime team.</p>', "review callout"),
        (
            "Primetime Home Health Services is a Houston-based agency serving local families.",
            "Primetime Home Health Services has served Houston-area families since 1999.",
            "about history",
        ),
        ("How can I check current plan participation?", "Which Medicaid plans does Primetime work with?", "payer FAQ heading"),
        (
            "Named network claims are withheld until current documentation is approved. Confirm network status with the plan and Primetime before relying on coverage.",
            "Primetime works with UnitedHealthcare, Molina Healthcare, Community Health Choice, Wellpoint, Texas Children’s Health Plan and Traditional Texas Medicaid for applicable services. Participation can change; confirm current status with the plan and Primetime.",
            "payer FAQ answer",
        ),
    )
    for old, new, label in replacements:
        text = replace_exact(text, old, new, label)
    path.write_text(text)


def restore_supporting_claims() -> None:
    replacements = {
        "home-care-about-us.html": (
            ("a Houston-based personal assistance agency", "a Houston personal assistance agency serving families since 1999"),
            ("Houston-based agency", "25+ Years Serving Houston"),
        ),
        "home-care-areas-we-serve.html": (
            ("Plan-Specific Eligibility", "Multiple Medicaid Plans"),
            ("Confirm Location Availability", "Region 5 & 6 Coverage"),
        ),
    }
    for relative, rows in replacements.items():
        path = PUBLIC / relative
        text = path.read_text()
        for old, new in rows:
            text = text.replace(old, new)
        path.write_text(text)

    attendant = PUBLIC / "home-care-services/attendant-care-services/index.html"
    text = attendant.read_text()
    section = '''<section class="section" id="protective_supervision"><div class="shell content-wrap"><h2>Protective supervision</h2><p>When included in an applicable program authorization, protective supervision provides non-medical observation for an eligible person who needs support reducing safety risks at home. The authorized service plan controls the tasks and hours.</p><div class="notice"><strong>Non-medical scope:</strong> Protective supervision does not include diagnosis, skilled nursing, medication administration, treatment or emergency monitoring.</div></div></section>'''
    text = re.sub(r'<section class="section" id="protective_supervision">[\s\S]*?</section>', "", text)
    marker = '<section class="section section-soft">'
    if marker not in text:
        raise RuntimeError("attendant page is missing insertion marker")
    attendant.write_text(text.replace(marker, section + marker, 1))

    for path in PUBLIC.rglob("*.html"):
        text = path.read_text()
        text = text.replace(
            "our 10-county coverage area: Brazoria, Chambers, Fort Bend, Galveston, Harris, Jefferson, Montgomery, Waller, Walker, and Wharton counties",
            "our 11-county coverage area: Brazoria, Chambers, Fort Bend, Galveston, Harris, Jefferson, Liberty, Montgomery, Waller, Walker, and Wharton counties",
        )
        path.write_text(text)


def reconcile_location_inventory() -> None:
    path = PUBLIC / "home-care-areas-we-serve.html"
    text = path.read_text()
    text = re.sub(
        r"<!-- location-directory:start -->[\s\S]*?<!-- location-directory:end -->",
        "",
        text,
    )
    linked = set(re.findall(r'href=["\'](/locations/[^"\']+)', text))
    locations = []
    for file in sorted((PUBLIC / "locations").glob("*.html")):
        route = f"/locations/{file.stem}"
        if route in linked:
            continue
        source = file.read_text()
        heading = re.search(r"<h1[^>]*>(.*?)</h1>", source, re.I | re.S)
        if not heading:
            raise RuntimeError(f"missing location H1: {file.name}")
        label = re.sub(r"^Home Care and Personal Assistance Services in\s+", "", heading.group(1), flags=re.I)
        label = re.sub(r"<[^>]+>", "", label).strip()
        locations.append(
            f'<article class="card location-card"><h3>{html.escape(label)}</h3>'
            '<p>Local service details, eligibility notes and next steps.</p>'
            f'<a href="{route}">Home care in {html.escape(label)}</a></article>'
        )
    directory = (
        '<!-- location-directory:start --><h2 class="section-title section-title-spaced">'
        'More communities in our service area</h2><p class="section-lead">Browse every current '
        'community page in the published service-area inventory.</p><div class="grid grid-3">'
        + "".join(locations)
        + "</div><!-- location-directory:end -->"
    )
    marker = '</div></section><section class="section section-soft">'
    if marker not in text:
        raise RuntimeError("unable to insert reconciled location directory")
    text = text.replace(marker, directory + marker, 1)
    if '<span class="pill">Liberty County</span>' not in text:
        text = text.replace(
            '<span class="pill">Jefferson County</span>',
            '<span class="pill">Jefferson County</span><span class="pill">Liberty County</span>',
        )
    path.write_text(text)


def add_content_cluster_navigation() -> None:
    path = PUBLIC / "home-care-resources.html"
    text = path.read_text()
    text = re.sub(
        r"<!-- content-clusters:start -->[\s\S]*?<!-- content-clusters:end -->",
        "",
        text,
    )
    cluster = '''<!-- content-clusters:start --><section class="section"><div class="shell">
<span class="eyebrow">Explore by Topic</span><h2 class="section-title">Practical home-care information</h2>
<div class="grid grid-3">
<article class="card"><h3>Everyday personal assistance</h3><p>Understand non-medical PAS, attendant care, personal care and activities of daily living.</p><p><a class="card-link" href="/home-care-services">Explore Services →</a></p></article>
<article class="card"><h3>Caregiver support</h3><p>Learn how respite, authorized supervision and a clear service plan can support households and family caregivers.</p><p><a class="card-link" href="/home-care-services/respite-care">Explore Respite Care →</a></p></article>
<article class="card"><h3>Texas Medicaid navigation</h3><p>Separate public program rules, payer decisions and Primetime’s agency onboarding process.</p><p><a class="card-link" href="/home-care-insurance">Review Insurance &amp; Eligibility →</a></p></article>
</div></div></section><!-- content-clusters:end -->'''
    if "</main>" not in text:
        raise RuntimeError("resources page is missing main")
    path.write_text(text.replace("</main>", cluster + "</main>", 1))


INSURANCE_MAIN = '''
<section class="page-hero"><div class="shell">
<nav class="breadcrumb" aria-label="Breadcrumb"><a href="/">Home</a> / <span aria-current="page">Insurance &amp; Medicaid Plans</span></nav>
<span class="eyebrow">Texas Medicaid &amp; Managed Care</span>
<h1>Insurance &amp; Medicaid Plans</h1>
<p class="section-lead">Primetime helps eligible Greater Houston families navigate plan confirmation, service authorization and agency onboarding for non-medical personal assistance services.</p>
</div></section>
<section class="section"><div class="shell">
<h2 class="section-title">Plans and programs we work with</h2>
<p class="section-lead">Our current plan relationships are listed below. Network participation, member eligibility and service authorization can change, so verify the member’s specific coverage with both the plan and Primetime before relying on this information.</p>
<div class="insurance-grid">
<div class="insurance-logo"><img src="/wp-content/themes/primetimehomeie989/images/wellpoint.png" alt="Wellpoint" width="300" height="140" loading="lazy" decoding="async"></div>
<div class="insurance-logo"><img src="/wp-content/themes/primetimehomeie989/images/molina.png" alt="Molina Healthcare" width="300" height="140" loading="lazy" decoding="async"></div>
<div class="insurance-logo"><img src="/wp-content/themes/primetimehomeie989/images/united-healthcare.png" alt="UnitedHealthcare" width="300" height="140" loading="lazy" decoding="async"></div>
<div class="insurance-logo"><img src="/wp-content/themes/primetimehomeie989/images/medicaid-1.png" alt="Texas Medicaid" width="302" height="151" loading="lazy" decoding="async"></div>
<div class="insurance-logo"><img src="/wp-content/themes/primetimehomeie989/images/texas-chldrn-hlth-plan.png" alt="Texas Children’s Health Plan" width="300" height="140" loading="lazy" decoding="async"></div>
<div class="insurance-logo"><img src="/wp-content/themes/primetimehomeie989/images/comm-health-choice.jpg" alt="Community Health Choice" width="300" height="123" loading="lazy" decoding="async"></div>
</div>
<div class="notice"><strong>Coverage note:</strong> A logo or plan name does not guarantee eligibility, authorization, payment, available hours or immediate service. The plan makes benefit and authorization decisions; Primetime confirms whether it can accept the referral.</div>
</div></section>
<section class="section section-soft"><div class="shell">
<h2 class="section-title">How eligibility and onboarding fit together</h2>
<div class="process-grid">
<article class="process-step"><div class="num">1</div><h3>Public program rules</h3><p>Texas Health and Human Services administers Medicaid programs. Eligibility depends on the applicable program and the member’s circumstances.</p></article>
<article class="process-step"><div class="num">2</div><h3>Plan decision</h3><p>The member’s Medicaid program or managed-care plan determines covered services, functional eligibility and authorized hours.</p></article>
<article class="process-step"><div class="num">3</div><h3>Primetime onboarding</h3><p>After plan and service details are confirmed, Primetime checks current participation, service-area coverage and caregiver availability, then explains agency onboarding.</p></article>
</div>
<p class="action-row-spaced"><a class="btn-secondary" href="https://www.hhs.texas.gov/services/health/medicaid-chip" target="_blank" rel="noopener noreferrer">Texas Medicaid &amp; CHIP information</a> <a class="btn-secondary" href="https://www.yourtexasbenefits.com/" target="_blank" rel="noopener noreferrer">Your Texas Benefits</a></p>
</div></section>
<section class="section"><div class="shell split"><div>
<span class="eyebrow">Before You Call</span><h2 class="section-title">Have a few basics ready</h2>
<ul class="check-list"><li>Member’s current plan or Medicaid program</li><li>Home ZIP code and county</li><li>Type of everyday assistance being requested</li><li>Existing authorization or case-manager contact, if available</li></ul>
<p>Do not email diagnoses, medication lists, Medicaid numbers or other sensitive health information. Call for the appropriate secure next step.</p>
</div><article class="card"><h3>Confirm your plan</h3><p>Call the Houston office so our team can check current participation and explain what information is needed.</p><p><a class="btn-primary" href="/home-care-contact-us">Get Started</a></p><p><a class="btn-secondary phone-link" href="tel:7139777721">Call 713-977-7721</a></p></article></div></section>
'''


REVIEWS_MAIN = '''
<section class="page-hero"><div class="shell">
<nav class="breadcrumb" aria-label="Breadcrumb"><a href="/">Home</a> / <span aria-current="page">Google Reviews</span></nav>
<span class="eyebrow">Public Client &amp; Team Feedback</span><h1>Google Reviews</h1>
<p class="section-lead">Recent reviewers have shared positive feedback about the communication, responsiveness and support they received from Primetime team members.</p>
<div class="hero-actions"><a class="btn-secondary" href="https://www.google.com/maps/search/?api=1&amp;query=Primetime%20Home%20Health%20Services%2011602%20Burdine%20St%20Houston%20TX%2077035" target="_blank" rel="noopener noreferrer">View Google Business Profile</a></div>
</div></section>
<section class="section"><div class="shell">
<h2 class="section-title">What reviewers are saying</h2>
<p class="section-lead">These short excerpts are attributed to their public Google reviewer names. Wording is lightly trimmed for length; no health details are reproduced.</p>
<div class="grid grid-2">
<article class="card review-card"><div class="stars" aria-label="Five-star review">★★★★★</div><blockquote>“Nikki has been the most helpful supervisor. My client and I appreciate her.”</blockquote><p><strong>Michelle Gutierrez</strong><br><span>Google reviewer</span></p></article>
<article class="card review-card"><div class="stars" aria-label="Five-star review">★★★★★</div><blockquote>“We appreciate her. We love Primetime.”</blockquote><p><strong>Betty Flowers</strong><br><span>Google reviewer</span></p></article>
<article class="card review-card"><div class="stars" aria-label="Five-star review">★★★★★</div><blockquote>“Thanks kindly for your great help and support, Aisha.”</blockquote><p><strong>Marlin Thomas</strong><br><span>Google reviewer</span></p></article>
<article class="card review-card"><div class="stars" aria-label="Five-star review">★★★★★</div><blockquote>“Primetime is the place for us.”</blockquote><p><strong>St. JohnPeter</strong><br><span>Google reviewer</span></p></article>
</div>
<p class="small-note">Sources checked September 11, 2026: public Google reviews displayed through current review listings. Reviews reflect individual experiences and do not guarantee the same result for every person.</p>
</div></section>
<section class="section section-soft"><div class="shell split"><div><span class="eyebrow">Share Feedback</span><h2 class="section-title">Tell us about your experience</h2><p class="section-lead">Public reviews help families learn about communication and service. Please do not include diagnoses, Medicaid numbers, medication information or other private health details in a public review.</p></div><article class="card"><h3>Need help with an active service concern?</h3><p>Call the office directly so the appropriate team member can assist. The website and public reviews are not emergency channels.</p><p><a class="btn-secondary phone-link" href="tel:7139777721">Call 713-977-7721</a></p></article></div></section>
'''


STAFF_MAIN = '''
<section class="page-hero"><div class="shell"><nav class="breadcrumb" aria-label="Breadcrumb"><a href="/">Home</a> / <span aria-current="page">Our Leadership Team</span></nav><span class="eyebrow">Houston Personal Assistance Team</span><h1>Meet our leadership team</h1><p class="section-lead">Experienced local leaders coordinate non-medical personal assistance, client communication, attendant support and day-to-day operations.</p></div></section>
<section class="section"><div class="shell"><div class="grid grid-3 staff-grid">
<article class="card staff-card"><img src="/assets/media/staff-johnson-640.webp" alt="Johnson Nwokorie, Administrator and founder" width="640" height="698" loading="lazy" decoding="async"><div><h2>Johnson Nwokorie</h2><p class="staff-role">Administrator &amp; Founder</p><p>Johnson has more than 25 years of home-care leadership experience. His business and finance background supports Primetime’s focus on dependable operations for clients, attendants and office teams.</p><a class="card-link" href="/home-care-meet-our-staff/johnson-nwokorie">Read Johnson’s profile →</a></div></article>
<article class="card staff-card"><img src="/assets/media/staff-irasema-640.webp" alt="Irasema Baron, General Manager" width="640" height="703" loading="lazy" decoding="async"><div><h2>Irasema Baron</h2><p class="staff-role">General Manager</p><p>Irasema supports office and field teams, client and attendant communication, and operational coordination. She communicates in English and Spanish and has completed ANE competency and Texas HHS administrator/alternate training.</p></div></article>
<article class="card staff-card"><img src="/assets/media/staff-jeremy-640.webp" alt="Jeremy Nwokorie, Assistant Administrator" width="640" height="698" loading="lazy" decoding="async"><div><h2>Jeremy Nwokorie</h2><p class="staff-role">Assistant Administrator</p><p>Jeremy brings education in public health and health informatics to operational modernization, service coordination and technology-supported administration. He has worked in the industry since 2016.</p></div></article>
</div></div></section>
<section class="section section-soft"><div class="shell split"><div><span class="eyebrow">How We Work</span><h2 class="section-title">A team families and attendants can reach</h2><p class="section-lead">The office team supports intake, eligibility checks, authorizations, scheduling, EVV, records and service questions while attendants follow each client’s authorized service plan.</p></div><article class="card"><h3>Talk with Primetime</h3><p>Call for service questions, current staff contacts or help reaching the appropriate department.</p><p><a class="btn-primary" href="/home-care-contact-us">Get Started</a></p></article></div></section>
'''


JOHNSON_MAIN = '''
<section class="page-hero"><div class="shell"><nav class="breadcrumb" aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/home-care-meet-our-staff">Our Team</a> / <span aria-current="page">Johnson Nwokorie</span></nav><span class="eyebrow">Administrator &amp; Founder</span><h1>Johnson Nwokorie</h1><p class="section-lead">Founder and Administrator of Primetime Home Health Services, with more than 25 years of experience leading Houston home-care organizations.</p></div></section>
<section class="section"><div class="shell split staff-profile"><div class="photo-frame"><img src="/assets/media/staff-johnson-640.webp" alt="Johnson Nwokorie, Administrator and founder" width="640" height="698" loading="eager" decoding="async"></div><div><span class="eyebrow">Houston Leadership</span><h2 class="section-title">Business leadership rooted in home care</h2><p>Johnson founded Primetime Home Health Services and serves as its Administrator. His professional background combines business administration, finance and more than 25 years of practical leadership in Houston home care.</p><p>He earned bachelor’s and master’s degrees in business administration with a focus in finance from Texas Southern University. His work centers on dependable systems, accountable operations and respectful support for clients, attendants and office teams.</p><p><a class="btn-primary" href="/home-care-contact-us">Get Started</a></p></div></div></section>
'''


CONTACT_MAIN = '''
<section class="page-hero"><div class="shell"><nav class="breadcrumb" aria-label="Breadcrumb"><a href="/">Home</a> / <span aria-current="page">Contact Primetime</span></nav><span class="eyebrow">Houston Non-Medical Home Care</span><h1>Contact Primetime</h1><p class="section-lead">Tell us what kind of everyday support you are seeking, and our team will explain eligibility, authorization and the appropriate next step.</p></div></section>
<section class="section"><div class="shell"><div class="grid grid-2"><article class="card"><h2>Talk with our Houston team</h2><p><strong>Office hours:</strong> Monday–Friday, 9 a.m.–5 p.m.</p><p><a class="btn-secondary phone-link" href="tel:7139777721">Call 713-977-7721</a></p><p><strong>After hours:</strong> Current clients may call <a class="phone-link" href="tel:3465992755">346-599-2755</a> for time-sensitive service coordination that cannot wait until the office reopens. Routine intake and administrative questions are handled during office hours.</p></article><article class="card"><h2>Office</h2><address>Primetime Home Health Services, Inc.<br><a class="address-link" data-map-address="11602 Burdine St, Suite A, Houston, TX 77035" href="https://www.google.com/maps/search/?api=1&amp;query=11602%20Burdine%20St%2C%20Suite%20A%2C%20Houston%2C%20TX%2077035" target="_blank" rel="noopener noreferrer">11602 Burdine St, Suite A<br>Houston, TX 77035</a></address><p><strong>Privacy:</strong> Do not send diagnoses, medication lists, Medicaid numbers or other sensitive health information through ordinary email or social media. Call for the appropriate next step.</p></article></div></div></section>
<section class="section section-soft"><div class="shell"><h2 class="section-title">How care starts</h2><p class="section-lead">The exact process depends on the member’s program and plan, but families generally move through these steps.</p><div class="process-grid"><article class="process-step"><div class="num">1</div><h3>Tell us what you need</h3><p>Share the home ZIP code, current plan and type of everyday assistance being requested.</p></article><article class="process-step"><div class="num">2</div><h3>Confirm eligibility and authorization</h3><p>The Medicaid program or payer determines eligibility, covered services and authorized hours.</p></article><article class="process-step"><div class="num">3</div><h3>Coordinate onboarding</h3><p>Primetime confirms current participation, service-area coverage and availability, then explains onboarding and scheduling.</p></article></div></div></section>
<section class="section"><div class="shell"><div class="notice"><strong>Emergency notice:</strong> This website, the office line and the after-hours line are not emergency services. Call 911 immediately for a medical emergency or an immediate threat to safety.</div></div></section>
'''


CAREERS_MAIN = '''
<section class="page-hero"><div class="shell"><nav class="breadcrumb" aria-label="Breadcrumb"><a href="/">Home</a> / <span aria-current="page">Careers</span></nav><span class="eyebrow">Join the Primetime Team</span><h1>Careers</h1><p class="section-lead">Explore non-clinical attendant and administrative opportunities supporting Greater Houston families.</p></div></section>
<section class="section"><div class="shell"><div class="grid grid-2"><article class="card"><h2>Attendant opportunities</h2><p>Attendants support authorized everyday activities in the client’s home. Duties vary by assignment and service plan and do not include unapproved clinical tasks.</p><h3>What we value</h3><ul class="check-list"><li>Reliability and respectful communication</li><li>Compassion and respect for client choice</li><li>Accurate time and EVV records</li><li>Following the authorized service plan and agency policies</li></ul></article><article class="card"><h2>Accessible application process</h2><ol><li>Call <a class="phone-link" href="tel:7139777721">713-977-7721</a> during office hours to ask about current verified openings.</li><li>Request the approved application method and the job requirements.</li><li>Submit information only through the method the office provides.</li><li>The hiring team will explain any position-specific screening and next steps.</li></ol><p>When no opening is posted, applicants may still call to ask whether Primetime is accepting general-interest applications.</p></article></div><div class="notice"><strong>Applicant privacy:</strong> Do not email Social Security numbers, identity documents, medical information or background-check records unless the hiring team has provided an approved secure method. Primetime Home Health Services, Inc. is an equal opportunity employer.</div></div></section>
'''


def main() -> None:
    restore_home()
    restore_supporting_claims()
    reconcile_location_inventory()
    add_content_cluster_navigation()
    replace_main("home-care-insurance.html", INSURANCE_MAIN)
    replace_main("home-care-client-reviews.html", REVIEWS_MAIN)
    replace_main("home-care-meet-our-staff.html", STAFF_MAIN)
    replace_main("home-care-meet-our-staff/johnson-nwokorie.html", JOHNSON_MAIN)
    profile = PUBLIC / "home-care-meet-our-staff/johnson-nwokorie.html"
    profile.write_text(re.sub(r'<meta\s+name=["\']robots["\'][^>]*>', "", profile.read_text(), flags=re.I))
    replace_main("home-care-contact-us.html", CONTACT_MAIN)
    replace_main("home-care-careers.html", CAREERS_MAIN)
    print("Restored owner-attested history, payer, staff, service-area, review, contact, and career content.")


if __name__ == "__main__":
    main()
