#!/bin/bash
set -e
SITE=extracted/www.pthhs.net
echo "Replacing https://www.pthhs.net with ./ in all HTML files..."
find $SITE -name '*.html' -exec sed -i 's|https://www.pthhs.net/|./|g' {} +
find $SITE -name '*.html' -exec sed -i 's|https://www.pthhs.net"|./"|g' {} +
find $SITE -name '*.html' -exec sed -i 's|https://www.pthhs.net"|./index.html"|g' {} +
echo "Done. Verifying sample..."
grep -o 'https://www.pthhs.net' $SITE/home-care-about-us.html | wc -l || echo "0 matches left (good)"
