"""Regression checks for content-based sitemap dates and preserved publication scope."""
import json
from pathlib import Path
import unittest
import xml.etree.ElementTree as ET
from sitemap_dates import validated_dates
from seo_foundation import SITEMAP_ROUTES, HOST

ROOT = Path(__file__).resolve().parents[1]


class SitemapDatesTest(unittest.TestCase):
    def test_publication_scope_and_evidence(self):
        records = json.loads((ROOT / "docs/seo/sitemap-content-dates.json").read_text())
        dates = validated_dates(records, SITEMAP_ROUTES)
        rows = ET.parse(ROOT / "public/sitemap.xml").getroot()
        ns = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9"}
        self.assertEqual([row.findtext("s:loc", namespaces=ns) for row in rows],
                         [HOST + route for route in SITEMAP_ROUTES])
        self.assertEqual(len(rows), 27)
        for row, route in zip(rows, SITEMAP_ROUTES):
            self.assertEqual(row.findtext("s:lastmod", namespaces=ns), dates.get(route))

    def test_unknown_dates_stay_absent(self):
        self.assertEqual(validated_dates({}, SITEMAP_ROUTES), {})

    def test_unreviewed_route_and_missing_evidence_rejected(self):
        for records in ({"/invented": {"lastmod": "2026-10-01", "evidence": "review"}},
                        {"/": {"lastmod": "2026-10-01"}}):
            with self.assertRaises(ValueError):
                validated_dates(records, SITEMAP_ROUTES)

    def test_invalid_and_future_dates_rejected(self):
        for value in ("today", "2026-02-30", "9999-01-01", "2026-1-1", 123):
            with self.assertRaises(ValueError):
                validated_dates({"/": {"lastmod": value, "evidence": "review"}}, SITEMAP_ROUTES)


if __name__ == "__main__":
    unittest.main()
