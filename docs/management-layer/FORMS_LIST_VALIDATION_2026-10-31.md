# Forms file-list validation

October 31, 2026. Baseline: `f15144a5c9cab9e26373fbcbc14eef0d4cf1a8f3`.

The Forms browser rendered each file as it read the response. A synthetic mixed
page containing a valid file followed by an invalid size left the valid prefix
and its Download control visible after the action failed. Other malformed 200
responses could expose controls without checking the requested folder or file
metadata. This does not establish a production malformed response or a server
authorization bypass.

The client now validates the whole page before rendering any row or control:

- A successful response, up to 20 items, unique file IDs, and a null or bounded
  printable opaque cursor.
- The selected templates/submissions folder and content-address ID, hash,
  media type and filename extension must agree.
- Filename, integer byte size and upload timestamp must satisfy the existing
  local file contract, including the 2 MiB limit and PDF/PNG/JPEG formats.

An invalid response leaves the list empty, Next unavailable and an explicit
reload message. Replaced page controls remain invalidated by the existing list
revision. Normal pages retain current Download controls, server-cursor encoding,
session/folder fencing and independent byte-length/SHA-256/header verification.

This is metadata consistency validation. It adds no source read, file write,
patient/encounter/version binding, sharing grant, clinical review or signature
authority. Backend, Storage, authentication, release settings and marketing are
unchanged. Upload-response handling is outside this bounded correction.

## Verification and limits

Both regressions failed before the correction. The mixed-page case specifically
left one row visible; the corrected client leaves none. Synthetic cases cover
wrong folders, unsafe IDs, inconsistent hashes/media/filenames, invalid sizes and
timestamps, duplicate IDs, oversized pages and malformed cursors. Former page
controls dispatch no request after invalid replacement. Valid PDF, PNG and JPEG
metadata still render; existing byte-download and context-transition tests pass.

All 15 Forms and 319 frontend/tooling tests pass. Deterministic assets, repository
checks, normal release and production verification are recorded in the handoff.
Native acceptance may read the existing administrator list without downloading
or uploading a private file. Malformed responses and queued races remain
synthetic; they are not induced in production.

This implements the [role research](ROLE_WORKFLOW_RESEARCH.txt) distinction
between a verified storage page and broader document identity/action authority.
Source interpretation, B02 usable billing facts/diagnostics, full-office
coverage, authorization/POC/document mappings and P1-B/P2 role/action examples
remain open.
