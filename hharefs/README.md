# HHAeXchange ENT v1.8 References

This folder contains the captured vendor reference material used to plan the
backend-only `/primetime` integration.

- `endpoints.html` is the operation/capability index. Use it to identify whether
  an operation exists.
- `hha-wdsl.xml` is the implementation contract. Use it to verify exact SOAP
  operation names, payload types, authentication fields, and result structures.

These files are reference snapshots, not generated application code. Confirm
the currently provisioned HHA endpoint/version before production integration.
Never add real credentials, PHI, patient payloads, or production SOAP responses
to this folder.
