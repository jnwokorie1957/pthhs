"""Small, deterministic renderer for editorially approved company articles.

Supports only paragraphs, H2 sections, unordered lists, strong text and HTTPS
links. No HTML, arbitrary Markdown extensions, networking or publication side
 effects. The checked-in manifest is the explicit reviewed publication set.
"""
from dataclasses import dataclass
from datetime import date
from html import escape
import json
from pathlib import Path
import re
from urllib.parse import urlsplit
from pthhs_shell import HOST, render_page, section

ROOT = Path(__file__).resolve().parents[1]
PUBLISHER = "Primetime Home Health Services, Inc."


def iso_date(value: str) -> str:
    if date.fromisoformat(value).isoformat() != value:
        raise ValueError("Use an explicit ISO date")
    return value


def inline(text: str) -> str:
    """Escape all text and recognize only the reviewed inline subset."""
    pattern = re.compile(r'\[([^\[\]\n]+)\]\(([^\s()]+)\)|\*\*([^*\n]+)\*\*')
    result, end = [], 0
    for match in pattern.finditer(text):
        result.append(escape(text[end:match.start()]))
        label, url, strong = match.groups()
        if strong is not None:
            result.append('<strong>' + escape(strong) + '</strong>')
        else:
            parts = urlsplit(url)
            if parts.scheme != 'https' or not parts.hostname or parts.username or parts.password:
                raise ValueError('Article links must be public HTTPS URLs')
            result.append(f'<a href="{escape(url, quote=True)}">{escape(label)}</a>')
        end = match.end()
    result.append(escape(text[end:]))
    return ''.join(result)


def render_body(markdown: str) -> str:
    blocks = markdown.strip().split('\n\n')
    result = []
    for block in blocks:
        if block.startswith('## '):
            if '\n' in block:
                raise ValueError('Heading must be its own block')
            result.append('<h2>' + escape(block[3:]) + '</h2>')
        elif block.startswith('> '):
            if '\n' in block:
                raise ValueError('Quote must be one paragraph')
            result.append('<blockquote><p>' + inline(block[2:]) + '</p></blockquote>')
        elif block.startswith('- '):
            lines = block.splitlines()
            if any(not line.startswith('- ') for line in lines):
                raise ValueError('List items must each start with a dash')
            result.append('<ul>' + ''.join('<li>' + inline(line[2:]) + '</li>' for line in lines) + '</ul>')
        elif block.startswith('#'):
            raise ValueError('Only section H2 headings are supported in the article body')
        else:
            result.append('<p>' + inline(block) + '</p>')
    return ''.join(result)


@dataclass(frozen=True)
class Article:
    slug: str
    title: str
    seo_title: str
    description: str
    published: str
    research_checked: str
    body: str
    modified: str | None = None

    @property
    def path(self) -> str:
        return f'/articles/{self.slug}'

    def validate(self) -> None:
        if not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', self.slug):
            raise ValueError('Invalid article slug')
        for value in (self.title, self.seo_title, self.description):
            if not value.strip() or any(c in value for c in '<>'):
                raise ValueError('Metadata must be nonempty plain text')
        for value in (self.published, self.research_checked, self.modified or self.published):
            iso_date(value)
        if (self.modified or self.published) < self.published or self.research_checked > (self.modified or self.published):
            raise ValueError('Invalid publication/research/update ordering')
        if not self.body.strip():
            raise ValueError('Reviewed article body required')
        render_body(self.body)

    def schema(self) -> dict:
        self.validate()
        canonical = HOST + self.path
        organization = {'@type': 'Organization', 'name': PUBLISHER, 'url': HOST + '/'}
        result = {'@type': 'Article', '@id': canonical + '#article', 'url': canonical,
                  'headline': self.title, 'description': self.description,
                  'datePublished': self.published, 'author': organization,
                  'publisher': organization, 'mainEntityOfPage': {'@id': canonical + '#webpage'}}
        if self.modified:
            result['dateModified'] = self.modified
        return result


def approved_articles(content_dir: Path | None = None) -> tuple[Article, ...]:
    content_dir = content_dir or ROOT / 'content/articles'
    records = json.loads((content_dir / 'manifest.json').read_text(encoding='utf-8'))
    result = []
    for entry in records:
        record = dict(entry)
        status = record.pop('status', None)
        if status in {'draft', 'quarantined'}:
            continue
        if status != 'published':
            raise ValueError('Explicit article publication status required')
        slug = record['slug']
        if not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', slug):
            raise ValueError('Invalid article slug')
        text = (content_dir / (slug + '.md')).read_text(encoding='utf-8')
        heading, body = text.split('\n\n', 1)
        if heading != '# ' + record['title']:
            raise ValueError('Article heading and manifest disagree')
        article = Article(**record, body=body)
        article.validate()
        result.append(article)
    if len({a.slug for a in result}) != len(result):
        raise ValueError('Duplicate article route')
    return tuple(sorted(result, key=lambda a: (a.published, a.slug), reverse=True))


def render_article(article: Article) -> str:
    article.validate()
    metadata = ('<p>Published by Robert, AI CTO of Primetime Home Health Services</p>'
                f'<p>Published <time datetime="{article.published}">{article.published}</time>. '
                f'Research checked <time datetime="{article.research_checked}">{article.research_checked}</time>.')
    if article.modified and article.modified != article.published:
        metadata += f' Updated <time datetime="{article.modified}">{article.modified}</time>.'
    metadata += '</p>'
    body = section(f'<article class="content-wrap" aria-label="{escape(article.title, quote=True)}">{metadata}<div data-article-body>{render_body(article.body)}</div><p><a href="/articles">Browse all articles</a> · <a href="/home-care-blog">Return to the Home Care Guide</a></p></article>')
    return render_page(title=article.seo_title, description=article.description, path=article.path,
                       eyebrow='Company perspective', heading=article.title,
                       lead=article.description, body=body, current_nav='Articles').replace('property="og:type" content="website"', 'property="og:type" content="article"')


def render_article_card(article: Article) -> str:
    article.validate()
    return (f'<article class="card"><h2><a href="{article.path}">{escape(article.title)}</a></h2>'
            f'<p>{escape(article.description)}</p></article>')


def is_approved_internal_citation(route: str, href: str) -> bool:
    """Preserve reviewed source URLs without allowing alternate/noncanonical URLs."""
    parts = urlsplit(href)
    if parts.scheme != 'https' or parts.netloc != 'pthhs.net' or parts.query or parts.fragment or parts.path.endswith('.html'):
        return False
    return any(a.path == route and href in re.findall(r'\]\((https://[^)]+)\)', a.body) for a in approved_articles())


def render_article_index(articles: tuple[Article, ...]) -> str:
    cards = ''.join(render_article_card(article) for article in articles)
    listing = '<div class="grid grid-2">' + cards + '</div>' if cards else '<p>No articles are currently published.</p>'
    return render_page(title='Articles | Primetime Home Health Services',
                       description='Read published company perspectives on non-medical home care and responsible administrative technology from Primetime Home Health Services.',
                       path='/articles', eyebrow='Company perspectives', heading='Articles',
                       lead='Read our published articles. For practical service questions, use the Home Care Guide.',
                       body=section(listing + '<p><a href="/home-care-blog">Explore the Home Care Guide</a></p>'),
                       current_nav='Articles')
