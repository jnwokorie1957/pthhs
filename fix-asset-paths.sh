#!/bin/bash
# Fix relative asset paths in all HTML files under public/
# Converts wp-content/... → /wp-content/...
# Converts wp-includes/... → /wp-includes/...
# Converts css/... → /css/... (if present)
# Converts images/... → /images/... (if present)
# Converts ../... → /... where appropriate (conservative)
# Also fixes schema/og/canonical relative URLs

set -e

PUBLIC_DIR="/root/.openclaw/workspace/pthhs/public"

echo "Scanning for HTML files with relative asset paths..."

# Find all HTML files
HTML_FILES=$(find "$PUBLIC_DIR" -maxdepth 1 -name "*.html" -type f)

COUNT=0
for file in $HTML_FILES; do
    # Check if file needs fixing (has relative wp-content, wp-includes, etc. without leading /)
    if grep -qE 'href="(wp-content|wp-includes|css/|images/|\.\./)' "$file" 2>/dev/null || \
       grep -qE 'src="(wp-content|wp-includes|css/|images/|\.\./)' "$file" 2>/dev/null || \
       grep -qE 'content="(wp-content|wp-includes)' "$file" 2>/dev/null; then
        
        echo "Fixing: $(basename "$file")"
        
        # Fix href attributes
        sed -i 's|href="wp-content/|href="/wp-content/|g' "$file"
        sed -i 's|href="wp-includes/|href="/wp-includes/|g' "$file"
        sed -i 's|href="css/|href="/css/|g' "$file"
        sed -i 's|href="images/|href="/images/|g' "$file"
        
        # Fix src attributes
        sed -i 's|src="wp-content/|src="/wp-content/|g' "$file"
        sed -i 's|src="wp-includes/|src="/wp-includes/|g' "$file"
        sed -i 's|src="css/|src="/css/|g' "$file"
        sed -i 's|src="images/|src="/images/|g' "$file"
        
        # Fix content attributes (for meta tags, og:image, etc.)
        sed -i 's|content="wp-content/|content="/wp-content/|g' "$file"
        sed -i 's|content="wp-includes/|content="/wp-includes/|g' "$file"
        
        # Fix schema/og/canonical relative URLs like "home-care-services/respite-care.html" → "/home-care-services/respite-care.html"
        # But be careful not to break absolute URLs or anchors
        sed -i 's|url":"home-care-services/|url":"/home-care-services/|g' "$file"
        sed -i 's|url":"tips-for-choosing/|url":"/tips-for-choosing/|g' "$file"
        sed -i 's|url":"medication-management/|url":"/medication-management/|g' "$file"
        sed -i 's|url":"empathy-in-aging/|url":"/empathy-in-aging/|g' "$file"
        sed -i 's|url":"home-care-your-partner/|url":"/home-care-your-partner/|g' "$file"
        sed -i 's|url":"a-home-care-plan/|url":"/a-home-care-plan/|g' "$file"
        sed -i 's|url":"elderly-comfort/|url":"/elderly-comfort/|g' "$file"
        sed -i 's|url":"home-care-meet-our-staff/|url":"/home-care-meet-our-staff/|g' "$file"
        sed -i 's|url":"home-care-areas-we-serve/|url":"/home-care-areas-we-serve/|g' "$file"
        sed -i 's|url":"boosting-senior-safety/|url":"/boosting-senior-safety/|g' "$file"
        sed -i 's|url":"home-care-blog/|url":"/home-care-blog/|g' "$file"
        sed -i 's|url":"home-care-houston-texas/|url":"/home-care-houston-texas/|g' "$file"
        sed -i 's|url":"the-holistic-approach/|url":"/the-holistic-approach/|g' "$file"
        sed -i 's|url":"how-geriatric-care/|url":"/how-geriatric-care/|g' "$file"
        sed -i 's|url":"home-care-services/|url":"/home-care-services/|g' "$file"
        sed -i 's|url":"enhancing-senior-living/|url":"/enhancing-senior-living/|g' "$file"
        sed -i 's|url":"the-benefits-personal-assistance/|url":"/the-benefits-personal-assistance/|g' "$file"
        sed -i 's|url":"ensuring-home-care-safety/|url":"/ensuring-home-care-safety/|g' "$file"
        sed -i 's|url":"ensuring-medication-adherence/|url":"/ensuring-medication-adherence/|g' "$file"
        sed -i 's|url":"understanding-medicaid/|url":"/understanding-medicaid/|g' "$file"
        sed -i 's|url":"home-nursing-care/|url":"/home-nursing-care/|g' "$file"
        sed -i 's|url":"home-care-about-us/|url":"/home-care-about-us/|g' "$file"
        sed -i 's|url":"home-care-contact-us/|url":"/home-care-contact-us/|g' "$file"
        sed -i 's|url":"home-care-careers/|url":"/home-care-careers/|g' "$file"
        sed -i 's|url":"home-care-client-reviews/|url":"/home-care-client-reviews/|g' "$file"
        sed -i 's|url":"home-care-insurance/|url":"/home-care-insurance/|g' "$file"
        
        # Fix canonical href without leading /
        sed -i 's|href="home-care-services/|href="/home-care-services/|g' "$file"
        sed -i 's|href="tips-for-choosing/|href="/tips-for-choosing/|g' "$file"
        sed -i 's|href="medication-management/|href="/medication-management/|g' "$file"
        sed -i 's|href="empathy-in-aging/|href="/empathy-in-aging/|g' "$file"
        sed -i 's|href="home-care-your-partner/|href="/home-care-your-partner/|g' "$file"
        sed -i 's|href="a-home-care-plan/|href="/a-home-care-plan/|g' "$file"
        sed -i 's|href="elderly-comfort/|href="/elderly-comfort/|g' "$file"
        sed -i 's|href="home-care-meet-our-staff/|href="/home-care-meet-our-staff/|g' "$file"
        sed -i 's|href="home-care-areas-we-serve/|href="/home-care-areas-we-serve/|g' "$file"
        sed -i 's|href="boosting-senior-safety/|href="/boosting-senior-safety/|g' "$file"
        sed -i 's|href="home-care-blog/|href="/home-care-blog/|g' "$file"
        sed -i 's|href="home-care-houston-texas/|href="/home-care-houston-texas/|g' "$file"
        sed -i 's|href="the-holistic-approach/|href="/the-holistic-approach/|g' "$file"
        sed -i 's|href="how-geriatric-care/|href="/how-geriatric-care/|g' "$file"
        sed -i 's|href="enhancing-senior-living/|href="/enhancing-senior-living/|g' "$file"
        sed -i 's|href="the-benefits-personal-assistance/|href="/the-benefits-personal-assistance/|g' "$file"
        sed -i 's|href="ensuring-home-care-safety/|href="/ensuring-home-care-safety/|g' "$file"
        sed -i 's|href="ensuring-medication-adherence/|href="/ensuring-medication-adherence/|g' "$file"
        sed -i 's|href="understanding-medicaid/|href="/understanding-medicaid/|g' "$file"
        sed -i 's|href="home-nursing-care/|href="/home-nursing-care/|g' "$file"
        sed -i 's|href="home-care-about-us/|href="/home-care-about-us/|g' "$file"
        sed -i 's|href="home-care-contact-us/|href="/home-care-contact-us/|g' "$file"
        sed -i 's|href="home-care-careers/|href="/home-care-careers/|g' "$file"
        sed -i 's|href="home-care-client-reviews/|href="/home-care-client-reviews/|g' "$file"
        sed -i 's|href="home-care-insurance/|href="/home-care-insurance/|g' "$file"
        
        COUNT=$((COUNT + 1))
    fi
done

echo "Fixed $COUNT files."
echo "Done."