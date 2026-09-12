# PTHHS

## 🚨 START HERE — MANAGEMENT LAYER BUILD

The current management-layer work is split into two role-specific tracks. **Read the one that matches your role before doing management-layer work.**

### 👨‍💻 Developer track

➡️ **[`docs/management-layer/DEVELOPER_TASKS.md`](docs/management-layer/DEVELOPER_TASKS.md)**

Technical implementation plan for the HHAeXchange integration, normalized data model, sync framework, EVV exception engine, messaging infrastructure, billing/authorization intelligence, staffing logic, and VPS/production hardening.

### 🏥 Owner / Operations track

➡️ **[`docs/management-layer/OWNER_OPERATIONS_TASKS.md`](docs/management-layer/OWNER_OPERATIONS_TASKS.md)**

Operational decision plan for EVV rules, clinical/management workflows, alert visibility, escalation, correction approvals, billing readiness, authorization rules, staffing constraints, caregiver compliance, and acceptance testing.

---

## HHAeXchange source-of-truth references

The `hharefs/` folder contains captured HHAeXchange ENT v1.8 technical references. The two files below are the important inputs for this management-layer build:

### [`hharefs/endpoints.html`](hharefs/endpoints.html) — operation inventory / capability map

This is a saved copy of the HHAeXchange ENT v1.8 web-service operation page. Use it to quickly answer **"does this API surface expose an operation for this capability?"** without digging through the full WSDL.

It shows operations relevant to the planned management layer, including visit confirmation and EVV, visit information/changes, schedules, caregiver availability, patient authorizations, billing/payroll visit data, collections/AR, caregiver compliance, documents, POC-related functions, and other HHA workflows.

**Best use:** discovery, feature planning, and deciding which HHA operations need deeper inspection.

### [`hharefs/hha-wdsl.xml`](hharefs/hha-wdsl.xml) — exact SOAP contract / implementation source

This is the saved HHAeXchange ENT v1.8 WSDL. It is the implementation-level contract for request/response structures, SOAP operations, field names/types, authentication objects, and error/result structures.

Important confirmed details include the `AppParams` authentication object (`AppName`, `AppSecret`, `AppKey`) and structured response/error information used to build retries, normalization, diagnostics, and typed adapters.

**Best use:** implementing the SOAP client, generating/validating request models, parsing responses, inspecting exact fields for visits/schedules/authorizations/etc., and verifying behavior before coding a rule against HHA data.

> **Rule of thumb:** use `endpoints.html` to learn *what exists*; use `hha-wdsl.xml` to learn *exactly how it works*.

---

## Management-layer working rule

The application should own PTHHS workflows and rules while HHAeXchange initially acts as an external source/sink. Operational or medical rules must come from the Owner / Operations track; the Developer track turns those approved rules into configurable, auditable software.

Do not commit live HHA credentials or real patient/employee sensitive data to this repository.
