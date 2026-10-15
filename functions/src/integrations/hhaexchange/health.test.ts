import assert from "node:assert/strict";
import test from "node:test";
import { checkHhaHealth } from "./health.js";
import { WorkflowError } from "../../operations/reads.js";
import type { HhaCallResponse, HhaRequestBudget } from "./client.js";

const now = () => new Date("2026-10-14T12:00:00.000Z");
const secret = { appName: "private-name", appSecret: "private-secret", appKey: "private-key" };
const response = (patch: Partial<HhaCallResponse> = {}): HhaCallResponse => ({ operation: "GetCollectionStatus", ok: true, httpStatus: 200, transportOk: true,
  correlationId: "12345678-1234-1234-1234-123456789abc", durationMs: 40, attempts: 1, retryable: false, ...patch });
function dependencies(result = response()) {
  return { getCredentials: () => secret, reserveRead: async () => {}, deferReads: async (_seconds: number) => {}, now,
    createClient: (_credentials: unknown, budget: HhaRequestBudget) => ({ async getCollectionStatuses() { await budget.beforeRequest(); return { response: result, statuses: [{ id: 1, value: "private-reference-value" }] }; } }) };
}
test("HHA health proves vendor acceptance and returns only safe reference metadata", async () => {
  const result = await checkHhaHealth(dependencies());
  assert.equal(result.status, 200); assert.equal(result.body.ok, true); assert.equal(result.body.readiness.authentication, "accepted");
  assert.equal((result.body as any).referenceCount, 1); assert.equal(result.body.stage, "complete");
  assert.doesNotMatch(JSON.stringify(result), /private|appKey|appSecret|statuses/);
});
test("missing, malformed, inaccessible credentials never dispatch or expose their failure", async () => {
  for (const getCredentials of [() => null, () => ({}), () => ({ ...secret, appKey: 17 }), () => ({ ...secret, appSecret: "  " }), () => { throw new Error("private-secret-value"); }]) {
    let sends = 0;
    const result = await checkHhaHealth({ ...dependencies(), getCredentials, createClient() { sends++; throw new Error("must_not_dispatch"); } });
    assert.equal(result.status, 503); assert.equal(result.body.stage, "credentials"); assert.equal(sends, 0);
    assert.equal(result.body.readiness.authentication, "not_established"); assert.doesNotMatch(JSON.stringify(result), /private/);
  }
});
test("storage readiness distinguishes shared budget deferral from unavailable persistence", async () => {
  for (const code of ["vendor_backoff_active", "read_budget_exhausted_retry_next_minute"]) {
    const result = await checkHhaHealth({ ...dependencies(), reserveRead: async () => { throw new WorkflowError(code, 429, 37); } });
    assert.equal(result.status, 429); assert.equal(result.body.error, code); assert.equal(result.body.stage, "storage");
    assert.equal((result.body as any).retryAfterSeconds, 37); assert.equal(result.body.readiness.requestBudget, "deferred");
  }
  for (const error of [new Error("private Firestore document"), new WorkflowError("private arbitrary code", 403)]) {
    const result = await checkHhaHealth({ ...dependencies(), reserveRead: async () => { throw error; } });
    assert.equal(result.status, 503); assert.equal(result.body.error, "hha_read_budget_storage_unavailable"); assert.doesNotMatch(JSON.stringify(result), /private/);
  }
});
test("backoff persistence failure remains a storage diagnostic when transport normalizes it", async () => {
  const result = await checkHhaHealth({ ...dependencies(response({ ok: false, httpStatus: 0, error: { kind: "transport" } })), deferReads: async () => { throw new Error("private storage failure"); },
    createClient: (_credentials, budget) => ({ async getCollectionStatuses() { await budget.beforeRequest(); try { await budget.defer(30); } catch { /* Real client normalizes this failure. */ }
      return { response: response({ ok: false, httpStatus: 0, error: { kind: "transport" } }), statuses: [] }; } }) });
  assert.equal(result.body.stage, "storage"); assert.equal(result.body.error, "hha_backoff_storage_unavailable"); assert.doesNotMatch(JSON.stringify(result), /private/);
});
test("HTTP authentication rejection differs from transport, application, SOAP and protocol failures", async () => {
  for (const [patch, status, code] of [
    [{ httpStatus: 401 }, 502, "hha_authentication_rejected"], [{ httpStatus: 403 }, 502, "hha_authentication_rejected"],
    [{ httpStatus: 0, error: { kind: "transport" } }, 503, "hha_transport_unavailable"],
    [{ error: { kind: "application", id: 42, message: "private vendor response" } }, 502, "hha_application_rejected"],
    [{ error: { kind: "soap_fault", details: "private SOAP" } }, 502, "hha_soap_fault"], [{ error: { kind: "protocol" } }, 502, "hha_response_not_accepted"],
  ] as [Partial<HhaCallResponse>, number, string][]) {
    const result = await checkHhaHealth(dependencies(response({ ...patch, ok: false })));
    assert.equal(result.status, status); assert.equal(result.body.error, code); assert.equal(result.body.stage, "hha");
    assert.equal(result.body.readiness.authentication, code === "hha_authentication_rejected" ? "rejected" : "not_established");
    assert.doesNotMatch(JSON.stringify(result), /private|message|details|resultXml/);
  }
});
test("untrusted response diagnostics are never copied verbatim", async () => {
  const result = await checkHhaHealth(dependencies(response({ ok: false, correlationId: "private-value", status: "private-status", durationMs: NaN,
    resultXml: "private SOAP", error: { kind: "application", code: "private-code", message: "private message", id: NaN } })));
  assert.doesNotMatch(JSON.stringify(result), /private|errorId|durationMs|correlationId|applicationStatus/);
});
