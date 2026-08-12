#!/usr/bin/env python3
"""Repair local image references and recover missing assets from the old PTHHS origin.

This scans every HTML/CSS/JS file under public/, canonicalizes internal image
references to root-relative URLs, reuses uniquely matching local files when a
reference points to the wrong directory, and downloads genuinely missing image
assets from the supplied origin.
"""

from __future__ import annotations

import argparse
import html
import json
import posixpath
import re
import ssl
import sys
import urllib.error
import urllib.parse
import urllib.request
from collections import defaultdict
from pathlib import Path

IMAGE_EXTS = ("png", "jpg", "jpeg", "gif", "webp", "svg", "avif", "ico")
TEXT_EXTS = {".html", ".htm", ".css", ".js"}
INTERNAL_HOSTS = {"pthhs.net", "www.pthhs.net", "w13335.proweaversite13.com"}

# Match image-like URLs inside HTML attributes, srcset entries, CSS url(), and JS strings.
URL_RE = re.compile(
    r"(?P<url>(?:(?:https?:)?//[^\s\"'()<>,]+|(?:\.\.?/|/)?[^\s\"'()<>,]*?)"
    r"\.(?:png|jpe?g|gif|webp|svg|avif|ico)(?:\?[^\s\"'()<>,#]*)?(?:#[^\s\"'()<>,]*)?)",
    re.IGNORECASE,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--public", default="public", help="Firebase public directory")
    parser.add_argument("--origin", required=True, help="Old site origin, e.g. https://host.example.com")
    parser.add_argument(
        "--allow-invalid-tls",
        action="store_true",
        help="Allow the explicitly supplied legacy origin to be read despite an invalid TLS certificate chain",
    )
    return parser.parse_args()


def web_path_for(source: Path, public_dir: Path) -> str:
    rel = source.relative_to(public_dir).as_posix()
    return "/" + rel


def split_suffix(raw: str) -> tuple[str, str]:
    # Preserve query/fragment so cache-busting URLs keep their semantics.
    parsed = urllib.parse.urlsplit(raw)
    suffix = ""
    if parsed.query:
        suffix += "?" + parsed.query
    if parsed.fragment:
        suffix += "#" + parsed.fragment
    return parsed.path, suffix


def canonicalize(raw: str, source: Path, public_dir: Path) -> tuple[str | None, str]:
    """Return (canonical site-root path, query/fragment suffix)."""
    decoded = html.unescape(raw).replace("\\/", "/")
    if decoded.startswith(("data:", "blob:", "javascript:", "#")):
        return None, ""

    parsed = urllib.parse.urlsplit(decoded)
    if parsed.scheme in {"http", "https"} or decoded.startswith("//"):
        host = (parsed.hostname or "").lower()
        if host not in INTERNAL_HOSTS:
            return None, ""
        path = parsed.path
        suffix = ("?" + parsed.query if parsed.query else "") + ("#" + parsed.fragment if parsed.fragment else "")
    else:
        path, suffix = split_suffix(decoded)

    path = urllib.parse.unquote(path)

    # WordPress assets are site-root resources. This also repairs bad nested-page
    # references such as ./wp-content/... that otherwise resolve below the page.
    for marker in ("wp-content/", "wp-includes/"):
        idx = path.find(marker)
        if idx >= 0:
            canonical = "/" + path[idx:]
            canonical = "/" + posixpath.normpath(canonical).lstrip("/")
            return canonical, suffix

    if path.startswith("/"):
        canonical = "/" + posixpath.normpath(path).lstrip("/")
    else:
        base = web_path_for(source, public_dir)
        canonical = urllib.parse.urljoin(base, path)
        canonical = "/" + posixpath.normpath(canonical).lstrip("/")

    if canonical.startswith("/../") or canonical == "/..":
        return None, ""
    return canonical, suffix


def looks_like_image(data: bytes, content_type: str, suffix: str) -> bool:
    ct = (content_type or "").lower()
    if ct.startswith("image/"):
        return True
    head = data[:2048].lstrip()
    low = head.lower()
    if low.startswith((b"<!doctype html", b"<html", b"<head", b"<body")):
        return False
    ext = suffix.lower()
    if ext == ".svg":
        return b"<svg" in low
    signatures = (
        b"\x89PNG\r\n\x1a\n",
        b"\xff\xd8\xff",
        b"GIF87a",
        b"GIF89a",
        b"RIFF",
        b"\x00\x00\x01\x00",
    )
    return any(data.startswith(sig) for sig in signatures)


def fetch_asset(
    origin: str,
    canonical: str,
    target: Path,
    allow_invalid_tls: bool = False,
) -> tuple[bool, str]:
    encoded_path = urllib.parse.quote(canonical, safe="/%:@+~!$&'()*;=-._")
    url = origin.rstrip("/") + encoded_path
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (compatible; PTHHS-asset-recovery/1.0)",
            "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        },
    )
    context = ssl.create_default_context()
    if allow_invalid_tls:
        # This is deliberately scoped to the exact legacy origin passed on the
        # command line. The Proweaver preview host has an incomplete/invalid
        # certificate chain, but the public files still need to be recovered.
        context = ssl._create_unverified_context()

    try:
        with urllib.request.urlopen(req, timeout=30, context=context) as resp:
            data = resp.read()
            content_type = resp.headers.get("Content-Type", "")
            if not data:
                return False, "empty response"
            if not looks_like_image(data, content_type, target.suffix):
                return False, f"not an image ({content_type or 'unknown content type'})"
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
            return True, f"{len(data)} bytes"
    except urllib.error.HTTPError as exc:
        return False, f"HTTP {exc.code}"
    except urllib.error.URLError as exc:
        return False, f"URL error: {exc.reason}"
    except Exception as exc:  # noqa: BLE001 - report and continue through all assets.
        return False, f"{type(exc).__name__}: {exc}"


def main() -> int:
    args = parse_args()
    public_dir = Path(args.public).resolve()
    origin = args.origin.rstrip("/")
    if not public_dir.is_dir():
        print(f"ERROR: public directory not found: {public_dir}", file=sys.stderr)
        return 2

    image_files = [
        p for p in public_dir.rglob("*")
        if p.is_file() and p.suffix.lower().lstrip(".") in IMAGE_EXTS
    ]
    by_basename: dict[str, list[Path]] = defaultdict(list)
    for image in image_files:
        by_basename[image.name.lower()].append(image)

    text_files = [p for p in public_dir.rglob("*") if p.is_file() and p.suffix.lower() in TEXT_EXTS]
    recovered: list[dict[str, str]] = []
    reused: list[dict[str, str]] = []
    rewritten_files: set[str] = set()
    unresolved: dict[str, str] = {}
    seen_fetches: set[str] = set()

    for source in text_files:
        try:
            text = source.read_text(encoding="utf-8", errors="surrogateescape")
        except Exception as exc:  # noqa: BLE001
            print(f"WARN: cannot read {source}: {exc}")
            continue

        changed = False

        def replace_match(match: re.Match[str]) -> str:
            nonlocal changed
            raw = match.group("url")
            canonical, suffix = canonicalize(raw, source, public_dir)
            if canonical is None:
                return raw

            target = public_dir / canonical.lstrip("/")
            final_canonical = canonical

            if not target.is_file():
                # If a migration moved the same uniquely-named image elsewhere,
                # prefer the existing local file instead of duplicating it.
                candidates = by_basename.get(target.name.lower(), [])
                if len(candidates) == 1:
                    target = candidates[0]
                    final_canonical = "/" + target.relative_to(public_dir).as_posix()
                    reused.append({"from": canonical, "to": final_canonical})
                else:
                    key = canonical
                    if key not in seen_fetches:
                        seen_fetches.add(key)
                        ok, detail = fetch_asset(
                            origin,
                            canonical,
                            target,
                            allow_invalid_tls=args.allow_invalid_tls,
                        )
                        if ok:
                            by_basename[target.name.lower()].append(target)
                            recovered.append({"path": canonical, "detail": detail})
                            print(f"RECOVERED {canonical} ({detail})")
                        else:
                            unresolved[canonical] = detail
                            print(f"UNRESOLVED {canonical}: {detail}")
                    if not target.is_file():
                        # Do not make a bad reference look fixed if recovery failed.
                        return raw

            replacement = final_canonical + suffix
            # HTML entity escaping is unnecessary in quoted modern HTML URLs; keep
            # the root-relative URL straightforward and Firebase-safe.
            if replacement != html.unescape(raw).replace("\\/", "/"):
                changed = True
            return replacement

        new_text = URL_RE.sub(replace_match, text)
        if changed and new_text != text:
            source.write_text(new_text, encoding="utf-8", errors="surrogateescape")
            rewritten_files.add(source.relative_to(public_dir).as_posix())

    report = {
        "origin": origin,
        "allow_invalid_tls": args.allow_invalid_tls,
        "text_files_scanned": len(text_files),
        "image_files_present_before_scan": len(image_files),
        "files_rewritten": sorted(rewritten_files),
        "recovered": recovered,
        "reused_existing": reused,
        "unresolved": [{"path": k, "reason": v} for k, v in sorted(unresolved.items())],
    }
    print("\n=== IMAGE REPAIR SUMMARY ===")
    print(json.dumps(report, indent=2))
    print(
        f"SUMMARY: scanned={len(text_files)} rewritten={len(rewritten_files)} "
        f"recovered={len(recovered)} reused={len(reused)} unresolved={len(unresolved)}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
