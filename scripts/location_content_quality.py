#!/usr/bin/env python3
"""Add evidence-bounded local context to every published location page."""

from __future__ import annotations

import html
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
LOCATIONS = PUBLIC / "locations"

# These groups restate the service-area inventory attested by PTHHS ownership.
# They intentionally avoid demographic, distance, facility, and response-time claims.
LOCATION_GROUPS = {
    "Brazoria County": (
        "alvin", "angleton", "brazoria-county", "clute", "freeport",
        "lake-jackson", "manvel", "pearland", "west-columbia",
    ),
    "Chambers County": ("chambers-county",),
    "Fort Bend County": (
        "fort-bend-county", "fresno", "fulshear", "katy", "missouri-city",
        "needville", "richmond", "rosenberg", "stafford", "sugar-land",
    ),
    "Galveston County": (
        "dickinson", "galveston", "galveston-county", "hitchcock", "la-marque",
        "league-city", "santa-fe", "texas-city",
    ),
    "Harris County": (
        "alief", "baytown", "channelview", "clear-lake", "cypress", "deer-park",
        "gulfton", "harris-county", "houston", "humble", "la-porte", "pasadena",
        "sharpstown", "southwest-houston", "spring", "sunnyside", "tomball", "webster",
    ),
    "Jefferson County": ("jefferson-county",),
    "Liberty County": ("cleveland", "dayton", "liberty"),
    "Montgomery County": (
        "conroe", "magnolia", "montgomery", "montgomery-county", "new-caney",
        "porter", "shenandoah", "the-woodlands", "willis",
    ),
    "Waller County": ("brookshire", "hempstead", "prairie-view", "waller-county"),
    "Walker County": ("walker-county",),
    "Wharton County": ("wharton-county",),
}

GROUP_NOTES = {
    "Brazoria County": "This page belongs to the Brazoria County portion of Primetime’s published service area, which includes communities from Alvin and Pearland to Angleton, Lake Jackson, Freeport, and West Columbia.",
    "Chambers County": "This page represents the Chambers County portion of Primetime’s published service area. Because staffing and authorizations are individual, the office confirms each ZIP code before services begin.",
    "Fort Bend County": "This page belongs to the Fort Bend County portion of Primetime’s published service area, which includes Sugar Land, Missouri City, Richmond, Rosenberg, Stafford, Fresno, Fulshear, Needville, and the Katy area.",
    "Galveston County": "This page belongs to the Galveston County portion of Primetime’s published service area, including mainland and island communities represented in the current location directory.",
    "Harris County": "This page belongs to the Harris County portion of Primetime’s published service area, connecting Houston neighborhoods with communities east, north, southeast, and northwest of the city.",
    "Jefferson County": "This page represents the Jefferson County portion of Primetime’s published service area. The Houston office confirms the requested service, payer, authorization, and available staffing for each referral.",
    "Liberty County": "This page belongs to the Liberty County portion of Primetime’s published service area, including the Liberty, Dayton, and Cleveland service-area pages.",
    "Montgomery County": "This page belongs to the Montgomery County portion of Primetime’s published service area, including Conroe, The Woodlands, Magnolia, Montgomery, Willis, Porter, New Caney, and Shenandoah.",
    "Waller County": "This page belongs to the Waller County portion of Primetime’s published service area, including Hempstead, Prairie View, Brookshire, and the wider county service area.",
    "Walker County": "This page represents the Walker County portion of Primetime’s published service area. The office confirms the member’s ZIP code and current operational availability before onboarding.",
    "Wharton County": "This page represents the Wharton County portion of Primetime’s published service area. The office confirms the member’s ZIP code and current operational availability before onboarding.",
}


def label_for(path: Path) -> str:
    text = path.read_text(errors="strict")
    heading = re.search(r"<h1[^>]*>(.*?)</h1>", text, re.I | re.S)
    if not heading:
        raise RuntimeError(f"missing location H1: {path.name}")
    label = re.sub(r"<[^>]+>", "", heading.group(1))
    label = re.sub(
        r"^(?:Home Care and Personal Assistance(?: Services)? in|.+? Medicaid Home Care & Personal Assistance Services)\s*",
        "",
        label,
        flags=re.I,
    ).strip()
    if not label or len(label) > 80:
        # County headings place the location before the service phrase.
        label = path.stem.replace("-", " ").title()
    return label


def location_index() -> tuple[dict[str, str], dict[str, str]]:
    labels = {path.stem: label_for(path) for path in sorted(LOCATIONS.glob("*.html"))}
    group_for: dict[str, str] = {}
    for group, slugs in LOCATION_GROUPS.items():
        for slug in slugs:
            if slug in group_for:
                raise RuntimeError(f"duplicate location profile: {slug}")
            group_for[slug] = group
    if set(labels) != set(group_for):
        raise RuntimeError(
            f"location profile drift: missing={sorted(set(labels) - set(group_for))} "
            f"extra={sorted(set(group_for) - set(labels))}"
        )
    return labels, group_for


def nearby_slugs(slug: str, group: str, all_slugs: tuple[str, ...]) -> tuple[str, ...]:
    peers = [item for item in LOCATION_GROUPS[group] if item != slug]
    if len(peers) >= 4:
        offset = LOCATION_GROUPS[group].index(slug) % len(peers)
        return tuple((peers * 2)[offset : offset + 4])
    # Small county groups link to other published county hubs without implying
    # that they are geographically adjacent.
    excluded = {slug, *peers}
    county_hubs = [item for item in all_slugs if item.endswith("-county") and item not in excluded]
    offset = list(LOCATION_GROUPS).index(group) % len(county_hubs)
    rotated_hubs = (county_hubs * 2)[offset : offset + 4]
    return tuple((peers + rotated_hubs)[:4])


def local_context(slug: str, label: str, group: str, labels: dict[str, str]) -> str:
    peers = nearby_slugs(slug, group, tuple(labels))
    links = "".join(
        f'<li><a href="/locations/{peer}">{html.escape(labels[peer])}</a></li>' for peer in peers
    )
    return f'''<!-- local-context:start -->
<div class="local-context" data-location-profile="{html.escape(slug)}">
<h2>Service-area context for {html.escape(label)}</h2>
<p>{html.escape(GROUP_NOTES[group])}</p>
<p>Primetime provides non-medical personal assistance services rather than skilled nursing or medical treatment. Support may include authorized help with personal care, activities of daily living, respite, routine household tasks, and medication reminders. The member’s program and service plan determine which tasks and hours are approved.</p>
<div class="grid grid-2">
<article class="card"><h3>What controls availability in {html.escape(label)}</h3><p>Current service depends on the exact ZIP code, requested non-medical service, member eligibility, payer participation, authorization, and caregiver availability. A published location page does not guarantee immediate placement or a specific number of service hours.</p></article>
<article class="card"><h3>What to share with the Houston office</h3><p>To request a local availability check, provide the {html.escape(label)} ZIP code, the member’s health plan or program, whether an authorization already exists, and the everyday activities where assistance is requested. Health details are not needed for an initial website or phone inquiry.</p></article>
</div>
<h2>Other published service areas to review</h2>
<p>Families comparing service-area information can also review these pages from Primetime’s current eleven-county inventory:</p>
<ul class="service-list local-nearby-links">{links}</ul>
<h2>Check service availability in {html.escape(label)}</h2>
<p>Call <a class="phone-link" href="tel:7139777721">713-977-7721</a> or use the <a href="/home-care-contact-us">Get Started page</a>. Primetime will confirm whether the requested location, service, payer, authorization, and current staffing can be supported before onboarding proceeds.</p>
</div>
<!-- local-context:end -->'''


def main() -> None:
    labels, group_for = location_index()
    changed = 0
    for path in sorted(LOCATIONS.glob("*.html")):
        slug = path.stem
        text = path.read_text(errors="strict")
        text = re.sub(
            r"\s*<!-- local-context:start -->[\s\S]*?<!-- local-context:end -->\s*",
            "\n",
            text,
            flags=re.I,
        )
        module = local_context(slug, labels[slug], group_for[slug], labels)
        updated, count = re.subn(r'(<div class="faq">)', module + r"\n\1", text, count=1)
        if count != 1:
            raise RuntimeError(f"missing FAQ insertion point: {path.name}")
        if updated != path.read_text(errors="strict"):
            path.write_text(updated)
            changed += 1
    print(f"Location content quality: {len(labels)} profiles; {changed} pages changed.")


if __name__ == "__main__":
    main()
