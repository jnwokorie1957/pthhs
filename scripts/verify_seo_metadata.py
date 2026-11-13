"""Regression checks for complete metadata in generated WebPage descriptions."""
import json
from pathlib import Path
import re
import tempfile
import unittest
from unittest.mock import patch

import seo_foundation as seo


class SeoMetadataTest(unittest.TestCase):
    def test_retired_careers_is_not_regenerated_as_marketing_or_promoted_in_sitemap(self):
        from site_scope import is_marketing_html, is_internal_app_path
        path = seo.PUBLIC / "home-care-careers.html"
        self.assertFalse(is_marketing_html(path, seo.PUBLIC))
        self.assertFalse(is_internal_app_path(path, seo.PUBLIC))
        self.assertNotIn("/home-care-careers", seo.SITEMAP_ROUTES)

    def test_redirect_expansion_preserves_retired_aliases_without_dotted_child(self):
        aliases = ["/home-care-careers", "/home-care-careers.html", "/home-care-careers/"]
        config = {"hosting": {"redirects": [
            {"source": source, "destination": "/caregiver", "type": 301}
            for source in aliases
        ]}}
        file = self.root / "firebase.json"
        file.write_text(json.dumps(config))
        seo.expand_redirects()
        rows = json.loads(file.read_text())["hosting"]["redirects"]
        for source in aliases:
            self.assertEqual([row for row in rows if row["source"] == source],
                             [{"source": source, "destination": "/caregiver", "type": 301}])
        self.assertNotIn("/home-care-careers/.html", [row["source"] for row in rows])
        self.assertTrue(any(row["source"] == "/houston-home-care.html" for row in rows))

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.public = self.root / "public"
        self.public.mkdir()
        self.path = self.public / "home-care-meet-our-staff.html"
        self.facts = json.loads((seo.ROOT / "PTHHS_PUBLIC_FACTS.json").read_text())
        self.staff = (seo.PUBLIC / self.path.name).read_text()
        for name, value in (("ROOT", self.root), ("PUBLIC", self.public)):
            context = patch.object(seo, name, value)
            context.start()
            self.addCleanup(context.stop)

    def generate(self, metadata):
        self.path.write_text(
            '<html><head><title>Staff &amp; Support</title>'
            '<link rel="canonical" href="https://pthhs.net/home-care-meet-our-staff">'
            + metadata + '</head><body><h1>Staff</h1></body></html>'
        )
        seo.process_html(self.path, self.facts)
        return self.webpage()

    def webpage(self):
        payload = re.search(
            r'<script type="application/ld\+json">(.*?)</script>',
            self.path.read_text(), re.S,
        ).group(1)
        return next(row for row in json.loads(payload)["@graph"] if row["@type"] == "WebPage")

    def test_double_quoted_attribute_with_apostrophe(self):
        page = self.generate('<meta name="description" content="Learn how Primetime\'s staff helps.">')
        self.assertEqual(page["description"], "Learn how Primetime's staff helps.")

    def test_single_quoted_attribute_with_double_quotes(self):
        page = self.generate("<meta name='description' content='Meet our \"care\" team.'>")
        self.assertEqual(page["description"], 'Meet our "care" team.')

    def test_html_entities(self):
        page = self.generate('<meta name="description" content="Care &amp; support for &#39;you&#39; &quot;today&quot;.">')
        self.assertEqual(page["description"], 'Care & support for \'you\' "today".')

    def test_multiline_metadata(self):
        page = self.generate('<META\n NAME="description"\n CONTENT="  Our\n staff\t helps.  ">')
        self.assertEqual(page["description"], "Our staff helps.")

    def test_absent_metadata(self):
        with self.assertRaisesRegex(RuntimeError, "missing description"):
            self.generate("")

    def test_default_capture_behavior(self):
        self.assertEqual(seo.head_value('<title> Care &amp; Support </title>',
                                      r'<title>(.*?)</title>', "title", self.path),
                         "Care & Support")
        page = self.generate('<meta name="description" content="Staff support">')
        self.assertEqual(page["name"], "Staff & Support")
        self.assertEqual(page["url"], "https://pthhs.net/home-care-meet-our-staff")

    def test_generated_staff_description(self):
        self.path.write_text(self.staff)
        seo.process_html(self.path, self.facts)
        from html.parser import HTMLParser

        class DescriptionParser(HTMLParser):
            description = None

            def handle_starttag(self, tag, attrs):
                values = dict(attrs)
                if tag == "meta" and values.get("name") == "description":
                    self.description = values.get("content")

        parser = DescriptionParser()
        parser.feed(self.staff)
        self.assertIn("Primetime's", parser.description)
        self.assertEqual(self.webpage()["description"], parser.description)

    def test_generation_is_idempotent(self):
        self.path.write_text(self.staff)
        seo.process_html(self.path, self.facts)
        first = self.path.read_bytes()
        seo.process_html(self.path, self.facts)
        self.assertEqual(self.path.read_bytes(), first)


if __name__ == "__main__":
    unittest.main()
