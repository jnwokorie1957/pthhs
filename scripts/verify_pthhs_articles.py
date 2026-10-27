"""Synthetic renderer and published-article preservation regressions."""
import hashlib
from html.parser import HTMLParser
from html import unescape
import json
from pathlib import Path
import re
import unittest
from dataclasses import replace
from pthhs_articles import Article, ROOT, approved_articles, render_article, render_article_card, render_body, PUBLISHER

BASE = Article('synthetic-fixture', 'Synthetic title', 'Synthetic SEO title', 'Synthetic description',
               '2026-10-27', '2026-10-27', 'Synthetic paragraph.\n\n## Synthetic section\n\nMore text.')


class Text(HTMLParser):
    def __init__(self):
        super().__init__(); self.parts = []
    def handle_data(self, data):
        self.parts.append(data)
    def normalized(self):
        return ' '.join(''.join(self.parts).split())


def plaintext(value):
    parser = Text(); parser.feed(value); return parser.normalized()


class ArticleTests(unittest.TestCase):
    def test_accessible_shell_and_company_attribution(self):
        page = render_article(BASE)
        self.assertEqual(page.count('<h1>'), 1)
        for expected in ('href="#main-content"', 'aria-label="Breadcrumb"', PUBLISHER,
                         'datetime="2026-10-27"', 'AI drafting assistance',
                         'href="https://pthhs.net/articles/synthetic-fixture"', 'href="/home-care-blog"'):
            self.assertIn(expected, page)
        self.assertNotIn('reviewedBy', page)
        self.assertNotIn('Person', page)

    def test_card_has_descriptive_link_and_same_route(self):
        self.assertIn('href="/articles/synthetic-fixture">Synthetic title</a>', render_article_card(BASE))

    def test_escape_and_semantic_markdown(self):
        page = render_body('<script>not executable</script>\n\n## A & B\n\n- **First**\n- [Second](https://example.org/)')
        self.assertIn('&lt;script&gt;not executable&lt;/script&gt;', page)
        self.assertIn('<h2>A &amp; B</h2>', page)
        self.assertIn('<ul><li><strong>First</strong></li>', page)
        self.assertIn('<a href="https://example.org/">Second</a>', page)

    def test_reject_invalid_metadata_and_incomplete_content(self):
        for changes in ({'slug': '../escape'}, {'slug': 'a/b'}, {'title': '</script>'},
                        {'description': ''}, {'published': '20261027'}, {'modified': '2026-10-26'},
                        {'research_checked': '2026-10-28'}, {'body': ''},
                        {'body': '[Bad](javascript:alert)'}, {'body': '[Bad](https://user:password@example.org)'},
                        {'body': '# Second H1'}, {'body': '- item\nnot a list item'}):
            with self.subTest(changes=changes), self.assertRaises(ValueError):
                render_article(replace(BASE, **changes))

    def test_only_exact_approved_internal_citations_are_exempt(self):
        from pthhs_articles import is_approved_internal_citation
        article, = approved_articles()
        href = 'https://pthhs.net/home-care-services/personal-care'
        self.assertTrue(is_approved_internal_citation(article.path, href))
        for route, target in [('/home-care-blog', href), (article.path, href + '.html'),
                              (article.path, href + '?x=1'), (article.path, href.replace('https:', 'http:')),
                              (article.path, href.replace('pthhs.net', 'www.pthhs.net')),
                              (article.path, 'https://pthhs.net/other')]:
            self.assertFalse(is_approved_internal_citation(route, target))

    def test_update_date_only_when_explicit(self):
        self.assertNotIn('Updated <time', render_article(BASE))
        self.assertNotIn('dateModified', BASE.schema())
        self.assertIn('Updated <time datetime="2026-10-28">', render_article(replace(BASE, modified='2026-10-28')))

    def test_exact_approved_body_and_citations_survive_generation(self):
        article, = approved_articles()
        source = ROOT / 'content/articles' / (article.slug + '.md')
        self.assertEqual(hashlib.sha256(source.read_bytes()).hexdigest(), '23d5f3fa85f16d5ef06ffc767762517de26e82411333eb20d026c713562f9462')
        page = (ROOT / 'public' / (article.path.lstrip('/') + '.html')).read_text(encoding='utf-8')
        body = re.search(r'<div data-article-body>(.*?)</div>', page, re.S).group(1)
        self.assertEqual(plaintext(body), plaintext(render_body(article.body)))
        for url in re.findall(r'\]\((https://[^)]+)\)', article.body):
            self.assertIn('href="' + url + '"', body)
        self.assertNotIn('not yet published', page)
        self.assertNotIn('clinical reviewer', page)
        self.assertEqual(page.count('<h1>'), 1)

    def test_schema_metadata_and_breadcrumb_match_visible_content(self):
        article, = approved_articles()
        page = (ROOT / 'public' / (article.path.lstrip('/') + '.html')).read_text(encoding='utf-8')
        graph = json.loads(re.search(r'<script type="application/ld\+json">(.*?)</script>', page, re.S).group(1))['@graph']
        schema, = [x for x in graph if x['@type'] == 'Article']
        self.assertEqual(schema, article.schema())
        self.assertEqual(schema['author']['@type'], 'Organization')
        for forbidden in ['reviewedBy', 'review', 'aggregateRating', 'image']:
            self.assertNotIn(forbidden, schema)
        breadcrumb, = [x for x in graph if x['@type'] == 'BreadcrumbList']
        self.assertEqual([x['name'] for x in breadcrumb['itemListElement']], ['Home', 'Home Care Guide', article.title])
        self.assertIn('<title>' + article.seo_title + '</title>', page)
        self.assertIn('property="og:type" content="article"', page)
        self.assertIn('href="/home-care-resources" aria-current="page"', page)
        self.assertIn('<li><a href="/home-care-blog">Home Care Guide</a></li>', page)

    def test_guide_and_sitemap_include_only_new_reviewed_article(self):
        article, = approved_articles()
        guide = (ROOT / 'public/home-care-blog.html').read_text(encoding='utf-8')
        self.assertEqual(guide.count('href="' + article.path + '"'), 1)
        self.assertIn('No imported article is currently retained', guide)
        self.assertIn('href="/home-care-resources" aria-current="page"', guide)
        sitemap = (ROOT / 'public/sitemap.xml').read_text()
        self.assertEqual(sitemap.count('https://pthhs.net' + article.path), 1)
        from batch_a_config import BLOG_SLUGS
        for slug in BLOG_SLUGS:
            self.assertNotIn('<loc>https://pthhs.net/' + slug + '</loc>', sitemap)


if __name__ == '__main__':
    unittest.main()
