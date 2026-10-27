"""Generate only explicitly approved original articles; no legacy restoration."""
from pthhs_articles import ROOT, approved_articles, render_article, render_article_index


def validate_article_outputs(directory, articles):
    expected = {article.slug + '.html' for article in articles}
    unexpected = {path.relative_to(directory).as_posix() for path in directory.rglob('*.html')} - expected
    if unexpected:
        raise ValueError('Unregistered article outputs require explicit reviewed removal: ' + ', '.join(sorted(unexpected)))


def main():
    articles = approved_articles()
    validate_article_outputs(ROOT / 'public/articles', articles)
    (ROOT / 'public/articles.html').write_text(render_article_index(articles), encoding='utf-8', newline='\n')
    for article in articles:
        target = ROOT / 'public' / (article.path.lstrip('/') + '.html')
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(render_article(article), encoding='utf-8', newline='\n')
        print('Generated article: ' + article.path)


if __name__ == '__main__':
    main()
