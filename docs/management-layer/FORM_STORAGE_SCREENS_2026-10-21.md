# Private Firebase forms library

The Forms navigation screen connects administrator uploads and downloads to
the existing private Firebase Storage bucket. Templates and submissions use
separate folders. PDF, PNG and JPEG files up to 2 MiB are supported.

Every request passes the existing revoked-token administrator authentication,
Live-mode check and operational data release gate. The backend uses the
Firebase Admin Storage API; browser Storage rules remain deny-all. No public
download token, signed URL, new role grant or HHA document write is created.
See the [Firebase Admin Storage guidance](https://firebase.google.com/docs/storage/admin/start).

The server checks request keys, file size, canonical base64, filename,
extension and file signatures. Signature checks establish supported format,
not malware clearance or clinical approval. Downloads use attachment and
nosniff headers with a sandbox policy. Original filenames and uploader identity
are private object metadata. The listing exposes filename, size, upload time
and content hash only to approved administrators.

Object IDs derive from SHA-256 content hashes within each folder. A generation
precondition creates a new object without replacing an existing one. Retrying
the same content reuses its original filename and upload metadata. New content
creates a separate file. Downloads pin the saved generation and verify length
and SHA-256 on the server and in the browser before a local download begins.
No replacement or deletion endpoint is introduced. This is document storage;
clinical form approval, signatures, retention policy and patient/staff sharing
remain separate workflows.

Lists are limited to 20 objects with a next-page cursor, in Storage order.
Switching folders clears the old page. Session and Demo changes clear selected
files, rows and temporary download URLs and fence pending results.

## Validation

Eight backend tests cover exact byte round trips, duplicate retries, folder
separation, cursor validation, path/metadata injection, size boundaries,
file-type mismatch, generation binding, tampering and sanitized failures.
Six browser-controller tests cover upload/list/download, checksums, pagination,
mode/session changes and late responses. The complete backend and frontend
release checks are run before publication. The raw internal asset budget rises
from 360 to 370 KB for this additional screen; the existing 90 KB compressed
and 110 KB individual asset caps remain enforced.

All 502 backend tests and 275 root tooling/frontend tests passed, along with
the local Windows release checks. The repository audit passed with 496 tracked
files and the generated nine-asset build remained current. Production raw
internal assets total 363,081 bytes, within the reviewed 370 KB bound.

## Production acceptance

Release `e057f64e2f145ceae8885d443d29aa2c1794cf13` passed both normal jobs in
workflow `39693802095`, first attempt: Hosting 23:30:33 UTC and backend
23:32:05 UTC on October 21. Nine deployed artifacts matched tested bytes.
Anonymous list, upload and download API requests returned 401; the existing
feed authentication/noindex boundary also passed.

Using the normal signed-in administrator screen, a synthetic 662-byte PDF was
uploaded and downloaded from both Templates and Submissions. Both local browser
downloads matched the original bytes and SHA-256 exactly. Retrying the template
upload reported identical content reused and left one template. A file named
with a PDF extension but containing unsupported text was rejected.

Switching to Demo disabled upload, cleared the selected file and removed rows.
Returning to Live and reloading the whole page retained the administrator
session; loading Templates returned its saved file and downloading again
passed checksum verification. Direct anonymous Firebase downloads of each
actual saved object returned 403. No public token, rule/IAM change, patient or
staff document, HHA mutation or external-role grant was used.

Two clearly named synthetic verification files remain, one per folder. These
tests establish document storage and retrieval, not clinical form approval,
signatures, malware clearance, retention authority or external-role sharing.
Pagination and stale session-response races have controlled test coverage;
more than 20 production forms and an actual auth revocation were not induced.
The current Forms screen is left signed in, Demo off and the API feed enabled.

Private evidence: `primetime-forms-storage-acceptance-2026-10-21.json`,
`primetime-forms-storage-release-2026-10-21.json`,
`primetime-forms-storage-object-boundaries-2026-10-21.json`,
`primetime-forms-security-audit-2026-10-21.json` and
`primetime-forms-storage-verified-2026-10-21.png` in the task's outputs folder.
