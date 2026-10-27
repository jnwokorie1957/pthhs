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
                         'datetime="2026-10-27"', 'Published by Robert, AI CTO of Primetime Home Health Services',
                         'href="https://pthhs.net/articles/synthetic-fixture"', 'href="/home-care-blog"'):
            self.assertIn(expected, page)
        self.assertNotIn('reviewedBy', page)
        self.assertNotIn('Person', page)
        self.assertNotIn('Prepared with AI drafting assistance.', page)
        self.assertNotIn('RidePrimetime', page)

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

    def test_registry_index_lists_all_published_entries_excluding_drafts(self):
        import tempfile
        from pthhs_articles import render_article_index
        with tempfile.TemporaryDirectory(dir=ROOT, prefix="article-test-") as temp:
            root = Path(temp)
            records = []
            for slug in ('first-fixture', 'second-fixture'):
                record = {'slug': slug, 'title': slug, 'seo_title': slug, 'description': 'Synthetic only',
                          'published': '2026-10-27', 'research_checked': '2026-10-27', 'status': 'published'}
                records.append(record)
                (root / (slug + '.md')).write_text('# ' + slug + '\n\nSynthetic body.', encoding='utf-8')
            # Deliberately no draft/quarantined body files: these must never be loaded.
            records.extend([{'slug': 'draft-fixture', 'status': 'draft'}, {'slug': 'legacy-fixture', 'status': 'quarantined'}])
            (root / 'manifest.json').write_text(json.dumps(records), encoding='utf-8')
            articles = approved_articles(root)
            self.assertEqual(len(articles), 2)
            index = render_article_index(articles)
            for slug in ('first-fixture', 'second-fixture'):
                self.assertEqual(index.count('href="/articles/' + slug + '"'), 1)
            self.assertNotIn('draft-fixture', index)
            self.assertNotIn('legacy-fixture', index)
            self.assertIn('No articles are currently published.', render_article_index(()))
            records.append({'slug': 'unclear', 'status': 'unknown'})
            (root / 'manifest.json').write_text(json.dumps(records), encoding='utf-8')
            with self.assertRaises(ValueError):
                approved_articles(root)

    def test_navigation_is_idempotent_and_preserves_other_content(self):
        from sync_article_navigation import sync_navigation, NAV
        from pthhs_shell import header_markup
        old = header_markup('Resources').replace('<a href="/articles">Articles</a>', '') + '<main>Unchanged</main>'
        new = sync_navigation(old)
        self.assertEqual(new.count('href="/articles"'), 1)
        self.assertEqual(NAV.sub('', old), NAV.sub('', new))
        self.assertEqual(sync_navigation(new), new)
        article = sync_navigation(new, True)
        self.assertIn('href="/articles" aria-current="page"', article)
        self.assertNotIn('href="/home-care-resources" aria-current="page"', article)
        self.assertIn('href="/home-care-services"', article)
        self.assertIn('href="/home-care-resources"', article)
        # Existing mobile controller operates on this same nav, not a separate link list.
        mobile = (ROOT / 'public/assets/site-enhancements.js').read_text(encoding='utf-8')
        self.assertIn("navWrap.querySelector(':scope > .site-nav')", mobile)

    def test_unregistered_generated_article_requires_explicit_review(self):
        import tempfile
        from build_articles import validate_article_outputs
        with tempfile.TemporaryDirectory(dir=ROOT, prefix="article-test-") as temp:
            directory = Path(temp)
            validate_article_outputs(directory, (BASE,))
            (directory / 'synthetic-fixture.html').write_text('synthetic', encoding='utf-8')
            validate_article_outputs(directory, (BASE,))
            (directory / 'old-draft.html').write_text('synthetic', encoding='utf-8')
            with self.assertRaisesRegex(ValueError, 'Unregistered article outputs'):
                validate_article_outputs(directory, (BASE,))
            self.assertTrue((directory / 'old-draft.html').exists())

    def test_generated_index_navigation_and_canonical(self):
        page = (ROOT / 'public/articles.html').read_text(encoding='utf-8')
        self.assertEqual(re.findall(r'property="og:type" content="([^"]+)"', page), ['website'])
        self.assertEqual(page.count('<h1>'), 1)
        self.assertIn('href="https://pthhs.net/articles"', page)
        self.assertIn('href="/home-care-blog"', page)
        self.assertIn('href="/articles" aria-current="page"', page)
        for article in approved_articles():
            self.assertEqual(page.count('href="' + article.path + '"'), 1)
            article_page = (ROOT / 'public' / (article.path.lstrip('/') + '.html')).read_text(encoding='utf-8')
            self.assertEqual(re.findall(r'property="og:type" content="([^"]+)"', article_page), ['article'])

    def test_only_exact_approved_internal_citations_are_exempt(self):
        from pthhs_articles import is_approved_internal_citation
        article = next(a for a in approved_articles() if a.slug == "why-healthcare-ai-should-learn-from-mistakes")
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
        article = next(a for a in approved_articles() if a.slug == "why-healthcare-ai-should-learn-from-mistakes")
        source = ROOT / 'content/articles' / (article.slug + '.md')
        self.assertEqual(hashlib.sha256(source.read_bytes()).hexdigest(), '23d5f3fa85f16d5ef06ffc767762517de26e82411333eb20d026c713562f9462')
        page = (ROOT / 'public' / (article.path.lstrip('/') + '.html')).read_text(encoding='utf-8')
        body = re.search(r'<div data-article-body>(.*?)</div>', page, re.S).group(1)
        self.assertEqual(page.count('Published by Robert, AI CTO of Primetime Home Health Services'), 1)
        self.assertNotIn('RidePrimetime', page)
        self.assertNotIn('Prepared with AI drafting assistance.', page)
        self.assertEqual(plaintext(body), plaintext(render_body(article.body)))
        for url in re.findall(r'\]\((https://[^)]+)\)', article.body):
            self.assertIn('href="' + url + '"', body)
        self.assertNotIn('not yet published', page)
        self.assertNotIn('clinical reviewer', page)
        self.assertEqual(page.count('<h1>'), 1)

    def test_schema_metadata_and_breadcrumb_match_visible_content(self):
        article = next(a for a in approved_articles() if a.slug == "why-healthcare-ai-should-learn-from-mistakes")
        page = (ROOT / 'public' / (article.path.lstrip('/') + '.html')).read_text(encoding='utf-8')
        graph = json.loads(re.search(r'<script type="application/ld\+json">(.*?)</script>', page, re.S).group(1))['@graph']
        schema, = [x for x in graph if x['@type'] == 'Article']
        self.assertEqual(schema, article.schema())
        self.assertEqual(schema['author']['@type'], 'Organization')
        for forbidden in ['reviewedBy', 'review', 'aggregateRating', 'image']:
            self.assertNotIn(forbidden, schema)
        breadcrumb, = [x for x in graph if x['@type'] == 'BreadcrumbList']
        self.assertEqual([x['name'] for x in breadcrumb['itemListElement']], ['Home', 'Articles', article.title])
        self.assertIn('<title>' + article.seo_title + '</title>', page)
        self.assertIn('property="og:type" content="article"', page)
        self.assertIn('href="/articles" aria-current="page"', page)
        self.assertIn('<li><a href="/articles">Articles</a></li>', page)

    def test_guide_and_sitemap_include_only_new_reviewed_article(self):
        article = next(a for a in approved_articles() if a.slug == "why-healthcare-ai-should-learn-from-mistakes")
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
