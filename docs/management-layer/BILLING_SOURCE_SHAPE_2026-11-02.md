# Scoped billing response evidence — November 2, 2026 UTC

The exact-visit detailed billing connection remains open (B02). A production
`GetVisitBillInfoV2` response explicitly reported success but supplied neither
the expected `VisitBillInfo` markup nor the versioned `VisitBillInfoV2` markup
checked by the diagnostic. No encoded form of either marker was detected.
This does not establish zero charges, payment, an AR balance, or the business
reason that the source omitted its detail. The separate `GetVisitInfoV3`
`BilledAmount` connection remains accepted; it is not cash received.

## Bounded diagnostic and release

Commit `6af8e87ae002635d145dfbfb7a2c35aaca46de50` inspects only the already-returned
SOAP result when the existing billing projection returns zero records. Fixed
categories distinguish missing, self-closed/nil, paired, unclosed, multiple and
encoded expected/versioned markup, plus explicit versus implicit success status.
No alternate record format is accepted and no source query is added. Source XML,
identifiers, amounts, dates, actor/request metadata and vendor error text are
excluded from diagnostic fields. The logger receives a separately whitelisted
object only after fresh visit/patient/office proof and a final policy check.
Revocation, changed policy, wrong operation, truncation and nonbilling responses
cannot emit this diagnostic. Logger failure preserves the existing refusal.

One new source-shape regression failed before implementation and passed after.
The additional privacy/refusal regression covers unexpected properties/values,
revocation, changed policy, truncation, operation changes and logger failure.
All 556 backend tests passed; generated assets and repository audit passed.
Browser assets are unchanged. Normal workflow
[41454236089](https://github.com/jnwokorie1957/pthhs/actions/runs/41454236089)
passed all three jobs: Hosting 13:35:42, backend 13:37:19 and analytics 13:37:15 UTC.
Twelve deployed assets matched local files; nine anonymous JSON requests retained
401/private/no-store/noindex boundaries at 13:37:54.858 UTC.

The signed-in production Billing & AR screen made one existing scoped detail
request after deployment. It retained the explicit no-record state and returned
no billing facts or receipt. The corresponding protected warning at
13:37:44.660229 UTC showed exactly:

```text
expected=absent
versioned=absent
encoded=false
successStatus=explicit
```

This rules out recovery through the two checked record markers in this response.
It is not a comprehensive assertion about every possible vendor response schema.
No financial field is filled from a different record or source.

## Contract evidence and next action

The repository's captured `hharefs/hha-wdsl.xml` defines the V2 result's optional
`VisitBillInfo` element. The official
[HHA Web Service API guide](https://hhaxsupport.s3.amazonaws.com/SupportDocs/EDI%20Guides/ProviderIntegration/HHAeXchange%20Web%20Service%20API%20-%20TX.pdf)
(reviewed November 2; pages 72–74) shows an inconsistent versioned opening and
unversioned closing element in its example. That inconsistency justified checking
both markers; production did not supply either. Do not change the parser to
accept an invented alias based on the guide alone.

The original HHA website tab is now at its login form. Owner action: sign in to
that retained tab, then inspect the exact selected visit's Billing Info through
the original Calendar. Keep its IDs and values in protected tools only. If the
original form contains usable billing detail, obtain the vendor's supported
reason/contract for a successful V2 API envelope omitting its optional detail,
and confirm the relevant account/office/visit coverage. If the form is empty,
record that narrow observation without inferring zero financial activity. No
vendor communication was sent and no repeated unchanged query is required.

The remaining EVV omissions, full-office coverage, clinical documents, staffing
availability, billing/AR interpretation and external role acceptance stay open.
No source edits, manual imports, new permissions, messages or clinical/financial
decisions were made by this diagnostic.
