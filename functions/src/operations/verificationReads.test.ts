import assert from "node:assert/strict";
import test from "node:test";
import type { HhaSoapClient } from "../integrations/hhaexchange/client.js";
import { operationalRead } from "./reads.js";

function client(xml: string): Pick<HhaSoapClient, "call"> {
  return { call: async operation => ({ operation, httpStatus: 200, transportOk: true, ok: true, status: "Success", resultXml: xml,
    correlationId: "synthetic", attempts: 1, durationMs: 0, retryable: false }) };
}

test("captured V2/V3 Verification child paths project separately from aggregation and preserve raw date/time values", async () => {
  const xml = `<VisitInfo><ID>77</ID><Verification><VerifiedBy>Synthetic reviewer</VerifiedBy><Notes>Original &amp; retained</Notes><VerifiedDate>2026-10-10T12:05:00-05:00</VerifiedDate><VerifiedTime>12:05:00</VerifiedTime><SupervisorName>Synthetic supervisor</SupervisorName></Verification><VisitAggregationStatus><Status>Different aggregation state</Status><StatusDate>2026-10-10T00:00:00</StatusDate></VisitAggregationStatus></VisitInfo>`;
  for (const operation of ["GetVisitInfoV2", "GetVisitInfoV3"] as const) {
    const result = await operationalRead(client(xml), { operation, id: "77" }), row = result.records[0]!;
    assert.equal(row["Verification/VerifiedBy"], "Synthetic reviewer"); assert.equal(row["Verification/Notes"], "Original & retained");
    assert.equal(row["Verification/VerifiedDate"], "2026-10-10T12:05:00-05:00"); assert.equal(row["Verification/VerifiedTime"], "12:05:00");
    assert.equal(row["Verification/SupervisorName"], "Synthetic supervisor"); assert.equal(result.validation, "source_unvalidated"); assert.equal(result.timezone, "source_values_unconverted");
    assert.equal(row.Verified, undefined);
  }
});

test("absent Verification produces explicit null receipt fields and never copies an unrelated child's receipt", async () => {
  const result = await operationalRead(client(`<VisitInfo><ID>77</ID><Caregiver><Verification><VerifiedBy>Unrelated</VerifiedBy><VerifiedDate>2026-10-10T12:05:00-05:00</VerifiedDate></Verification></Caregiver><VisitAggregationStatus><Status>Verified</Status></VisitAggregationStatus></VisitInfo>`), { operation: "GetVisitInfoV3", id: "77" });
  assert.equal(result.records[0]!["Verification/VerifiedBy"], null);
  assert.equal(result.records[0]!["Verification/VerifiedDate"], null);
  assert.equal(result.records[0]!["Verification/VerifiedTime"], null);
});

test("duplicate receipt objects/fields and nil receipts cannot produce affirmative source evidence", async () => {
  for (const receipt of [
    `<Verification><VerifiedBy>First</VerifiedBy></Verification><Verification><VerifiedBy>Second</VerifiedBy></Verification>`,
    `<Verification><VerifiedBy>Reviewer</VerifiedBy><VerifiedDate>2026-10-10T12:05:00-05:00</VerifiedDate><VerifiedDate>2026-10-10T12:06:00-05:00</VerifiedDate></Verification>`,
    `<Verification xsi:nil="true"><VerifiedBy>Reviewer</VerifiedBy></Verification>`,
  ]) {
    const result = await operationalRead(client(`<VisitInfo><ID>77</ID>${receipt}</VisitInfo>`), { operation: "GetVisitInfoV3", id: "77" });
    assert.equal(result.records[0]!["Verification/VerifiedBy"], null); assert.equal(result.records[0]!["Verification/VerifiedDate"], null);
  }
});

test("qualified direct receipt tags preserve CDATA and ignore comment lookalikes", async () => {
  const xml = `<VisitInfo><ID>77</ID><!-- <Verification><VerifiedBy>Comment</VerifiedBy></Verification> --><h:Verification xmlns:h="urn:synthetic"><h:VerifiedBy>Synthetic &amp; reviewer</h:VerifiedBy><h:Notes><![CDATA[Original <Verification> text]]></h:Notes><h:VerifiedDate>2026-10-10T12:05:00-05:00</h:VerifiedDate><h:VerifiedTime>12:05:00</h:VerifiedTime><h:SupervisorName>Synthetic supervisor</h:SupervisorName></h:Verification></VisitInfo>`;
  const result = await operationalRead(client(xml), { operation: "GetVisitInfoV3", id: "77" });
  assert.equal(result.records[0]!["Verification/VerifiedBy"], "Synthetic & reviewer");
  assert.equal(result.records[0]!["Verification/Notes"], "Original <Verification> text");
  assert.equal(result.records[0]!["Verification/VerifiedDate"], "2026-10-10T12:05:00-05:00");
});
