"""Reviewed content dates, independent of build time and filesystem timestamps."""
from datetime import date
import re


def validated_dates(records, routes):
    if not isinstance(records, dict):
        raise ValueError("Sitemap content dates must be an object")
    result = {}
    for route, record in records.items():
        if route not in routes or not isinstance(record, dict):
            raise ValueError(f"Unreviewed sitemap route: {route}")
        value = record.get("lastmod", "")
        evidence = record.get("evidence", "")
        if not isinstance(value, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
            raise ValueError(f"Invalid content date: {route}")
        if date.fromisoformat(value) > date.today():
            raise ValueError(f"Future content date: {route}")
        if not isinstance(evidence, str) or not evidence.strip():
            raise ValueError(f"Missing content evidence: {route}")
        result[route] = value
    return result
