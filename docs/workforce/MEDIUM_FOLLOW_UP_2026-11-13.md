# Staff portal medium-priority follow-up — November 13, 2026

One-time review against the repository readiness report. Based on main c9de0e7;
earlier source reconciliation, high-priority fixes and portal styling are retained.

## Implemented

- ID expiration mail now has a leased daily outbox. Definite temporary rejections
  and token preparation failures retry at least 15 minutes later, at most three
  attempts per day. The scheduler checks every 15 minutes during the Chicago
  8:30 a.m.–5:59 p.m. reminder window. Microsoft acceptance suppresses duplicates.
  A crash after dispatch or uncertain network result requires inbox review instead
  of an unsafe automatic resend. Today's status appears on the staff HR home.
  Recipient remains irab@pthhs.net; mail contains counts and the portal link.
- Visits can be saved incomplete, but every substantive answer must be recorded
  before any signature. Additional notes remain optional. Staff enter their own
  findings, including an explicit None/Not applicable where appropriate.
- Locked visits support a reasoned corrected draft linked to the immutable
  original content hash. Creation, document views and saves/signatures are audited.
  Corrections require fresh signatures and preserve original versions and files.
- Uploaded forms have per-role signature locations on their actual page images.
  Staff can click signature lines or use keyboard percentage controls. Every
  required signer needs a location. Saved typed/drawn appearances fill all mapped
  locations for that role only after that signer reviews and confirms the document.
  Overlapping/out-of-page mappings are rejected. Final PDFs flatten the appearances
  and retain the signing certificate. Mapping is explicit, not inferred by OCR.

## Verification

- Backend TypeScript build and 998 backend tests passed locally, including
  concurrency, interrupted dispatch, safe retry, required-answer signing gates,
  office boundaries, immutable originals, corrected-copy audit and PDF placement.
- 27 targeted frontend checks and performance budget verification passed locally.
- A fictional localhost visit verified incomplete draft saving, blank-answer
  blocking, upload mapping persistence, reviewed signing, locked fields, linked
  correction creation and a remembered appearance offered on the corrected draft.
- Rendered all three pages of the fictional signed PDF and inspected placement
  for typed member, drawn caregiver and typed staff signatures. No editable PDF
  fields remain. No production visits, identity documents or emails were created
  for testing. Release checks and deployment evidence accompany the follow-up.

## Exact remaining dependencies

HHA source correction submission stays disabled. The November 11 vendor response
does not provide API linking of existing calls. It also has not resolved the exact
visit-specific reason/action successful-empty lookup against the UI catalog or
provided the applicable action/confirmation/readback contract. See
[owner operations checklist](../management-layer/OWNER_OPERATIONS_TASKS.md) and
[vendor response](../management-layer/evv-maintenance-resources/HHA_TECHNICAL_RESPONSE_2026-11-11.txt).

The existing CSM must confirm the agency agreement, assisted-browser account/role
model and unattended-use restrictions. The agency must approve the private channel
and redacted lookup example, broader comparison/exception rules and scoped-action
acceptance. Earlier case-specific browser approvals are not reusable authority.
No HHA write flag, source write, vendor email or credential scope is enabled here.

Reusable signature appearance remains specific to the staff account and browser.
It does not authenticate a client or caregiver. Independent remote invitations,
cross-device signer profiles and automatic client signature reuse require an
approved signer/representative identity model and signature retention/revocation
policy. Existing in-person signing explicitly records staff witness and per-form
consent. The agency's admission document packet is still needed for its final
admissions workflow; uploaded actual documents can be mapped now.

For ambiguous ID email delivery, staff must check the HR inbox. There is no safe
Microsoft Graph sendMail delivery-idempotency/readback guarantee in this transport,
so the system deliberately does not auto-resend uncertain submissions. Portal
expiration alerts remain available independently of email delivery.
