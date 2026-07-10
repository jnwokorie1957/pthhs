#!/bin/bash
# Post-process crawled pages: download assets, rewrite links, mark forms

set -e

TARGET_DIR="/root/.openclaw/workspace/pthhs/extracted/www.pthhs.net"
BASE_URL="https://www.pthhs.net"

echo "=== Post-Processing PTHHS Pages ==="

# Create asset directories
mkdir -p "$TARGET_DIR/wp-content"
mkdir -p "$TARGET_DIR/wp-includes"

# Download wp-content assets
echo "Downloading wp-content assets..."
cd "$TARGET_DIR"

# Extract all unique asset URLs from all HTML files
TEMP_ASSETS=$(mktemp)
for html in *.html; do
    grep -oE '(href|src|data-src)=["'\''][^"'\'' ]+\.(css|js|png|jpg|jpeg|gif|svg|woff|woff2|ttf|eot|ico)["'\'']' "$html" 2>/dev/null | \
        sed -E 's/^(href|src|data-src)=["'\'']//;s/["'\'']$//' | \
        grep -vE '^data:|javascript:|#' | \
        grep -E '^wp-content|^/wp-content' >> "$TEMP_ASSETS" || true
done

sort -u "$TEMP_ASSETS" | while read -r asset; do
    # Normalize path (remove leading /)
    asset_clean="${asset#/}"
    
    dest_file="$TARGET_DIR/$asset_clean"
    dest_dir=$(dirname "$dest_file")
    
    if [[ ! -f "$dest_file" ]]; then
        mkdir -p "$dest_dir"
        echo "  Fetching: $asset_clean"
        if curl -sL "$BASE_URL/$asset_clean" -o "$dest_file" 2>/dev/null; then
            echo "    ✓ Saved"
        else
            echo "    ✗ Failed"
        fi
    fi
done
rm -f "$TEMP_ASSETS"

echo ""
echo "Downloading wp-includes assets..."
TEMP_INCLUDES=$(mktemp)
for html in *.html; do
    grep -oE '(href|src)=["'\''][^"'\'' ]+wp-includes[^"'\'' ]+["'\'']' "$html" 2>/dev/null | \
        sed -E 's/^(href|src)=["'\'']//;s/["'\'']$//' | \
        grep -vE '^data:|javascript:|#' >> "$TEMP_INCLUDES" || true
done

sort -u "$TEMP_INCLUDES" | while read -r asset; do
    asset_clean="${asset#/}"
    dest_file="$TARGET_DIR/$asset_clean"
    dest_dir=$(dirname "$dest_file")
    
    if [[ ! -f "$dest_file" ]]; then
        mkdir -p "$dest_dir"
        echo "  Fetching: $asset_clean"
        if curl -sL "$BASE_URL/$asset_clean" -o "$dest_file" 2>/dev/null; then
            echo "    ✓ Saved"
        else
            echo "    ✗ Failed"
        fi
    fi
done
rm -f "$TEMP_INCLUDES"

echo ""
echo "Rewriting remaining external links to relative..."

# Rewrite any remaining absolute pthhs.net URLs to relative
for html in *.html; do
    # Absolute URLs to relative (strip domain)
    sed -i 's|https\?://www\.pthhs\.net/|./|g' "$html"
    sed -i 's|https\?://pthhs\.net/|./|g' "$html"
    
    # Fix ./ to proper relative for subpages
    # This is simplified - proper relative path calculation is complex for nested pages
done

echo "Marking forms with TODO comments..."

# Mark all forms
for html in *.html; do
    # Create temp file with TODO comments before forms
    awk '
        BEGIN { in_form = 0 }
        /<form[ >]/ && !in_form {
            print "    <!-- TODO: Firebase migration - form requires backend integration -->"
            in_form = 1
        }
        /<\/form>/ { in_form = 0 }
        { print }
    ' "$html" > "$html.tmp" && mv "$html.tmp" "$html"
done

echo ""
echo "Creating crawl-report.json with asset counts..."

# Count assets per page and update report
ASSET_REPORT=$(mktemp)
echo '{"pages":[' > "$ASSET_REPORT"

first=true
for html in $(ls *.html | sort); do
    if [[ "$first" != "true" ]]; then
        echo ',' >> "$ASSET_REPORT"
    fi
    first=false
    
    # Count local asset references
    asset_count=$(grep -oE '(href|src)=["'\''][^"'\'' ]+(css|js|png|jpg|jpeg|gif|svg|woff)["'\'']' "$html" 2>/dev/null | wc -l)
    form_count=$(grep -c 'TODO: Firebase' "$html" 2>/dev/null || echo 0)
    
    echo "  {\"file\":\"$html\",\"local_assets\":$asset_count,\"forms_marked\":$form_count}" >> "$ASSET_REPORT"
done

echo ']}' >> "$ASSET_REPORT"

# Merge with existing report
if [[ -f "crawl-report.json" ]]; then
    jq -s '.[0] * .[1]' crawl-report.json "$ASSET_REPORT" > crawl-report.json.new && mv crawl-report.json.new crawl-report.json
else
    mv "$ASSET_REPORT" crawl-report.json
fi

echo ""
echo "=== Post-Processing Complete ==="
echo "Assets downloaded to wp-content/ and wp-includes/"
echo "Forms marked with Firebase TODO comments"
echo "Report updated: crawl-report.json"