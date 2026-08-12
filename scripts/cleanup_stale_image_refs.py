#!/usr/bin/env python3
"""Clean up legacy image references that are 404 even on the old WordPress origin.

Kept as a repeatable safeguard for future static-site migration audits.
"""

from __future__ import annotations

import re
from pathlib import Path

PUBLIC = Path("public")


def replace_in_file(path: Path, transform) -> bool:
    text = path.read_text(encoding="utf-8", errors="surrogateescape")
    updated = transform(text)
    if updated == text:
        return False
    path.write_text(updated, encoding="utf-8", errors="surrogateescape")
    print(f"CLEANED {path.as_posix()}")
    return True


def main() -> int:
    changed = 0

    # The old markup asks for ftr-logo.png, which is gone on the Proweaver origin.
    # The same theme already contains the intended footer-logo.png asset locally.
    for rel in ("home-care-houston-texas.html", "templates/base.html"):
        path = PUBLIC / rel
        if path.exists():
            changed += replace_in_file(
                path,
                lambda text: text.replace("ftr-logo.png", "footer-logo.png"),
            )

    # bnr-overlay.png is a stale decorative overlay that 404s on the old origin.
    # Keep the banner itself and remove only the unavailable overlay image.
    style = PUBLIC / "wp-content/themes/primetimehomeie989/style.min.css"
    if style.exists():
        def clean_banner(text: str) -> str:
            return re.sub(
                r"background\s*:\s*url\([^)]*bnr-overlay\.png[^)]*\)[^;}]*",
                "background:none",
                text,
                flags=re.IGNORECASE,
            )
        changed += replace_in_file(style, clean_banner)

    # Owl Carousel's optional video play bitmap is also absent from the old site.
    # Remove that dead bitmap reference; normal carousel content remains unaffected.
    owl = PUBLIC / "wp-content/themes/primetimehomeie989/css/owl.carousel.min.css"
    if owl.exists():
        def clean_owl(text: str) -> str:
            return re.sub(
                r"background\s*:\s*url\([^)]*owl\.video\.play\.png[^)]*\)[^;}]*",
                "background:none",
                text,
                flags=re.IGNORECASE,
            )
        changed += replace_in_file(owl, clean_owl)

    # The Skitter round-skin sprite is missing, but its compatible default sprite
    # is present in the same theme image directory. Point the round skin to it.
    skitter = PUBLIC / "wp-content/themes/primetimehomeie989/css/skitter.styles.min.css"
    if skitter.exists():
        changed += replace_in_file(
            skitter,
            lambda text: text.replace("sprite-round.png", "sprite-default.png"),
        )

    print(f"STALE_REF_CLEANUP changed_files={changed}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
