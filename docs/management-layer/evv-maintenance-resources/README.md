# Visit-maintenance resource pack

Collected November 5, 2026 for the owner's maintenance-first product direction.
This pack supplies implementation references and working templates. It does not
activate staff access, HHA writes, new source reads or an AI pilot.

November 11: read the [technical response](HHA_TECHNICAL_RESPONSE_2026-11-11.txt)
before the historical question packet. HHA says existing-call API linking is
unsupported. Its reason lookup is payer-defined; internal-contract UI options
may differ. CSM browser guidance and an owner-approved private XML example remain
next actions. Time/history/units/readback questions are still unresolved.

| Checklist | Resources now available | Work still required |
|---|---|---|
| M01 Maintenance workspace | HHA workflow/call guides, existing source readers, paged change-feed documentation, current SOAP comparison | Complete attempt coverage and authoritative event-to-visit linkage |
| M02 Reasons and confirmations | Provider API guides, twelve operation shapes, testing guide, Texas references, prepared vendor questions | Supported tenant action semantics, exact reason/action mapping and verified readback |
| M03 Staff roles | HHA permissions guide, Firebase claim/IAM references, existing auth and scoped-record code | Restricted staff login, effective office/client membership and per-action authority |
| M04 Staff reports | Current report specifications, local audit/review machinery, resolved/unresolved templates | Protected report implementation with source action receipts |
| M05 Small pilot | Case matrix, membership specification, measurement definitions and go/no-go inputs | Named private pilot scope and owner-approved acceptance targets |
| M06 Limited automation | Auto-verification reference, deterministic execution/recovery patterns and genuine-call cases | Approved rules, supported write adapter, shadow results and scoped activation |

Start with [SOURCE_INDEX.txt](SOURCE_INDEX.txt), then
[IMPLEMENTATION_MAP.txt](IMPLEMENTATION_MAP.txt). Use
[HHA_SUPPORT_QUESTIONS.txt](HHA_SUPPORT_QUESTIONS.txt) to obtain the missing action
contract; it is a prepared document, not a sent message. The
[PILOT_AND_REPORT_KIT.txt](PILOT_AND_REPORT_KIT.txt) contains reusable acceptance
cases and report fields.

[SOAP_CONTRACT_MAP.json](SOAP_CONTRACT_MAP.json) is schema metadata from the
existing public snapshot, excluding authentication fields.
[LIVE_WSDL_COMPARISON.json](LIVE_WSDL_COMPARISON.json) compares twelve selected
request/response shapes with the anonymously retrieved live WSDL, through four
expansion levels. Equivalent shapes do not establish workflow support or access.
[PUBLIC_DOWNLOAD_MANIFEST.json](PUBLIC_DOWNLOAD_MANIFEST.json) records the seven
downloaded PDFs and live WSDL, including hashes, sizes and page counts. Full
documents remain outside Git in the workspace's outputs resource folder.

The existing Enterprise guide was also found and read through connected Drive.
Its private locator and method-presence evidence remain outside Git. The public
Texas guide is a separate resource and must not silently replace that contract.
Focused mail discovery found no technical guide in the narrowed subject search;
this is not a claim about all messages or attachments.

Important distinctions:

- The documented paged change feed is a candidate for better freshness; no new
  feed has been enabled. Current full-scan acceptance remains intact.
- Primetime's shared 60-read/minute guard is an application limit. A published
  provider guide describes 500 calls per method/provider/minute. Tenant limits
  and runtime backoff still need confirmation before tuning; nothing is raised.
- Third-party aggregation testing documents a different interface. Its
  confirmed-visit editing test is not proof that it can maintain calls captured
  by the current HHA application using the current SOAP credentials.
- The Texas PSO landing page lists current v3.1 rules and future v4.0 rules
  effective April 1, 2027. Do not apply future rules as current policy. The
  agency's program/contract applicability still needs confirmation.
- Original caregiver event timestamps remain distinct from maintained visit or
  bill-time fields. No reason-code selection or financial decision is made here.
