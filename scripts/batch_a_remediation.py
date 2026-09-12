#!/usr/bin/env python3
"""Apply the approved Batch A scope/claim remediation to the static site."""

from __future__ import annotations

import html
import json
import re
from pathlib import Path

from site_scope import marketing_html_files

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
HOST = "https://pthhs.net"
from batch_a_config import BLOG_SLUGS


def shell(title: str, description: str, path: str, eyebrow: str, heading: str, lead: str, body: str) -> str:
    canonical = f"{HOST}{path}"
    data = {
        "@context": "https://schema.org",
        "@type": "WebPage",
        "@id": canonical + "#webpage",
        "url": canonical,
        "name": title,
        "description": description,
        "isPartOf": {"@id": HOST + "/#website"},
    }
    return f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{html.escape(title)}</title><meta name="description" content="{html.escape(description, quote=True)}"><link rel="canonical" href="{canonical}"><meta property="og:type" content="website"><meta property="og:title" content="{html.escape(title, quote=True)}"><meta property="og:description" content="{html.escape(description, quote=True)}"><meta property="og:url" content="{canonical}"><link rel="stylesheet" href="/assets/modern.css"><link rel="stylesheet" href="/assets/section-pages.css"><script type="application/ld+json">{json.dumps(data, separators=(',', ':'))}</script></head><body class="modern-page"><header class="site-header"><div class="shell nav-wrap"><a class="brand" href="/" aria-label="Primetime Home Health Services home"><img src="/wp-content/themes/primetimehomeie989/images/main-logo.png" alt="Primetime Home Health Services, Inc." width="410" height="203"></a><nav class="site-nav" aria-label="Primary navigation"><a href="/home-care-about-us">About</a><a href="/home-care-services">Services</a><a href="/home-care-areas-we-serve">Locations</a><a href="/home-care-insurance">Insurance</a><a href="/home-care-blog">Resources</a><a href="/home-care-careers">Careers</a><a class="nav-cta" href="/home-care-contact-us">Get Started</a></nav></div></header><main><section class="page-hero"><div class="shell"><nav class="breadcrumb" aria-label="Breadcrumb"><a href="/">Home</a> / <span aria-current="page">{html.escape(heading)}</span></nav><span class="eyebrow">{html.escape(eyebrow)}</span><h1>{html.escape(heading)}</h1><p class="section-lead">{html.escape(lead)}</p></div></section>{body}</main><footer class="site-footer"><div class="shell footer-grid"><div><img class="footer-logo" src="/wp-content/themes/primetimehomeie989/images/footer-logo.png" alt="Primetime Home Health Services"><p>Non-medical personal assistance services for eligible children, adults and seniors throughout Greater Houston.</p></div><div><h3>Explore</h3><ul><li><a href="/home-care-about-us">About</a></li><li><a href="/home-care-services">Services</a></li><li><a href="/home-care-areas-we-serve">Areas We Serve</a></li><li><a href="/home-care-insurance">Insurance &amp; Eligibility</a></li></ul></div><div><h3>Contact</h3><ul><li><a href="tel:7139777721">713-977-7721</a></li><li>11602 Burdine St, Suite A<br>Houston, TX 77035</li><li><a href="/home-care-contact-us">Contact Us</a></li></ul></div></div><div class="shell footer-bottom">© 2026 Primetime Home Health Services, Inc. All rights reserved.</div></footer><div class="mobile-care-bar" aria-label="Quick contact"><a href="tel:7139777721">Call Now</a><a href="/home-care-contact-us">Get Started</a></div></body></html>'''


def section(content: str, soft: bool = False) -> str:
    return f'<section class="section{" section-soft" if soft else ""}"><div class="shell">{content}</div></section>'


def write_page(filename: str, *args: str) -> None:
    (PUBLIC / filename).write_text(shell(*args) + "\n")


contact = section('''<div class="grid grid-2"><article class="card"><h2>Talk with our Houston team</h2><p>Call to ask about non-medical personal assistance services, service-area availability, or the information needed to begin agency onboarding after eligibility and authorization are confirmed.</p><p><a class="btn-primary" href="tel:7139777721">Call 713-977-7721</a></p></article><article class="card"><h2>Office</h2><address>Primetime Home Health Services, Inc.<br>11602 Burdine St, Suite A<br>Houston, TX 77035</address><p><strong>Important:</strong> Do not send diagnoses, medication lists, or other sensitive health information through ordinary email or social media. Call our office for the appropriate next step.</p></article></div>''') + section('''<h2>What we can help with</h2><div class="grid grid-3"><article class="card"><h3>Service questions</h3><p>Learn about attendant care, personal care, respite care, activities of daily living, and non-medical medication reminders.</p></article><article class="card"><h3>Eligibility and authorization</h3><p>Your program or health plan determines eligibility, covered services, and authorized hours. Our team can explain the agency onboarding process.</p></article><article class="card"><h3>Careers</h3><p>Interested in attendant or office opportunities? Visit our careers page for current information.</p><p><a class="card-link" href="/home-care-careers">View Careers →</a></p></article></div><div class="notice"><strong>Service scope:</strong> Primetime provides non-medical personal assistance services. We do not diagnose conditions or provide skilled nursing, medical treatment, or therapy through these services.</div>''', True)
write_page("home-care-contact-us.html", "Contact Primetime Home Care in Houston", "Contact Primetime Home Health Services about non-medical personal assistance services, eligibility, authorization, and service availability in Greater Houston.", "/home-care-contact-us", "Houston Non-Medical Home Care", "Contact Primetime", "Tell us what kind of everyday support you are seeking, and our team will explain the appropriate next step.", contact)

meds = section('''<div class="grid grid-2"><article class="card"><h2>What a medication reminder means</h2><p>An attendant may give a verbal prompt at the scheduled time and may bring an already prepared medication container to the client when that task is authorized in the service plan.</p><p>The client remains responsible for taking the medication. Instructions must come from the client, an authorized representative, pharmacist, prescriber, or approved service plan.</p></article><article class="card"><h2>What attendants do not do</h2><ul class="check-list"><li>Do not select, measure, prepare, or administer medication</li><li>Do not change a dose or schedule</li><li>Do not fill pill organizers</li><li>Do not evaluate side effects or provide clinical advice</li><li>Do not contact a prescriber or pharmacy unless an authorized non-clinical task permits it</li></ul></article></div><div class="notice"><strong>Safety:</strong> For medication questions, missed doses, reactions, or side effects, contact a pharmacist or licensed healthcare professional. Call 911 for an emergency.</div>''') + section('''<h2>Support must match the authorization</h2><p>The exact reminder task depends on the client’s program, service plan, and authorization. Contact Primetime to discuss non-medical personal assistance and the approved scope for a specific client.</p><p><a class="btn-primary" href="/home-care-contact-us">Ask About Services</a> <a class="btn-secondary" href="tel:7139777721">Call 713-977-7721</a></p>''', True)
for name, path in [("home-care-services-medication-reminders.html", "/home-care-services-medication-reminders"), ("home-care-services/medication-reminders.html", "/home-care-services/medication-reminders")]:
    write_page(name, "Non-Medical Medication Reminders | Primetime Houston", "Learn the limited, non-medical scope of authorized medication reminders provided as part of personal assistance services.", path, "Authorized Non-Medical Support", "Medication Reminders", "Simple prompts can support a routine without crossing into medication administration or clinical care.", meds)

attendant = section('''<div class="grid grid-2"><article class="card"><h2>Everyday personal assistance</h2><p>Attendant care supports authorized activities of daily living and household routines so eligible clients can remain safer and more independent at home.</p><ul class="check-list"><li>Bathing, dressing, grooming, and toileting assistance</li><li>Mobility and transfer support within the authorized plan</li><li>Meal preparation and approved light housekeeping</li><li>Companionship and routine safety support</li></ul></article><article class="card"><h2>Scope and eligibility</h2><p>The payer or program determines eligibility, covered tasks, and authorized hours. Primetime coordinates non-medical services after applicable requirements are in place.</p><p>Attendants do not diagnose conditions or provide skilled nursing, medical treatment, therapy, wound care, or medication administration.</p></article></div><div class="notice"><strong>Individual authorization controls:</strong> Available tasks and hours vary by client, program, location, and current authorization.</div>''') + section('''<h2>Ask about attendant care</h2><p>Tell our team the client’s ZIP code, plan information, and the everyday activities where support is needed.</p><p><a class="btn-primary" href="/home-care-contact-us">Get Started</a> <a class="btn-secondary" href="tel:7139777721">Call 713-977-7721</a></p>''', True)
for name, path in [("home-care-services-attendant-care-services.html", "/home-care-services-attendant-care-services"), ("home-care-services/attendant-care-services/index.html", "/home-care-services/attendant-care-services")]:
    write_page(name, "Attendant Care Services in Houston | Primetime", "Explore authorized, non-medical attendant care and activities-of-daily-living support for eligible clients in Greater Houston.", path, "Non-Medical Personal Assistance", "Attendant Care Services", "Respectful help with authorized everyday activities at home.", attendant)

respite = section('''<div class="grid grid-2"><article class="card"><h2>Relief for family caregivers</h2><p>Respite care provides temporary, authorized personal assistance while a regular family caregiver rests, works, attends appointments, or handles other responsibilities.</p></article><article class="card"><h2>Non-medical support</h2><p>Respite attendants follow the authorized service plan. They do not provide skilled nursing, medical treatment, therapy, wound care, or medication administration.</p><p>Availability depends on eligibility, authorization, location, and caregiver scheduling.</p></article></div>''') + section('''<h2>Plan a respite conversation</h2><p>Call to discuss the kind of everyday support needed and the current authorization process.</p><p><a class="btn-primary" href="/home-care-contact-us">Get Started</a> <a class="btn-secondary" href="tel:7139777721">Call 713-977-7721</a></p>''', True)
for name, path in [("home-care-services-respite-care.html", "/home-care-services-respite-care"), ("home-care-services/respite-care/index.html", "/home-care-services/respite-care")]:
    write_page(name, "Respite Care in Houston | Primetime", "Learn about temporary, non-medical personal assistance that supports eligible clients and gives family caregivers time away.", path, "Authorized Caregiver Relief", "Respite Care", "Temporary personal assistance for eligible clients when a regular family caregiver needs time away.", respite)

agency = section('''<div class="grid grid-2"><article class="card"><h2>Our non-medical focus</h2><p>Primetime supports eligible children, adults, and seniors with authorized everyday activities such as personal care, attendant care, respite, and activities of daily living.</p><p>Services and hours depend on eligibility, the applicable program, authorization, location, and caregiver availability.</p></article><article class="card"><h2>Looking for clinical home health?</h2><p>Skilled home health is different from non-medical personal assistance. Primetime does not provide skilled nursing, medical treatment, or therapy through the services described on this website. Ask your physician or health plan for an appropriate licensed clinical provider.</p></article></div>''') + section('''<h2>Start with the support you need</h2><p>Call our Houston office to discuss the daily activities where help is needed and to confirm current service availability.</p><p><a class="btn-primary" href="/home-care-services">Explore Services</a> <a class="btn-secondary" href="/home-care-contact-us">Get Started</a></p>''', True)
write_page("home-health-agency-in-houston-texas.html", "Non-Medical Home Care in Houston | Primetime", "Primetime provides non-medical personal assistance services in Greater Houston, including attendant care, personal care, respite, and ADL support.", "/home-health-agency-in-houston-texas", "Personal Assistance Services", "Non-Medical Home Care in Houston", "Dependable support with authorized everyday activities for eligible clients across Greater Houston.", agency)

careers = section('''<div class="grid grid-2"><article class="card"><h2>Attendant opportunities</h2><p>Attendants support authorized everyday activities in the client’s home. Duties vary by assignment and service plan and do not include unapproved clinical tasks.</p><h3>What we value</h3><ul class="check-list"><li>Reliability and respectful communication</li><li>Compassion and respect for client choice</li><li>Accurate time and EVV records</li><li>Following the authorized service plan and agency policies</li></ul></article><article class="card"><h2>Office opportunities</h2><p>Administrative roles may support intake, authorizations, eligibility checks, EVV, scheduling, billing, records, or client communication.</p><p>Current openings and job requirements can change. Call the office to ask about verified openings and the approved application process.</p><p><a class="btn-primary" href="tel:7139777721">Call 713-977-7721</a></p></article></div><div class="notice">Primetime Home Health Services, Inc. is an equal opportunity employer. Employment is contingent on the requirements applicable to the position.</div>''')
write_page("home-care-careers.html", "Careers at Primetime Home Health Services | Houston", "Learn about attendant and administrative employment opportunities with Primetime Home Health Services in Greater Houston.", "/home-care-careers", "Join the Primetime Team", "Careers", "Explore non-clinical attendant and administrative opportunities supporting Greater Houston families.", careers)

reviews = section('''<div class="grid grid-2"><article class="card"><h2>Review verification in progress</h2><p>We are reviewing testimonial permissions, source attribution, and privacy before republishing individual statements. Raw website comments are not treated as approved testimonials.</p></article><article class="card"><h2>Share direct feedback</h2><p>Current clients, authorized representatives, and attendants can call the office with service feedback. Please do not post private health or identifying information publicly.</p><p><a class="btn-primary" href="tel:7139777721">Call 713-977-7721</a></p></article></div>''') + section('''<h2>What families can expect</h2><p>Clear communication, respectful personal assistance, and support that follows the authorized service plan are central to our work. For service questions or to discuss getting started, contact our Houston team.</p><p><a class="btn-secondary" href="/home-care-contact-us">Contact Primetime</a></p>''', True)
write_page("home-care-client-reviews.html", "Client Feedback | Primetime Home Health Services", "Learn how Primetime handles client feedback and testimonial privacy for its non-medical personal assistance services.", "/home-care-client-reviews", "Feedback and Privacy", "Client Feedback", "We publish individual testimonials only after source, permission, attribution, and privacy review.", reviews)

insurance = section('''<div class="grid grid-2"><article class="card"><h2>Coverage is individual</h2><p>Eligibility, covered services, authorized hours, and provider-network participation are determined by the applicable program or health plan and can change.</p><p>Have the member’s plan name available when you call. Primetime will confirm current agency participation and explain what information is needed for onboarding.</p></article><article class="card"><h2>No guarantee of coverage</h2><p>Information on this website is general and does not guarantee eligibility, authorization, payment, or availability. Confirm benefits and network status directly with the plan and with Primetime before relying on coverage.</p></article></div>''') + section('''<h2>Ask about your current plan</h2><p>We have temporarily removed plan logos and named network claims while documentation is being refreshed. This does not determine whether a particular client can receive services; call for a current, case-specific confirmation.</p><p><a class="btn-primary" href="tel:7139777721">Call 713-977-7721</a> <a class="btn-secondary" href="/home-care-contact-us">Contact Primetime</a></p>''', True)
write_page("home-care-insurance.html", "Insurance, Medicaid & Eligibility | Primetime Houston", "Learn how eligibility, service authorization, and current network participation affect non-medical personal assistance services in Greater Houston.", "/home-care-insurance", "Eligibility and Authorization", "Insurance & Medicaid Information", "Coverage and network status can change. Confirm the member’s current plan and authorization before services begin.", insurance)

blog = section('''<div class="grid grid-2"><article class="card"><h2>Content review underway</h2><p>Our imported article archive is temporarily unavailable while each post is reviewed for accurate non-medical service scope, current sources, privacy, and approved terminology.</p></article><article class="card"><h2>Use verified service information</h2><p>For current information about Primetime, start with our service, eligibility, and location pages or call the Houston office.</p><p><a class="btn-primary" href="/home-care-services">View Services</a> <a class="btn-secondary" href="/home-care-contact-us">Contact Us</a></p></article></div>''')
write_page("home-care-blog.html", "Home Care Resources | Primetime Houston", "Access verified information about Primetime's non-medical personal assistance services, eligibility, and Greater Houston coverage.", "/home-care-blog", "Verified Information", "Home Care Resources", "We are reviewing our article library so every published resource accurately reflects non-medical personal assistance services.", blog)


def canonical_for(path: Path) -> str:
    rel = path.relative_to(PUBLIC).as_posix()
    if rel == "index.html":
        return HOST + "/"
    if rel.endswith("/index.html"):
        return HOST + "/" + rel.removesuffix("/index.html")
    return HOST + "/" + rel.removesuffix(".html")


def normalize_metadata(path: Path) -> None:
    text = path.read_text(errors="ignore")
    canonical = canonical_for(path)
    text = text.replace("https://www.pthhs.net", HOST).replace("http://www.pthhs.net", HOST).replace("http://pthhs.net", HOST)
    canonical_tag = f'<link rel="canonical" href="{canonical}">'
    if re.search(r'<link\s+rel=["\']canonical["\'][^>]*>', text, flags=re.I):
        text = re.sub(r'<link\s+rel=["\']canonical["\'][^>]*>', canonical_tag, text, count=1, flags=re.I)
    elif "<head" in text.lower():
        text = re.sub(r'(<head[^>]*>)', r'\1' + canonical_tag, text, count=1, flags=re.I)
    og_tag = f'<meta property="og:url" content="{canonical}">'
    if re.search(r'<meta\s+property=["\']og:url["\'][^>]*>', text, flags=re.I):
        text = re.sub(r'<meta\s+property=["\']og:url["\'][^>]*>', og_tag, text, count=1, flags=re.I)
    elif "<head" in text.lower():
        text = re.sub(r'(</title>)', r'\1' + og_tag, text, count=1, flags=re.I)
    # Invalid legacy JSON-LD is riskier than no JSON-LD; valid blocks are normalized.
    def clean_schema(match: re.Match[str]) -> str:
        opening, payload, closing = match.groups()
        try:
            obj = json.loads(payload)
        except json.JSONDecodeError:
            return ""
        def walk(value):
            if isinstance(value, dict):
                cleaned = {k: walk(v) for k, v in value.items()}
                if cleaned.get("@type") == "HomeHealthCareAgency":
                    cleaned["@type"] = "LocalBusiness"
                if cleaned.get("@type") == "PostalAddress" and str(cleaned.get("postalCode", "")).strip() == "77035":
                    cleaned.update({"streetAddress": "11602 Burdine St, Suite A", "addressLocality": "Houston", "addressRegion": "TX", "postalCode": "77035", "addressCountry": "US"})
                if "telephone" in cleaned and cleaned.get("address", {}).get("postalCode") == "77035":
                    cleaned["telephone"] = "+1-713-977-7721"
                return cleaned
            if isinstance(value, list):
                return [walk(v) for v in value]
            if isinstance(value, str):
                value = value.replace("https://www.pthhs.net", HOST).replace("http://schema.org", "https://schema.org")
                if value == "./": return HOST + "/"
                if value.startswith("./"): return HOST + "/" + value[2:]
                if value.startswith("/"): return HOST + value
            return value
        return opening + json.dumps(walk(obj), separators=(",", ":")) + closing
    text = re.sub(r'(<script[^>]+type=["\']application/ld\+json["\'][^>]*>)(.*?)(</script>)', clean_schema, text, flags=re.I | re.S)
    path.write_text(text)


# Quarantine imported posts pending the documented editorial review.
for slug in BLOG_SLUGS:
    path = PUBLIC / f"{slug}.html"
    if path.exists():
        text = path.read_text(errors="ignore")
        text = re.sub(r'<meta\s+name=["\']robots["\'][^>]*>', '', text, flags=re.I)
        text = re.sub(r'(<head[^>]*>)', r'\1<meta name="robots" content="noindex,nofollow">', text, count=1, flags=re.I)
        path.write_text(text)

# Remove unsupported age/network proof points from the modern homepage.
index = PUBLIC / "index.html"
text = index.read_text()
text = re.sub(r'<span class="hero-kicker">.*?</span>', '<span class="hero-kicker">Houston-based personal assistance</span>', text, count=1)
text = text.replace('—delivered by a local agency families have turned to for more than 25 years.', '—delivered by a local Houston team focused on dignity, consistency, and clear communication.')
text = text.replace('<span>Multiple Medicaid plans</span>', '<span>Eligibility support</span>')
text = text.replace('<div class="trust-item">25+ Years Serving Houston</div>', '<div class="trust-item">Houston-Based Support</div>')
text = text.replace('<div class="trust-item">Multiple Medicaid Plans</div>', '<div class="trust-item">Authorization Guidance</div>')
text = re.sub(r'<div class="section-label">Texas Medicaid &amp; Managed Care</div><h2 class="section-title">We work with major health plans serving Houston families</h2><p class="section-lead">.*?</p><div class="insurance-grid">.*?</div>', '<div class="section-label">Eligibility &amp; Authorization</div><h2 class="section-title">Confirm current coverage before services begin</h2><p class="section-lead">Program eligibility, service authorization, and network participation can change. Contact us with the member’s plan information for a current confirmation.</p>', text, count=1, flags=re.S)
text = text.replace('Primetime Home Health Services has served Houston-area families for more than 25 years.', 'Primetime Home Health Services is a long-standing Houston agency serving local families.')
index.write_text(text)

# General exact-phrase cleanup in still-public legacy material.
for path in marketing_html_files(PUBLIC):
    text = path.read_text(errors="ignore")
    replacements = {
        "Serving the Greater Houston area with Home Care since 1999": "Serving Greater Houston with non-medical home care",
        "Serving Houston-area families since 1999": "Serving families across Greater Houston",
        "Houston home care since 1999": "Houston-based non-medical home care",
        "25+ Years": "Long-Standing Local Team",
        "95K Happy Customers": "",
        "100% Satisfaction": "",
        "Home Health Agency | Set an Appointment | Houston, Texas": "Get Started With Non-Medical Home Care | Houston",
    }
    for old, new in replacements.items():
        text = text.replace(old, new)
    text = re.sub(r'\b(?:serving\s+[^<.]{0,80}\s+)?since\s+1999\b', 'a long-standing Houston-area provider', text, flags=re.I)
    text = re.sub(r'\b(?:more than\s+)?25\+?\s+years\b', 'many years', text, flags=re.I)
    # Named payer/network claims and logos stay suppressed until the evidence register is current.
    text = re.sub(r'<img\b[^>]*(?:wellpoint|molina|united-healthcare|medicaid-1|texas-chldrn|comm-health-choice)[^>]*>', '', text, flags=re.I)
    for payer in ["UnitedHealthcare", "Molina Healthcare", "Community Health Choice", "Wellpoint", "Texas Children’s Health Plan", "Texas Children's Health Plan", "Traditional Medicaid"]:
        text = text.replace(payer, "the applicable health plan")
    text = text.replace("info@pthhs.com", "pas@pthhs.net").replace("ira.b@primetimehomehealthservices.net", "pas@pthhs.net").replace("jnwokorie@pthhs.net", "pas@pthhs.net")
    text = text.replace("11602 Burdine Street, Suite A<q>,</q> Houston, Texas 77035", "11602 Burdine St, Suite A, Houston, TX 77035")
    text = text.replace("Primetime participates with multiple Texas Medicaid health plans. Contact us with your plan name so we can confirm current participation.", "Network participation can change. Contact us with your plan name so we can confirm current status.")
    text = text.replace("Primetime works with multiple Texas Medicaid managed-care programs and can help families identify the correct next step after they receive or request authorization.", "Network participation can change. Primetime can help families identify the correct next step after they receive or request authorization.")
    text = re.sub(r'Primetime participates in multiple Texas Medicaid programs including PHC, FC, CAS, and other HHSC-linked plans\. We also work with private insurance where applicable\.', 'Eligibility and network participation vary by program and plan. Contact Primetime and the plan to confirm current status.', text)
    text = re.sub(r'Primetime participates in Texas Medicaid programs including STAR\+PLUS, PAS, and other managed care plans\. We also work with private insurance and self-pay families\.', 'Eligibility and network participation vary by program and plan. Contact Primetime and the plan to confirm current status.', text)
    text = text.replace("under Texas Medicaid programs including STAR+PLUS", "subject to the applicable program and authorization")
    text = text.replace("Long-Standing Local Team of Experience", "Long-Standing Local Team")
    text = text.replace("over many years of experience", "extensive experience")
    text = text.replace("with many years of community experience", "with deep community experience")
    text = re.sub(r'Primetime Home Health Services has served (.*?) for many years\.', r'Primetime Home Health Services is a long-standing local agency serving \1.', text)
    text = text.replace("with decades of local experience", "from a long-standing local agency")
    text = text.replace("with decades of experience", "from a long-standing local agency")
    text = text.replace("For many years, Primetime Home Health Services has helped", "As a long-standing local agency, Primetime Home Health Services helps")
    text = text.replace("with many years of experience helping lead", "with extensive experience helping lead")
    text = text.replace("and decades of practical leadership", "and substantial practical leadership")
    text = text.replace("Serving Greater Houston families for many years.", "A long-standing local agency serving Greater Houston families.")
    text = text.replace("and has served area families for many years", "and is a long-standing local agency serving area families")
    path.write_text(text)
    normalize_metadata(path)

# A redirected HTML alias must also be noindex when requested with its explicit .html suffix.
redirect_items = json.loads((ROOT / "firebase.json").read_text())["hosting"].get("redirects", [])
for item in redirect_items:
    source = item.get("source", "")
    if ":" in source or "*" in source or not source.startswith("/"):
        continue
    alias = PUBLIC / (source.lstrip("/") + ".html")
    if alias.exists():
        text = re.sub(r'<meta\s+name=["\']robots["\'][^>]*>', '', alias.read_text(errors="ignore"), flags=re.I)
        text = re.sub(r'(<head[^>]*>)', r'\1<meta name="robots" content="noindex,nofollow">', text, count=1, flags=re.I)
        alias.write_text(text)

# Keep the deploy from serving internal audit/log artifacts.
for name in ["CRAWL-REPORT.md", "crawl-report.json", "crawl-report.json.new", "crawl.log", "legacy-index-wordpress.html"]:
    path = PUBLIC / name
    if path.exists():
        path.unlink()

sitemap = PUBLIC / "sitemap.xml"
if sitemap.exists():
    lines = sitemap.read_text().replace("https://www.pthhs.net", HOST).splitlines()
    redirected_urls = {HOST + item["source"] for item in redirect_items if ":" not in item["source"] and "*" not in item["source"]}
    lines = [line for line in lines if not any(f"/{slug}</loc>" in line for slug in BLOG_SLUGS)]
    lines = [line for line in lines if not any(f"<loc>{url}</loc>" in line for url in redirected_urls)]
    sitemap.write_text("\n".join(lines) + "\n")

(PUBLIC / "robots.txt").write_text("User-agent: *\nAllow: /\n\nSitemap: https://pthhs.net/sitemap.xml\n")

print(f"Batch A remediation applied to {len(marketing_html_files(PUBLIC))} marketing HTML files.")
