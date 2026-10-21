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

Production acceptance is pending the normal GitHub/Firebase workflow and a
signed-in synthetic upload/download in each folder. Real patient or staff
documents are not needed for acceptance.
