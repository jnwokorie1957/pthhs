import { HhaNotSubmittedError } from "./dispatch.js";
import assert from "node:assert/strict";
import test from "node:test";
import { HhaSoapClient, boundedSoapText } from "./client.js";
import {
  extractElementBodies,
  extractElementText,
  parseHhaSoapResponse,
} from "./parser.js";

test("documented zero-error success envelope is accepted without hiding real errors", () => {
  const envelope = (status: string, id: number, message = "") => `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><CreateWeeklyVariableResponse><CreateWeeklyVariableResult><Result Status="${status}"><ErrorInfo><ErrorID>${id}</ErrorID><ErrorMessage>${message}</ErrorMessage></ErrorInfo></Result></CreateWeeklyVariableResult></CreateWeeklyVariableResponse></soap:Body></soap:Envelope>`;
  assert.equal(parseHhaSoapResponse("CreateWeeklyVariable", 200, true, envelope("Success", 0)).ok, true);
  for (const xml of [envelope("Error", 0), envelope("Success", 42), envelope("Success", 0, "Rejected")]) {
    assert.equal(parseHhaSoapResponse("CreateWeeklyVariable", 200, true, xml).ok, false);
  }
});

test("mutations never retry an ambiguous transport result", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error("synthetic timeout"); };
  try {
    const client = new HhaSoapClient("https://example.invalid", { appName: "app", appKey: "key", appSecret: "secret" });
    const result = await client.call("DeleteVisit", "");
    assert.equal(calls, 1);
    assert.equal(result.retryable, false);
    assert.equal(result.outcome, "unknown");
  } finally { globalThis.fetch = original; }
});

test("guide-absent and removed methods stop before any vendor request", async () => {
  const original = globalThis.fetch; let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error("unexpected network"); };
  try {
    const client = new HhaSoapClient("https://example.invalid", { appName: "app", appKey: "key", appSecret: "secret" });
    for (const operation of ["ConfirmVisits", "GetVisitChangesV5", "GetPatientChanges"]) await assert.rejects(client.call(operation), /vendor_contract_clarification_required/);
    assert.equal(calls, 0);
  } finally { globalThis.fetch = original; }
});

test("SOAP reads enforce byte limits even without a truthful content length", async () => {
  assert.equal(await boundedSoapText(new Response("<ok/>"), 8), "<ok/>");
  await assert.rejects(boundedSoapText(new Response("small", { headers: { "content-length": "99" } }), 8), /hha_response_size_limit/);
  await assert.rejects(boundedSoapText(new Response("0123456789", { headers: { "content-length": "1" } }), 8), /hha_response_size_limit/);
});

test("long vendor Retry-After defers instead of retrying early", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; return new Response('<GetCollectionStatusResponse><GetCollectionStatusResult><Result Status="Error"><ErrorInfo><ErrorID>42</ErrorID></ErrorInfo></Result></GetCollectionStatusResult></GetCollectionStatusResponse>', { status: 429, headers: { 'retry-after': '120' } }); };
  try {
    const client = new HhaSoapClient("https://example.invalid", { appName: "app", appKey: "key", appSecret: "secret" });
    const result = await client.call("GetCollectionStatus");
    assert.equal(calls, 1);
    assert.equal(result.retryAfter, "120");
    assert.equal(result.ok, false);
  } finally { globalThis.fetch = original; }
});

test("parses a successful HHA reference response", () => {
  const xml = [
    '<?xml version="1.0"?>',
    '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">',
    "<soap:Body>",
    '<GetCollectionStatusResponse xmlns="https://www.hhaexchange.com/apis/hhaws.integration">',
    "<GetCollectionStatusResult>",
    '<Result Status="Success" />',
    "<CollectionStatuses>",
    "<CollectionStatus><CollectionStatusID>7</CollectionStatusID><CollectionStatusValue>Open &amp; Active</CollectionStatusValue><Active>Yes</Active></CollectionStatus>",
    "</CollectionStatuses>",
    "</GetCollectionStatusResult>",
    "</GetCollectionStatusResponse>",
    "</soap:Body>",
    "</soap:Envelope>",
  ].join("");

  const parsed = parseHhaSoapResponse("GetCollectionStatus", 200, true, xml);

  assert.equal(parsed.ok, true);
  assert.equal(parsed.status, "Success");
  assert.equal(parsed.error, undefined);
  assert.ok(parsed.resultXml);

  const rows = extractElementBodies(parsed.resultXml, "CollectionStatus");
  assert.equal(rows.length, 1);
  assert.equal(extractElementText(rows[0] ?? "", "CollectionStatusValue"), "Open & Active");
});

test("normalizes HHA application errors and retry guidance", () => {
  const xml = [
    '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body>',
    '<GetCollectionStatusResponse xmlns="https://www.hhaexchange.com/apis/hhaws.integration">',
    "<GetCollectionStatusResult>",
    '<Result Status="Error"><ErrorInfo><ErrorID>42</ErrorID><ErrorMessage>Authentication rejected</ErrorMessage><RetryAfter>15</RetryAfter></ErrorInfo><Details><ProvidedPageNumber>2</ProvidedPageNumber><ErrorDetails>Retry the request later.</ErrorDetails></Details></Result>',
    "</GetCollectionStatusResult></GetCollectionStatusResponse>",
    "</soap:Body></soap:Envelope>",
  ].join("");

  const parsed = parseHhaSoapResponse("GetCollectionStatus", 200, true, xml);

  assert.equal(parsed.ok, false);
  assert.equal(parsed.status, "Error");
  assert.equal(parsed.retryAfter, "15");
  assert.equal(parsed.error?.kind, "application");
  assert.equal(parsed.error?.id, 42);
  assert.equal(parsed.error?.providedPageNumber, "2");
});

test("normalizes SOAP faults without exposing raw XML", () => {
  const xml = [
    '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body>',
    "<soap:Fault><faultcode>soap:Server</faultcode><faultstring>Temporary upstream failure</faultstring></soap:Fault>",
    "</soap:Body></soap:Envelope>",
  ].join("");

  const parsed = parseHhaSoapResponse("GetCollectionStatus", 500, false, xml, "10");

  assert.equal(parsed.ok, false);
  assert.equal(parsed.error?.kind, "soap_fault");
  assert.equal(parsed.error?.code, "soap:Server");
  assert.equal(parsed.retryAfter, "10");
  assert.equal("xml" in parsed, false);
});

test("shared budget defers writes and blocks subsequent reads before transport", async () => {
  const original = globalThis.fetch; let calls = 0, deferred = 0, reservations = 0;
  globalThis.fetch = async () => { calls++; return new Response("unavailable", { status: 503, headers: { "retry-after": "120" } }); };
  try {
    const client = new HhaSoapClient("https://example.invalid", { appName: "app", appKey: "key", appSecret: "secret" }, {
      async beforeRequest() { reservations++; if (deferred) throw new Error("vendor_backoff_active"); },
      async defer(seconds) { deferred = seconds; },
    });
    const result = await client.call("UpdateCaregiverRate");
    assert.equal(result.outcome, "unknown"); assert.equal(calls, 1); assert.equal(deferred, 120);
    await assert.rejects(client.call("GetCollectionStatus"), /vendor_backoff_active/);
    assert.equal(calls, 1); assert.equal(reservations, 2);
  } finally { globalThis.fetch = original; }
});

test("backoff persistence failure never triggers an automatic retry", async () => {
  const original = globalThis.fetch; let calls = 0;
  globalThis.fetch = async () => { calls++; return new Response("unavailable", { status: 503, headers: { "retry-after": "1" } }); };
  try {
    const client = new HhaSoapClient("https://example.invalid", { appName: "app", appKey: "key", appSecret: "secret" }, {
      async beforeRequest() {}, async defer() { throw new Error("storage unavailable"); },
    });
    const result = await client.call("GetCollectionStatus");
    assert.equal(result.ok, false); assert.equal(result.retryable, false); assert.equal(calls, 1);
  } finally { globalThis.fetch = original; }
});

test("application retry guidance is persisted even without an HTTP retry header", async () => {
  const original = globalThis.fetch; let deferred = 0;
  globalThis.fetch = async () => new Response('<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><UpdateCaregiverRateResponse><UpdateCaregiverRateResult><Result Status="Error"><ErrorInfo><ErrorID>42</ErrorID><RetryAfter>90</RetryAfter></ErrorInfo></Result></UpdateCaregiverRateResult></UpdateCaregiverRateResponse></soap:Body></soap:Envelope>');
  try {
    const client = new HhaSoapClient("https://example.invalid", { appName: "app", appKey: "key", appSecret: "secret" }, {
      async beforeRequest() {}, async defer(seconds) { deferred = seconds; },
    });
    const result = await client.call("UpdateCaregiverRate");
    assert.equal(result.outcome, "unknown"); assert.equal(deferred, 90);
  } finally { globalThis.fetch = original; }
});


test("mutation budget denial is provably pre-dispatch with zero vendor requests", async () => {
  const original = globalThis.fetch; let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error("must not dispatch"); };
  try {
    const client = new HhaSoapClient("https://example.invalid", { appName: "app", appKey: "key", appSecret: "secret" }, {
      async beforeRequest() { throw new Error("vendor_backoff_active"); }, async defer() {},
    });
    await assert.rejects(client.call("UpdateCaregiverRate"), HhaNotSubmittedError);
    assert.equal(calls, 0);
  } finally { globalThis.fetch = original; }
});
