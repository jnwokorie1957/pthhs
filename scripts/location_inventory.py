#!/usr/bin/env python3
"""Inventory existing location pages without changing publication or indexing."""
import csv
import html
import re
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / 'public'


def inventory():
    sitemap = {node.text for node in ET.parse(PUBLIC / 'sitemap.xml').iter()
               if node.tag.endswith('}loc')}
    rows = []
    for page in sorted((PUBLIC / 'locations').glob('*.html')):
        text = page.read_text(encoding='utf-8')
        def extract(pattern):
            match = re.search(pattern, text, re.I | re.S)
            return html.unescape(re.sub('<[^>]+>', '', match.group(1))).strip() if match else ''
        canonical = extract(r'<link\s+rel="canonical"[^>]*href="([^"]+)')
        robots = extract(r'<meta\s+name="robots"[^>]*content="([^"]+)')
        main = re.search(r'<main\b[^>]*>(.*?)</main>', text, re.S)
        content = main.group(1) if main else ''
        rows.append(dict(route='/locations/' + page.stem,
                         title=extract(r'<title>(.*?)</title>'),
                         h1=extract(r'<h1[^>]*>(.*?)</h1>'), canonical=canonical,
                         robots=robots or 'no explicit directive',
                         in_sitemap=str(canonical in sitemap).lower(),
                         main_words=len(re.sub('<[^>]+>', ' ', content).split()),
                         attendant_link=str('href="/home-care-services/attendant-care-services"' in content).lower(),
                         eligibility_link=str('href="/home-care-insurance"' in content).lower()))
    return rows, sitemap


if __name__ == '__main__':
    rows, sitemap = inventory()
    destination = ROOT / 'docs/seo/location-inventory.csv'
    with destination.open('w', encoding='utf-8', newline='') as stream:
        writer = csv.DictWriter(stream, fieldnames=list(rows[0]), lineterminator='\n')
        writer.writeheader()
        writer.writerows(rows)
    print(f'{len(rows)} location pages; {len(sitemap)} sitemap URLs; '
          f'{sum(row["in_sitemap"] == "true" for row in rows)} location URLs in sitemap. '
          'No indexing or publication settings changed.')
