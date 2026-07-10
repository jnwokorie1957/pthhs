#!/bin/bash
# PTHHS Site Crawler
# Crawls target pages, inlines assets, rewrites links, marks forms

set -e

BASE_URL="https://www.pthhs.net"
TARGET_DIR="/root/.openclaw/workspace/pthhs/extracted/www.pthhs.net"
REPORT_FILE="$TARGET_DIR/crawl-report.json"

TARGET_PAGES=(
    "home-health-agency-in-houston-texas"
    "home-care-meet-our-staff"
    "home-care-services"
    "home-care-services/attendant-care-services"
    "home-care-services/respite-care"
    "home-care-careers"
    "home-care-resources"
    "home-care-insurance"
    "home-care-blog"
    "home-care-contact-us"
    "home-care-areas-we-serve"
    "home-care-about-us"
    "home-care-client-reviews"
    "home-care-set-an-appointment"
)

declare -A crawled_pages
declare -A asset_map
declare -a failed_pages

mkdir -p "$TARGET_DIR"

echo "=== PTHHS Crawl Starting ===" | tee -a "$TARGET_DIR/crawl.log"

# Function to sanitize filename from URL path
sanitize_filename() {
    local path="$1"
    # Remove leading/trailing slashes, replace internal slashes with dashes
    echo "$path" | sed 's|^/||;s|/$||;s|/|-|g'
}

# Function to extract assets from HTML
extract_assets() {
    local html_file="$1"
    local page_url="$2"
    
    # Extract CSS, JS, images, fonts from various attributes
    grep -oE '(href|src|data-src)=["'\''][^"'\'' ]+["'\'']' "$html_file" 2>/dev/null | \
        sed -E 's/^(href|src|data-src)=["'\'']//;s/["'\'']$//' | \
        grep -vE '^data:|javascript:|#' | \
        sort -u
}

# Function to download and save an asset
download_asset() {
    local asset_url="$1"
    local page_dir="$2"
    
    # Skip external domains we don't want to mirror (keep CDNs relative or note them)
    if [[ "$asset_url" =~ ^https?:// ]]; then
        # Check if it's on the same domain
        if [[ "$asset_url" =~ ^https?://www\.pthhs\.net ]]; then
            asset_url=$(echo "$asset_url" | sed 's|https\?://www\.pthhs\.net||')
        else
            # External asset - note it but don't download
            echo "$asset_url"
            return
        fi
    fi
    
    # Make absolute
    if [[ "$asset_url" != /* ]]; then
        asset_url="/$asset_url"
    fi
    
    local local_path="${asset_url#/}"
    local dest_dir="$TARGET_DIR/$(dirname "$local_path")"
    local dest_file="$TARGET_DIR/$local_path"
    
    mkdir -p "$dest_dir"
    
    if [[ ! -f "$dest_file" ]]; then
        echo "  Downloading: $asset_url" >&2
        if curl -sL "$BASE_URL$asset_url" -o "$dest_file" 2>/dev/null; then
            echo "$local_path"
        else
            echo "FAILED:$asset_url"
        fi
    else
        echo "$local_path"
    fi
}

# Function to rewrite asset URLs in HTML
rewrite_assets() {
    local html_file="$1"
    local temp_file="${html_file}.tmp"
    
    cp "$html_file" "$temp_file"
    
    # This is a simplified rewrite - full implementation would parse HTML properly
    # For now, we handle common patterns
    
    # CSS links
    sed -i 's|href="https\?://www\.pthhs\.net/|href="|g' "$temp_file"
    sed -i 's|href='\''https\?://www\.pthhs\.net/|href='\''|g' "$temp_file"
    
    # JS/src links
    sed -i 's|src="https\?://www\.pthhs\.net/|src="|g' "$temp_file"
    sed -i 's|src='\''https\?://www\.pthhs\.net/|src='\''|g' "$temp_file"
    
    # Remove protocol-relative URLs
    sed -i 's|src="//www\.pthhs\.net/|src="/|g' "$temp_file"
    sed -i 's|href="//www\.pthhs\.net/|href="/|g' "$temp_file"
    
    mv "$temp_file" "$html_file"
}

# Function to rewrite internal navigation links to .html
rewrite_nav_links() {
    local html_file="$1"
    
    # Target page patterns -> .html
    for page in "${TARGET_PAGES[@]}"; do
        # Full URL patterns
        sed -i "s|https\?://www\.pthhs\.net/$page[\"'\'' ]|${page}.html|g" "$html_file"
        sed -i "s|href=\"$page[\"'\'' ]|href=\"${page}.html|g" "$html_file"
        sed -i "s|href='$page[\"'\'' ]|href='${page}.html|g" "$html_file"
        
        # Relative patterns
        sed -i "s|href=\"/$page[\"'\'' ]|href=\"${page}.html|g" "$html_file"
        sed -i "s|href='/$page[\"'\'' ]|href='${page}.html|g" "$html_file"
    done
    
    # Handle index/home
    sed -i 's|href="https\?://www\.pthhs\.net/"|href="index.html"|g' "$html_file"
    sed -i "s|href='https\?://www\.pthhs\.net/'|href='index.html'|g" "$html_file"
}

# Function to mark forms with TODO comment
mark_forms() {
    local html_file="$1"
    local temp_file="${html_file}.tmp"
    
    # Add TODO comment before each form tag
    awk '
        /<form[ >]/ && !form_seen {
            print "    <!-- TODO: Firebase migration - form requires backend integration -->"
            form_seen=1
        }
        /<\/form>/ { form_seen=0 }
        { print }
    ' "$html_file" > "$temp_file"
    
    mv "$temp_file" "$html_file"
}

# Main crawl loop
crawl_report='{"crawl_started":"'$(date -Iseconds)'","pages":[],"summary":{}}'

for page_path in "${TARGET_PAGES[@]}"; do
    echo ""
    echo "Crawling: $page_path" | tee -a "$TARGET_DIR/crawl.log"
    
    local_filename=$(sanitize_filename "$page_path")
    if [[ "$local_filename" != *.html ]]; then
        local_filename="${local_filename}.html"
    fi
    
    output_file="$TARGET_DIR/$local_filename"
    page_url="$BASE_URL/$page_path"
    
    # Download page
    if curl -sL "$page_url" -o "$output_file" 2>/dev/null; then
        echo "  ✓ Downloaded: $local_filename ($(wc -c < "$output_file") bytes)" | tee -a "$TARGET_DIR/crawl.log"
        
        # Extract and note assets (for report)
        asset_count=$(extract_assets "$output_file" "$page_url" | wc -l)
        
        # Rewrite assets to relative paths
        rewrite_assets "$output_file"
        
        # Rewrite navigation links
        rewrite_nav_links "$output_file"
        
        # Mark forms
        mark_forms "$output_file"
        
        crawled_pages["$page_path"]="success"
        
        # Add to report
        crawl_report=$(echo "$crawl_report" | jq --arg path "$page_path" --arg file "$local_filename" --argjson assets "$asset_count" \
            '.pages += [{"path":$path,"file":$file,"status":"success","assets":$assets}]')
    else
        echo "  ✗ FAILED: $page_path" | tee -a "$TARGET_DIR/crawl.log"
        failed_pages+=("$page_path")
        crawled_pages["$page_path"]="failed"
        
        crawl_report=$(echo "$crawl_report" | jq --arg path "$page_path" \
            '.pages += [{"path":$path,"status":"failed"}]')
    fi
done

# Finalize report
success_count=${#crawled_pages[@]}
failed_count=${#failed_pages[@]}

crawl_report=$(echo "$crawl_report" | jq \
    --argjson total "$success_count" \
    --argjson failed "$failed_count" \
    --arg completed "$(date -Iseconds)" \
    '.summary.total_pages=$total | .summary.failed=$failed | .crawl_completed=$completed')

echo "$crawl_report" | jq '.' > "$REPORT_FILE"

echo ""
echo "=== Crawl Complete ===" | tee -a "$TARGET_DIR/crawl.log"
echo "Success: $success_count pages" | tee -a "$TARGET_DIR/crawl.log"
echo "Failed: $failed_count pages" | tee -a "$TARGET_DIR/crawl.log"
echo "Report: $REPORT_FILE" | tee -a "$TARGET_DIR/crawl.log"