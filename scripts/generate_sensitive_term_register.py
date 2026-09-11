#!/usr/bin/env python3
"""Generate the exhaustive Batch A sensitive-copy classification register."""

from __future__ import annotations

import csv
import re
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
TERMS = ["home health", "nursing", "nurse", "administer", "medical", "therapy", "diagnosis", "diagnose", "treatment", "medicare", "wound care"]


class TextNodes(HTMLParser):
    def __init__(self):
        super().__init__()
        self.nodes: list[str] = []
        self.ignored = 0

    def handle_starttag(self, tag, attrs):
        if tag in {"script", "style", "noscript"}:
            self.ignored += 1

    def handle_endtag(self, tag):
        if tag in {"script", "style", "noscript"} and self.ignored:
            self.ignored -= 1

    def handle_data(self, data):
        text = " ".join(data.split())
        if text and not self.ignored:
            self.nodes.append(text)


def classify(term: str, text: str, quarantined: bool) -> tuple[str, str]:
    low = text.lower()
    if quarantined:
        return "QUARANTINED", "Article is noindex and permanently redirected pending editorial review."
    if term == "home health" and "primetime home health services" in low:
        return "ALLOWED", "Legal business name."
    if "non-medical" in low or "does not" in low or "do not" in low or "different from" in low or "no emergency, medical" in low or "not skilled medical" in low:
        return "ALLOWED", "Explicit scope limitation or non-medical context."
    if term == "home health" and ("primetime home health" in low or low.endswith("home health care?") or low.startswith("looking for clinical home health")):
        return "ALLOWED", "Legal-name or explicit service-distinction context."
    if term in {"nursing", "nurse", "administer"} and low.endswith("?"):
        return "ALLOWED", "Scope FAQ question paired with a limiting answer on the same page."
    if term == "administer" and "administer requested services" in low:
        return "ALLOWED", "Ordinary operational verb; not medication administration."
    if "healthcare provider" in low or "licensed healthcare" in low or "physician" in low or "health plan" in low:
        return "EDUCATIONAL_WITH_CONTEXT", "Refers users to an external licensed provider, plan, or provider-established instruction."
    if term == "medical" and ("medicaid" in low or "medical assistance" in low):
        return "EDUCATIONAL_WITH_CONTEXT", "Public-program or eligibility context, not a PTHHS service claim."
    return "REVIEW_REQUIRED", "Potential service-scope ambiguity."


rows = []
from batch_a_config import BLOG_SLUGS
quarantined_files = {slug + ".html" for slug in BLOG_SLUGS}
for path in sorted(PUBLIC.rglob("*.html")):
    parser = TextNodes()
    parser.feed(path.read_text(errors="ignore"))
    rel = path.relative_to(PUBLIC).as_posix()
    for node_number, node in enumerate(parser.nodes, 1):
        low = node.lower()
        for term in TERMS:
            if term in low:
                status, rationale = classify(term, node, rel in quarantined_files)
                rows.append([rel, node_number, term, status, rationale, node[:500]])

out = ROOT / "PTHHS_SENSITIVE_TERM_REGISTER.csv"
with out.open("w", newline="", encoding="utf-8") as handle:
    writer = csv.writer(handle, lineterminator="\n")
    writer.writerow(["file", "text_node", "term", "classification", "rationale", "context"])
    writer.writerows(rows)

pending = sum(row[3] == "REVIEW_REQUIRED" for row in rows)
print(f"Wrote {len(rows)} classified occurrences to {out.name}; {pending} require review.")
raise SystemExit(1 if pending else 0)
