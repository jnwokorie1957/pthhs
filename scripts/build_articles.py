"""Generate only explicitly approved original articles; no legacy restoration."""
from pthhs_articles import ROOT, approved_articles, render_article


def main():
    for article in approved_articles():
        target = ROOT / 'public' / (article.path.lstrip('/') + '.html')
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(render_article(article), encoding='utf-8', newline='\n')
        print('Generated article: ' + article.path)


if __name__ == '__main__':
    main()
