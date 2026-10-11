import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { WorkflowError } from "../operations/reads.js";
import { canonicalSmsCallbackUrl, createSmsAdapter, handleSmsCallback, type SmsFactoryConfig, type SmsCallbackRequest } from "./sms.js";
import type { NotificationContext, NotificationOutboxRecord, ProviderResult } from "./notifications.js";

const account = "AC" + "b".repeat(32), sid = "SM" + "a".repeat(32), token = "synthetic-secret", outboxId = "d".repeat(64), attemptId = "12345678-1234-4123-8123-123456789012";
const config: SmsFactoryConfig = { projectId: "primetime-test", allowedOfficeId: "123", callbackUrl: "https://example.com/primetime/sms/callback",
  capabilityApproved: true, configurationApproved: true, sendApproved: true, sourceApproved: true, policyApproved: true };
const context: NotificationContext = { officeId: "123", actorId: "sms-worker", roles: ["service"], dataApproved: true, mode: "live" };
const secret = { accountSid: account, authToken: token, from: "8324030094" };
const encoded = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64");
const response = (value: unknown = secret) => new Response(JSON.stringify({ payload: { data: encoded(value) } }));
async function rejectsCode(promise: Promise<unknown>, code: string) { await assert.rejects(promise, error => error instanceof WorkflowError && error.code === code); }
function callbackInput(overrides: Partial<SmsCallbackRequest> = {}): SmsCallbackRequest {
  const query = { officeId: "123", outboxId, attemptId }, externalUrl = canonicalSmsCallbackUrl(config, query).externalUrl;
  const form = { AccountSid: account, MessageSid: sid, MessageStatus: "delivered", NewField: " future parameter " };
  const rawForm = new URLSearchParams(form).toString(), signature = createHmac("sha1", token).update(externalUrl + Object.keys(form).sort().map(key => key + form[key as keyof typeof form]).join("")).digest("base64");
  return { method: "POST", query, rawForm, signature, contentType: "application/x-www-form-urlencoded", ...overrides };
}
function callbackOutbox(recordOverrides: Partial<NotificationOutboxRecord> = {}) {
  const calls: { method: string; context: NotificationContext; result?: ProviderResult }[] = [];
  const record = { id: outboxId, officeId: "123", attemptId, state: "accepted", ...recordOverrides } as NotificationOutboxRecord;
  return { calls, service: {
    get: async (_id: string, scoped: NotificationContext) => { calls.push({ method: "get", context: scoped }); return record; },
    applyCallback: async (_id: string, _attempt: string, result: ProviderResult, scoped: NotificationContext) => { calls.push({ method: "apply", context: scoped, result }); return { ...record, state: result.state } as NotificationOutboxRecord; },
  } };
}

test("factory default false gates never resolve ADC or access Secret Manager", async () => {
  let credentialCalls = 0, fetchCalls = 0;
  const deps = { getAccessToken: async () => { credentialCalls++; throw new Error("must not call"); }, request: (async () => { fetchCalls++; throw new Error("must not call"); }) as typeof fetch };
  assert.equal(await createSmsAdapter({ projectId: config.projectId, allowedOfficeId: "123", callbackUrl: config.callbackUrl }, context, deps), null);
  for (const gate of ["capabilityApproved", "configurationApproved", "sendApproved", "sourceApproved", "policyApproved"] as const) assert.equal(await createSmsAdapter({ ...config, [gate]: false }, context, deps), null);
  for (const patch of [{ mode: "demo" as const }, { dataApproved: false }, { officeId: "456" }, { roles: ["viewer"] }]) assert.equal(await createSmsAdapter(config, { ...context, ...patch }, deps), null);
  assert.equal(credentialCalls, 0); assert.equal(fetchCalls, 0);
});

test("factory validates fixed project, office and canonical HTTPS callback configuration before secret access", async () => {
  let calls = 0;
  const deps = { getAccessToken: async () => { calls++; return { access_token: "test", expires_in: 3600 }; }, request: (async () => response()) as typeof fetch };
  for (const patch of [{ projectId: "../../another-project" }, { projectId: "short" }, { callbackUrl: "http://example.com/callback" },
    { callbackUrl: "https://user:pass@example.com/callback" }, { callbackUrl: "https://example.com/callback?secret=other" }, { callbackUrl: "https://example.com/callback#fragment" }, { timeoutMs: 0 }]) {
    await rejectsCode(createSmsAdapter({ ...config, ...patch }, context, deps), "invalid_sms_server_configuration");
  }
  assert.equal(calls, 0);
});

test("factory accesses only the fixed secret/latest through an injected application access token", async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const adapter = await createSmsAdapter(config, context, { getAccessToken: async () => ({ access_token: "synthetic-adc-token", expires_in: 3600 }), request: async (url, init) => {
    calls.push({ url: String(url), init: init! }); return response();
  } });
  assert.ok(adapter); assert.equal(calls.length, 1);
  assert.equal(calls[0]!.url, "https://secretmanager.googleapis.com/v1/projects/primetime-test/secrets/primetime-sms-credentials/versions/latest:access");
  assert.equal(calls[0]!.init.method, "GET"); assert.equal(calls[0]!.init.redirect, "error"); assert.ok(calls[0]!.init.signal);
  assert.equal((calls[0]!.init.headers as Record<string, string>).Authorization, "Bearer synthetic-adc-token");
});

test("factory binds configured office to callback and performs no message send until explicit adapter submit", async () => {
  let calls = 0, callback = "";
  const adapter = await createSmsAdapter(config, context, { getAccessToken: async () => ({ access_token: "token", expires_in: 3600 }), request: async (url, init) => {
    calls++; if (String(url).startsWith("https://secretmanager.googleapis.com/")) return response();
    assert.equal(String(url), `https://api.twilio.com/2010-04-01/Accounts/${account}/Messages.json`);
    callback = new URLSearchParams(init?.body as string).get("StatusCallback")!;
    return new Response(JSON.stringify({ sid, status: "queued" }), { status: 201 });
  } });
  assert.equal(calls, 1);
  await adapter!.submit({ outboxId, attemptId, to: "8324030094", body: "Synthetic test" });
  assert.equal(calls, 2); assert.equal(callback, `${config.callbackUrl}?officeId=123&outboxId=${outboxId}&attemptId=${attemptId}`);
});

test("lookup failures and invalid secret payloads return sanitized errors without credential or phone leakage", async () => {
  for (const value of ["unexpected-string", { ...secret, statusCallbackUrl: "https://attacker.example/" }, { ...secret, accountSid: "bad" },
    { ...secret, from: "+448324030094" }, { ...secret, messagingServiceSid: "MG" + "c".repeat(32) }, { accountSid: account, authToken: token }]) {
    await rejectsCode(createSmsAdapter(config, context, { getAccessToken: async () => ({ access_token: "private-token", expires_in: 3600 }), request: async () => response(value) }), "sms_credentials_unavailable");
  }
  for (const request of [(async () => new Response("private-token 8324030094", { status: 403 })) as typeof fetch, (async () => { throw new Error("private-token 8324030094"); }) as typeof fetch]) {
    await assert.rejects(createSmsAdapter(config, context, { getAccessToken: async () => ({ access_token: "private-token", expires_in: 3600 }), request }), error => {
      assert.ok(error instanceof WorkflowError); assert.equal(error.code, "sms_credentials_unavailable"); assert.doesNotMatch(error.message, /private-token|8324030094/); return true;
    });
  }
});

test("gates are rechecked after asynchronous credential lookup", async () => {
  const mutable = { ...config };
  const adapter = await createSmsAdapter(mutable, context, { getAccessToken: async () => ({ access_token: "token", expires_in: 3600 }), request: async () => { mutable.sendApproved = false; return response(); } });
  assert.equal(adapter, null);
});

test("Secret Manager lookup has a bounded timeout and aborts without retry", async () => {
  let calls = 0;
  await rejectsCode(createSmsAdapter({ ...config, timeoutMs: 1_000 }, context, { getAccessToken: async () => ({ access_token: "token", expires_in: 3600 }), request: async (_url, init) => {
    calls++; return new Promise<Response>((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(new Error("abort")), { once: true }));
  } }), "sms_credentials_unavailable");
  assert.equal(calls, 1);
});

test("callback canonicalization allows only exact office/outbox/attempt scalars and configured office", () => {
  assert.equal(canonicalSmsCallbackUrl(config, { attemptId, officeId: "123", outboxId }).externalUrl, `${config.callbackUrl}?officeId=123&outboxId=${outboxId}&attemptId=${attemptId}`);
  for (const query of [null, [], { officeId: "123", outboxId }, { officeId: ["123", "123"], outboxId, attemptId }, { officeId: "123", outboxId, attemptId, host: "attacker.example" },
    { officeId: "123", outboxId: outboxId + "/evil", attemptId }, { officeId: "123", outboxId, attemptId: "old-attempt" }]) assert.throws(() => canonicalSmsCallbackUrl(config, query), /invalid_sms_callback_query/);
  assert.throws(() => canonicalSmsCallbackUrl(config, { officeId: "456", outboxId, attemptId }), /sms_callback_office_scope_mismatch/);
});

test("callback applies a signed provider receipt using server office context and exact configured URL", async () => {
  const f = callbackOutbox(); let secretCalls = 0;
  const result = await handleSmsCallback(config, callbackInput(), f.service, context, { getAccessToken: async () => ({ access_token: "token", expires_in: 3600 }), request: async url => {
    secretCalls++; assert.ok(String(url).includes("/secrets/primetime-sms-credentials/")); return response();
  } });
  assert.equal(result.state, "delivered"); assert.equal(secretCalls, 1); assert.deepEqual(f.calls.map(call => call.method), ["get", "apply"]);
  assert.ok(f.calls.every(call => call.context.officeId === "123")); assert.equal(f.calls[1]!.result!.providerId, sid);
});

test("invalid callback method/gates/query/attempt cannot access secrets or update outbox", async () => {
  let secretCalls = 0;
  const deps = { getAccessToken: async () => { secretCalls++; return { access_token: "token", expires_in: 3600 }; }, request: (async () => response()) as typeof fetch };
  const f = callbackOutbox();
  await rejectsCode(handleSmsCallback(config, callbackInput({ method: "GET" }), f.service, context, deps), "sms_callback_method_not_allowed");
  await rejectsCode(handleSmsCallback({ ...config, sendApproved: false }, callbackInput(), f.service, context, deps), "sms_callback_capability_not_approved");
  await rejectsCode(handleSmsCallback(config, callbackInput({ query: { officeId: ["123", "123"], outboxId, attemptId } }), f.service, context, deps), "invalid_sms_callback_query");
  await rejectsCode(handleSmsCallback(config, callbackInput({ contentType: "application/json" }), f.service, context, deps), "invalid_notification_callback_signature");
  const mismatch = callbackOutbox({ attemptId: "different-attempt" });
  await rejectsCode(handleSmsCallback(config, callbackInput(), mismatch.service, context, deps), "sms_callback_attempt_mismatch");
  assert.equal(secretCalls, 0); assert.equal(f.calls.length, 0); assert.equal(mismatch.calls.length, 1);
});

test("signature binds callback query and future untrimmed form fields; invalid account cannot update", async () => {
  const deps = { getAccessToken: async () => ({ access_token: "token", expires_in: 3600 }), request: (async () => response()) as typeof fetch };
  const f = callbackOutbox();
  const input = callbackInput(); await rejectsCode(handleSmsCallback(config, { ...input, rawForm: input.rawForm.replace("+future+parameter+", "future+parameter") }, f.service, context, deps), "invalid_notification_callback_signature");
  await rejectsCode(handleSmsCallback({ ...config, callbackUrl: "https://another.example/callback" }, input, f.service, context, deps), "invalid_notification_callback_signature");
  const query = input.query as Record<string, string>;
  const invalid = callbackInput({ query: { ...query, outboxId: "e".repeat(64) } });
  await rejectsCode(handleSmsCallback(config, invalid, f.service, context, deps), "invalid_notification_callback_signature");
  assert.ok(f.calls.every(call => call.method === "get"));
});
