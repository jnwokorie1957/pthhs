import assert from "node:assert/strict";
import test from "node:test";
import {
  extractElementBodies,
  extractElementText,
  parseHhaSoapResponse,
} from "./parser.js";

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
