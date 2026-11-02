import assert from "node:assert/strict";
import test from "node:test";
import type { HhaSoapClient } from "../integrations/hhaexchange/client.js";
import { operationalRead } from "./reads.js";
import { patientAuthorizationRead } from "./patientAuthorizations.js";
import type { OperationsWorkspace } from "./workspace.js";
const client = (xml: string): Pick<HhaSoapClient, "call"> => ({ call: async operation => ({ operation, ok: true, httpStatus: 200, transportOk: true, resultXml: xml,
  correlationId: "synthetic-member", attempts: 1, durationMs: 0, retryable: false }) });

test("authorization projection preserves exact Contract/ID and ServiceCode/ID independent of labels and units", async () => {
  const result = await operationalRead(client(`<AuthorizationInfo><AuthorizationID>11</AuthorizationID><Patient><ID>5</ID></Patient><Contract><ID>8</ID><Name>Same label</Name></Contract><ServiceCode><ID>9</ID><Name>Same label</Name></ServiceCode><StartDate>2026-10-01</StartDate><StopDate>2026-10-31</StopDate><MaxUnits>100</MaxUnits><RemainingUnits>80</RemainingUnits></AuthorizationInfo>`), { operation: "GetPatientAuthorizationInfo", patientId: "5", id: "11" });
  assert.equal(result.records[0]!["Contract/ID"], "8"); assert.equal(result.records[0]!["ServiceCode/ID"], "9"); assert.equal(result.records[0]!.RemainingUnits, "80");
  assert.equal(result.records[0]!.UnitMinutes, undefined); assert.equal(result.validation, "source_unvalidated");
});

test("authorization discovery identities require unique direct scalar fields", async () => {
  for (const [body, field] of [
    ['<Other><ID>11</ID></Other><ContractID>8</ContractID>', 'ID'],
    ['<ID>11</ID><ID>12</ID><ContractID>8</ContractID>', 'ID'],
    ['<ID>11</ID><Other><ContractID>8</ContractID></Other>', 'ContractID'],
    ['<ID>11</ID><ContractID>8</ContractID><ContractID>9</ContractID>', 'ContractID']
  ]) {
    const result = await operationalRead(client(`<Authorization>${body}</Authorization>`), { operation: 'SearchPatientAuthorizations', patientId: '5' });
    assert.equal(result.records[0]![field!], null, body);
  }
});

test("authorization detail identity paths reject duplicate and nested source proof", async () => {
  const valid = '<AuthorizationID>11</AuthorizationID><Patient><ID>5</ID></Patient><Contract><ID>8</ID></Contract><ServiceCode><ID>9</ID></ServiceCode>';
  for (const [original, replacement, field] of [
    ['<AuthorizationID>11</AuthorizationID>', '<Other><AuthorizationID>11</AuthorizationID></Other>', 'AuthorizationID'],
    ['<AuthorizationID>11</AuthorizationID>', '<AuthorizationID>11</AuthorizationID><AuthorizationID>12</AuthorizationID>', 'AuthorizationID'],
    ['<Patient><ID>5</ID></Patient>', '<Patient><ID>5</ID><ID>6</ID></Patient>', 'Patient/ID'],
    ['<Patient><ID>5</ID></Patient>', '<Patient><ID>5</ID></Patient><Patient><ID>6</ID></Patient>', 'Patient/ID'],
    ['<Patient><ID>5</ID></Patient>', '<Other><Patient><ID>5</ID></Patient></Other>', 'Patient/ID'],
    ['<Contract><ID>8</ID></Contract>', '<Contract><Other><ID>8</ID></Other></Contract>', 'Contract/ID'],
    ['<Contract><ID>8</ID></Contract>', '<Contract><ID>8</ID></Contract><Contract><ID>9</ID></Contract>', 'Contract/ID'],
    ['<ServiceCode><ID>9</ID></ServiceCode>', '<ServiceCode><ID>9</ID><ID>10</ID></ServiceCode>', 'ServiceCode/ID']
  ]) {
    const result = await operationalRead(client(`<AuthorizationInfo>${valid.replace(original!, replacement!)}</AuthorizationInfo>`), { operation: 'GetPatientAuthorizationInfo', patientId: '5', id: '11' });
    assert.equal(result.records[0]![field!], null, field);
  }
});

test("nil identity parents cannot supply patient proof even when they contain an ID", async () => {
  for (const operation of ['GetPatientAuthorizationInfo', 'GetVisitInfoV3'] as const) for (const nil of ['true', '1', ' true ']) {
    const root = operation === 'GetPatientAuthorizationInfo' ? 'AuthorizationInfo' : 'VisitInfo';
    const result = await operationalRead(client(`<${root}><ID>11</ID><AuthorizationID>11</AuthorizationID><Patient xsi:nil="${nil}"><ID>5</ID></Patient></${root}>`), { operation, patientId: '5', id: '11' });
    assert.equal(result.records[0]!['Patient/ID'], null, `${operation}/${nil}`);
  }
  const valid = await operationalRead(client('<AuthorizationInfo><AuthorizationID>11</AuthorizationID><Patient xsi:nil="false"><ID>5</ID></Patient><Contract><ID>8</ID></Contract></AuthorizationInfo>'), { operation: 'GetPatientAuthorizationInfo', patientId: '5', id: '11' });
  assert.equal(valid.records[0]!['Patient/ID'], '5');
  const otherAttribute = await operationalRead(client('<AuthorizationInfo><AuthorizationID>11</AuthorizationID><Patient nonnil="true"><ID>5</ID></Patient><Contract><ID>8</ID></Contract></AuthorizationInfo>'), { operation: 'GetPatientAuthorizationInfo', patientId: '5', id: '11' });
  assert.equal(otherAttribute.records[0]!['Patient/ID'], '5');
});

test("protected authorization detail withholds records when actual XML identity is ambiguous", async () => {
  for (const body of [
    '<AuthorizationID>11</AuthorizationID><Patient><ID>5</ID><ID>6</ID></Patient><Contract><ID>8</ID></Contract>',
    '<AuthorizationID>11</AuthorizationID><Patient><ID>5</ID></Patient><Contract><ID>8</ID><ID>9</ID></Contract>',
    '<Other><AuthorizationID>11</AuthorizationID></Other><Patient><ID>5</ID></Patient><Contract><ID>8</ID></Contract>'
  ]) {
    const calls: string[] = [];
    const workspace = {
      async settings() { return { dataApproved: true, settings: { officeId: '12', enabledReads: ['GetPatientDemographics', 'GetPatientAuthorizationInfo'] } }; },
      async query(input: Parameters<typeof operationalRead>[1]) {
        calls.push(input.operation);
        return operationalRead(client(input.operation === 'GetPatientDemographics' ? '<PatientInfo><PatientID>5</PatientID><OfficeID>12</OfficeID></PatientInfo>' : `<AuthorizationInfo>${body}</AuthorizationInfo>`), input);
      }
    } as unknown as OperationsWorkspace;
    await assert.rejects(patientAuthorizationRead(workspace, { operation: 'GetPatientAuthorizationInfo', patientId: '5', officeId: '12', id: '11', contractId: '8' }, 'synthetic-admin'), /authorization_identity_unavailable/);
    assert.deepEqual(calls, ['GetPatientDemographics', 'GetPatientAuthorizationInfo']);
  }
});

test("demographics projects recorded coverage dates and payer ID without identifiers or eligibility assertions", async () => {
  const result = await operationalRead(client(`<PatientInfo><PatientID>5</PatientID><OfficeID>123</OfficeID><PayerID>8</PayerID><PatientStatusName>Active</PatientStatusName><MedicaidNumber>Excluded identifier</MedicaidNumber><MedicaidStartDate>2026-10-01</MedicaidStartDate><MedicaidEndDate>2026-10-31</MedicaidEndDate><ManagedCareStartDate>2026-10-01T00:00:00</ManagedCareStartDate><ManagedCareEndDate>2026-10-31T00:00:00</ManagedCareEndDate></PatientInfo>`), { operation: "GetPatientDemographics", id: "5" });
  const row = result.records[0]!;
  assert.equal(row.PayerID, "8"); assert.equal(row.MedicaidStartDate, "2026-10-01"); assert.equal(row.MedicaidEndDate, "2026-10-31");
  assert.equal(row.ManagedCareStartDate, "2026-10-01T00:00:00"); assert.equal(row.ManagedCareEndDate, "2026-10-31T00:00:00");
  assert.equal(row.MedicaidNumber, undefined); assert.equal(row.EligibilityVerified, undefined); assert.equal(result.timezone, "source_values_unconverted");
});
