# Messages office-alert source connection — November 1

## Observed problem and resulting behavior

Native production Messages displayed a permanent Messages unavailable / no live
feed placeholder. The application already has an authenticated, office-scoped
Primetime alert outbox reader, but only Visit review used it.

Messages now requests existing GET `/primetime/api/revisions/status`, then GET
`/primetime/api/revisions/notifications` only when the existing
`capabilities.notificationRecords` is true. Opening Messages requests neither
HHA visits nor requirement/exception pages. An unrelated invalid visit date does
not prevent office history access. Refresh alerts repeats this status check;
Next alerts uses the existing opaque cursor and strict office normalization.
Visit review links to this same history surface instead of duplicating records.

The actual source is private Firestore `revisionNotificationOutbox_<officeId>`
through `NotificationOutbox.page`. Closed capability, successful empty page,
failed read, provider acceptance, confirmed delivery and office acknowledgement
remain different states. Server reminder readiness is not proof of credential
availability, provider connectivity, receipt or delivery. HHA notes and a text
conversation inbox are separate sources. No new route or source is invented.

## Scope and controls

Existing authentication, role, data, office/timezone and notification-release
checks remain unchanged. No gate is opened. Existing acknowledgement controls
retain their protected local-office-record behavior; verification does not use
them. No provider credential lookup, external provider request, send, policy
change, new HHA read/write, clinical or financial action is added.

The shared reader invalidates pending responses and clears prior records on
navigation, scope/session changes, Demo and sign-out. Live alert panels are hidden
in Demo; the existing synthetic rule cards stay separate. Safe public evidence
contains no recipients, staff/patient identifiers, private messages or tokens.

## Validation and release

Three new Messages regressions fail against the former generated module and pass
after correction; the prior file was restored byte-identically after the before
check. All250focused dashboard/revision tests pass. Cases cover only-status/history
GETs, invalid unrelated visit dates, cursor escaping, acceptance versus delivery,
closed/empty/failed access and late status/history replies after navigation,
Demo and sign-out. Existing source/read/policy tests remain in the release suite.

Duplicate host/clock-key arrays were consolidated and source notices shortened
without removing their page/coverage/import bounds. Existing420000raw/102000gzip
budgets remain unchanged. Full354frontend-tooling/46analytics tests and Windows
release checks pass; backend code is unchanged. Normal release/native acceptance
is pending. Open M02 provider/history acceptance must not be inferred from fixtures
or a closed production capability.
