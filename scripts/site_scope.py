#!/usr/bin/env python3
"""Shared boundaries between the public marketing site and internal apps."""

from __future__ import annotations

from pathlib import Path


# Files below these public/ prefixes are deployed by Firebase Hosting, but they
# are not marketing pages and must not be rewritten by public-site generators.
INTERNAL_APP_PREFIXES = ("primetime/",)


def relative_public_path(path: Path, public_dir: Path) -> str:
    """Return a stable POSIX path relative to public/."""

    return path.relative_to(public_dir).as_posix()


def is_internal_app_path(path: Path, public_dir: Path) -> bool:
    """Return True when a deployed path belongs to an internal application."""

    relative = relative_public_path(path, public_dir)
    return any(relative.startswith(prefix) for prefix in INTERNAL_APP_PREFIXES)


def is_marketing_html(path: Path, public_dir: Path) -> bool:
    """Return True for HTML owned by the marketing-site build pipeline."""

    return path.suffix.lower() == ".html" and not is_internal_app_path(path, public_dir)


def marketing_html_files(public_dir: Path) -> list[Path]:
    """Return all marketing HTML files in deterministic order."""

    return [
        path
        for path in sorted(public_dir.rglob("*.html"))
        if is_marketing_html(path, public_dir)
    ]
