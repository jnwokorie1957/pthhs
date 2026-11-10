"""Synchronize public links in the existing primary navigation."""
import re
from pathlib import Path
from site_scope import marketing_html_files

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / 'public'
NAV = re.compile(r'(<nav\b[^>]*class="site-nav"[^>]*>)(.*?)(</nav>)', re.S)
ARTICLE = re.compile(r'<a\b[^>]*href="/articles"[^>]*>Articles</a>')
RESOURCE = re.compile(r'<a\b[^>]*href="/home-care-resources"[^>]*>Resources</a>')
CAREGIVER_PORTAL = re.compile(r'<a\b[^>]*href="/caregiver"[^>]*>.*?</a>', re.S)
CONTACT = re.compile(r'<a\b[^>]*class="nav-cta"[^>]*>')


def sync_navigation(text: str, article_context: bool = False) -> str:
    def update(match):
        body = match[2]
        current = ' aria-current="page"' if article_context else ''
        link = f'<a href="/articles"{current}>Articles</a>'
        if article_context:
            body = RESOURCE.sub(lambda m: m[0].replace(' aria-current="page"', ''), body)
        if ARTICLE.search(body):
            body, count = ARTICLE.subn(link, body)
        else:
            body, count = RESOURCE.subn(lambda m: m[0] + link, body)
        if count != 1:
            raise ValueError('Expected exactly one primary Articles or Resources link')
        portal = '<a href="/caregiver">Caregiver Portal</a>'
        body = CAREGIVER_PORTAL.sub('', body)
        body, count = CONTACT.subn(lambda m: portal + m[0], body)
        if count != 1:
            raise ValueError('Expected one primary navigation contact button')
        return match[1] + body + match[3]
    result, count = NAV.subn(update, text)
    if count != 1:
        raise ValueError('Expected one shared primary navigation')
    return result


def main():
    for path in marketing_html_files(PUBLIC):
        context = path == PUBLIC / 'articles.html' or path.parent == PUBLIC / 'articles'
        text = path.read_text(encoding='utf-8')
        result = sync_navigation(text, context)
        if result != text:
            path.write_text(result, encoding='utf-8', newline='\n')
    print('Public primary navigation synchronized.')


if __name__ == '__main__':
    main()
