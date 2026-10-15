import assert from "node:assert/strict";
import test from "node:test";
import type { HhaSoapClient } from "../integrations/hhaexchange/client.js";
import { operationalRead } from "./reads.js";
const client = (xml: string): Pick<HhaSoapClient, "call"> => ({ call: async operation => ({ operation, ok: true, httpStatus: 200, transportOk: true, resultXml: xml,
  correlationId: "synthetic-member", attempts: 1, durationMs: 0, retryable: false }) });

test("authorization projection preserves exact Contract/ID and ServiceCode/ID independent of labels and units", async () => {
  const result = await operationalRead(client(`<AuthorizationInfo><AuthorizationID>11</AuthorizationID><Patient><ID>5</ID></Patient><Contract><ID>8</ID><Name>Same label</Name></Contract><ServiceCode><ID>9</ID><Name>Same label</Name></ServiceCode><StartDate>2026-10-01</StartDate><StopDate>2026-10-31</StopDate><MaxUnits>100</MaxUnits><RemainingUnits>80</RemainingUnits></AuthorizationInfo>`), { operation: "GetPatientAuthorizationInfo", patientId: "5", id: "11" });
  assert.equal(result.records[0]!["Contract/ID"], "8"); assert.equal(result.records[0]!["ServiceCode/ID"], "9"); assert.equal(result.records[0]!.RemainingUnits, "80");
  assert.equal(result.records[0]!.UnitMinutes, undefined); assert.equal(result.validation, "source_unvalidated");
});

test("demographics projects recorded coverage dates and payer ID without identifiers or eligibility assertions", async () => {
  const result = await operationalRead(client(`<PatientInfo><PatientID>5</PatientID><OfficeID>123</OfficeID><PayerID>8</PayerID><PatientStatusName>Active</PatientStatusName><MedicaidNumber>Excluded identifier</MedicaidNumber><MedicaidStartDate>2026-10-01</MedicaidStartDate><MedicaidEndDate>2026-10-31</MedicaidEndDate><ManagedCareStartDate>2026-10-01T00:00:00</ManagedCareStartDate><ManagedCareEndDate>2026-10-31T00:00:00</ManagedCareEndDate></PatientInfo>`), { operation: "GetPatientDemographics", id: "5" });
  const row = result.records[0]!;
  assert.equal(row.PayerID, "8"); assert.equal(row.MedicaidStartDate, "2026-10-01"); assert.equal(row.MedicaidEndDate, "2026-10-31");
  assert.equal(row.ManagedCareStartDate, "2026-10-01T00:00:00"); assert.equal(row.ManagedCareEndDate, "2026-10-31T00:00:00");
  assert.equal(row.MedicaidNumber, undefined); assert.equal(row.EligibilityVerified, undefined); assert.equal(result.timezone, "source_values_unconverted");
});
