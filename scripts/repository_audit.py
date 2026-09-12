#!/usr/bin/env python3
"""Read-only integrity audit for every tracked PTHHS repository file."""

from __future__ import annotations

import csv
import hashlib
import json
import re
import subprocess
import sys
import zipfile
from collections import Counter, defaultdict
from html.parser import HTMLParser
from pathlib import Path, PurePosixPath
from urllib.parse import unquote, urlsplit
from xml.etree import ElementTree

from site_scope import is_internal_app_path, marketing_html_files


ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"

TEXT_SUFFIXES = {
    ".css",
    ".csv",
    ".html",
    ".js",
    ".json",
    ".md",
    ".mjs",
    ".py",
    ".sh",
    ".ts",
    ".txt",
    ".xml",
    ".yml",
    ".yaml",
}
TEXT_FILENAMES = {".editorconfig", ".firebaserc", ".gitattributes", ".gitignore"}
EXPECTED_SUFFIXES = TEXT_SUFFIXES | {".avif", ".png", ".webp", ".zip"}
FORBIDDEN_TRACKED_PARTS = {
    ".env",
    ".firebase",
    "__pycache__",
    "extracted",
    "lib",
    "node_modules",
}
IGNORED_URL_SCHEMES = {"data", "http", "https", "mailto", "sms", "tel"}
GENERATED_PUBLIC_PREFIXES = ("/assets/meta/",)
GENERATED_PUBLIC_PATHS = {"/site.webmanifest"}
SECRET_PATTERNS = {
    "private key": re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
    "GitHub token": re.compile(r"\bgh[pousr]_[A-Za-z0-9]{30,}\b"),
    "Google API key": re.compile(r"\bAIza[0-9A-Za-z_-]{30,}\b"),
    "Slack token": re.compile(r"\bxox[baprs]-[0-9A-Za-z-]{20,}\b"),
    "AWS access key": re.compile(r"\bAKIA[0-9A-Z]{16}\b"),
}

errors: list[str] = []
warnings: list[str] = []


def fail(message: str) -> None:
    errors.append(message)


def warn(message: str) -> None:
    warnings.append(message)


def tracked_paths() -> list[Path]:
    result = subprocess.run(
        ["git", "ls-files", "-z"],
        cwd=ROOT,
        check=True,
        capture_output=True,
    )
    return [ROOT / item.decode() for item in result.stdout.split(b"\0") if item]


def validate_text(path: Path, data: bytes) -> str | None:
    try:
        text = data.decode("utf-8")
    except UnicodeDecodeError as error:
        fail(f"non-UTF-8 tracked text: {path.relative_to(ROOT)} ({error})")
        return None
    if "\x00" in text:
        fail(f"NUL byte in tracked text: {path.relative_to(ROOT)}")
    if text and not text.endswith("\n") and path.suffix not in {".html", ".xml"}:
        warn(f"missing final newline: {path.relative_to(ROOT)}")
    return text


def validate_structured_file(path: Path, text: str) -> None:
    relative = path.relative_to(ROOT)
    try:
        if path.suffix == ".json" or path.name == ".firebaserc":
            json.loads(text)
        elif path.suffix == ".csv":
            rows = list(csv.reader(text.splitlines()))
            widths = {len(row) for row in rows}
            if len(widths) > 1:
                fail(f"inconsistent CSV column count: {relative} ({sorted(widths)})")
        elif path.suffix == ".xml":
            ElementTree.fromstring(text)
    except (csv.Error, json.JSONDecodeError, ElementTree.ParseError) as error:
        fail(f"invalid structured file: {relative} ({error})")


def validate_binary_file(path: Path, data: bytes) -> None:
    relative = path.relative_to(ROOT)
    if path.suffix == ".zip":
        try:
            with zipfile.ZipFile(path) as archive:
                bad_member = archive.testzip()
                if bad_member:
                    fail(f"corrupt ZIP member: {relative} -> {bad_member}")
        except zipfile.BadZipFile as error:
            fail(f"invalid ZIP archive: {relative} ({error})")
    elif path.suffix == ".png" and not data.startswith(b"\x89PNG\r\n\x1a\n"):
        fail(f"invalid PNG signature: {relative}")
    elif path.suffix == ".webp" and not (
        data.startswith(b"RIFF") and data[8:12] == b"WEBP"
    ):
        fail(f"invalid WebP signature: {relative}")
    elif path.suffix == ".avif" and b"ftypavif" not in data[:32]:
        fail(f"invalid AVIF signature: {relative}")


MARKDOWN_LINK = re.compile(r"(?<!!)\[[^\]]+\]\(([^)]+)\)")


def validate_markdown_links(path: Path, text: str) -> int:
    checked = 0
    for raw_target in MARKDOWN_LINK.findall(text):
        target = raw_target.strip().split(maxsplit=1)[0].strip("<>")
        parsed = urlsplit(target)
        if parsed.scheme in IGNORED_URL_SCHEMES or not parsed.path:
            continue
        candidate = (path.parent / unquote(parsed.path)).resolve()
        try:
            candidate.relative_to(ROOT)
        except ValueError:
            fail(f"Markdown link escapes repository: {path.relative_to(ROOT)} -> {target}")
            continue
        checked += 1
        if candidate.is_dir():
            candidate = candidate / "README.md"
        if not candidate.exists():
            fail(f"broken Markdown link: {path.relative_to(ROOT)} -> {target}")
    return checked


class PublicReferenceParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.references: list[tuple[str, str]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = {key.lower(): value or "" for key, value in attrs}
        for attribute in ("href", "src", "action", "poster"):
            if values.get(attribute):
                self.references.append((attribute, values[attribute]))
        for attribute in ("srcset", "imagesrcset"):
            for candidate in values.get(attribute, "").split(","):
                parts = candidate.strip().split(maxsplit=1)
                if parts:
                    self.references.append((attribute, parts[0]))


def public_route_exists(url_path: str, redirects: set[str]) -> bool:
    clean = unquote(url_path).rstrip("/") or "/"
    if clean in GENERATED_PUBLIC_PATHS or any(
        clean.startswith(prefix) for prefix in GENERATED_PUBLIC_PREFIXES
    ):
        return True
    if clean in redirects:
        return True
    if clean == "/":
        return (PUBLIC / "index.html").is_file()
    relative = clean.lstrip("/")
    candidates = [
        PUBLIC / relative,
        PUBLIC / f"{relative}.html",
        PUBLIC / relative / "index.html",
    ]
    return any(candidate.is_file() for candidate in candidates)


def validate_public_reference(
    source: Path,
    attribute: str,
    value: str,
    redirects: set[str],
) -> bool:
    value = value.strip()
    if not value or value.startswith("#") or value.startswith("//"):
        return False
    parsed = urlsplit(value)
    if parsed.scheme in IGNORED_URL_SCHEMES:
        return False
    if parsed.scheme or parsed.netloc:
        return False

    if parsed.path.startswith("/"):
        candidate_path = parsed.path
    else:
        source_url = "/" + source.relative_to(PUBLIC).as_posix()
        base = PurePosixPath(source_url).parent
        candidate_path = "/" + str(base.joinpath(unquote(parsed.path))).lstrip("/")

    if not public_route_exists(candidate_path, redirects):
        fail(
            "broken public reference: "
            f"{source.relative_to(ROOT)} [{attribute}] -> {value}"
        )
    return True


def validate_public_html(text_by_path: dict[Path, str]) -> tuple[int, int, int]:
    firebase = json.loads((ROOT / "firebase.json").read_text(encoding="utf-8"))
    redirects = {
        row.get("source", "")
        for row in firebase.get("hosting", {}).get("redirects", [])
        if row.get("source") and not any(char in row["source"] for char in "*: ")
    }
    checked = 0
    internal_pages = 0
    marketing_pages = marketing_html_files(PUBLIC)
    for path, text in text_by_path.items():
        if path.suffix.lower() != ".html" or PUBLIC not in path.parents:
            continue
        if is_internal_app_path(path, PUBLIC):
            internal_pages += 1
        parser = PublicReferenceParser()
        parser.feed(text)
        for attribute, value in parser.references:
            checked += int(validate_public_reference(path, attribute, value, redirects))
    return len(marketing_pages), internal_pages, checked


def validate_css_references(text_by_path: dict[Path, str]) -> int:
    checked = 0
    pattern = re.compile(r"url\(\s*['\"]?([^)'\"\s]+)", re.I)
    for path, text in text_by_path.items():
        if path.suffix.lower() != ".css" or PUBLIC not in path.parents:
            continue
        for value in pattern.findall(text):
            parsed = urlsplit(value)
            if parsed.scheme in IGNORED_URL_SCHEMES or value.startswith("//"):
                continue
            checked += 1
            if parsed.path.startswith("/"):
                candidate = PUBLIC / unquote(parsed.path).lstrip("/")
            else:
                candidate = path.parent / unquote(parsed.path)
            if not candidate.resolve().is_file():
                fail(f"broken CSS reference: {path.relative_to(ROOT)} -> {value}")
    return checked


def validate_project_identity() -> None:
    configured = json.loads((ROOT / ".firebaserc").read_text(encoding="utf-8"))
    default_project = configured.get("projects", {}).get("default")
    workflow = (ROOT / ".github/workflows/deploy-firebase.yml").read_text(
        encoding="utf-8"
    )
    match = re.search(r"^\s*projectId:\s*([^\s#]+)", workflow, re.M)
    workflow_project = match.group(1) if match else None
    if not default_project or default_project != workflow_project:
        fail(
            "Firebase project mismatch: "
            f".firebaserc={default_project!r}, workflow={workflow_project!r}"
        )


def validate_sensitive_content(text_by_path: dict[Path, str]) -> None:
    for path, text in text_by_path.items():
        for label, pattern in SECRET_PATTERNS.items():
            if pattern.search(text):
                fail(f"possible committed {label}: {path.relative_to(ROOT)}")


def validate_workflows(text_by_path: dict[Path, str]) -> None:
    workflow_dir = ROOT / ".github" / "workflows"
    for path, text in text_by_path.items():
        if path.parent != workflow_dir or path.suffix not in {".yml", ".yaml"}:
            continue
        relative = path.relative_to(ROOT)
        for key in ("name", "on", "jobs"):
            if not re.search(rf"^{key}:\s*", text, re.M):
                fail(f"workflow missing top-level {key}: {relative}")
        if "\t" in text:
            fail(f"tab indentation in workflow: {relative}")
        if re.search(r"\buses:\s*[^\s]+@(?:main|master|latest)\b", text):
            fail(f"floating action reference in workflow: {relative}")
        if re.search(r"^\s*pull_request_target:\s*", text, re.M):
            warn(f"security-sensitive pull_request_target workflow: {relative}")


def main() -> None:
    paths = tracked_paths()
    if not paths:
        fail("repository has no tracked files")

    text_by_path: dict[Path, str] = {}
    hashes: dict[str, list[Path]] = defaultdict(list)
    suffix_counts: Counter[str] = Counter()
    total_bytes = 0

    for path in paths:
        relative = path.relative_to(ROOT)
        if not path.is_file():
            fail(f"tracked file is missing: {relative}")
            continue
        data = path.read_bytes()
        total_bytes += len(data)
        hashes[hashlib.sha256(data).hexdigest()].append(relative)
        suffix = path.suffix.lower() or path.name
        suffix_counts[suffix] += 1

        if any(part in FORBIDDEN_TRACKED_PARTS for part in relative.parts):
            fail(f"forbidden generated/secret path is tracked: {relative}")
        if path.suffix and path.suffix.lower() not in EXPECTED_SUFFIXES:
            warn(f"unclassified tracked suffix: {relative}")

        if path.suffix.lower() in TEXT_SUFFIXES or path.name in TEXT_FILENAMES:
            text = validate_text(path, data)
            if text is not None:
                text_by_path[path] = text
                validate_structured_file(path, text)
        else:
            validate_binary_file(path, data)

    markdown_links = sum(
        validate_markdown_links(path, text)
        for path, text in text_by_path.items()
        if path.suffix.lower() == ".md"
    )
    marketing_pages, internal_pages, public_references = validate_public_html(
        text_by_path
    )
    css_references = validate_css_references(text_by_path)
    validate_project_identity()
    validate_sensitive_content(text_by_path)
    validate_workflows(text_by_path)

    duplicates = [files for files in hashes.values() if len(files) > 1]
    if duplicates:
        warn(f"{len(duplicates)} exact duplicate-content group(s) found")

    print(
        "REPOSITORY_AUDIT: " + ("PASS" if not errors else "FAIL")
        + f" ({len(paths)} tracked files; {total_bytes} bytes; "
        + f"{marketing_pages} marketing HTML; {internal_pages} internal HTML; "
        + f"{markdown_links} Markdown links; "
        + f"{public_references + css_references} local public references)"
    )
    print(
        "TRACKED_TYPES: "
        + ", ".join(f"{key}={value}" for key, value in sorted(suffix_counts.items()))
    )
    for message in warnings:
        print(f"WARNING: {message}")
    for message in errors:
        print(f"ERROR: {message}")
    if errors:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
