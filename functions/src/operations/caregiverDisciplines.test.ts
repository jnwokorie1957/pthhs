import assert from "node:assert/strict";
import test from "node:test";
import { operationalRead } from "./reads.js";

async function disciplines(fields: string) {
  const data = await operationalRead({ async call(operation) {
    return { operation, ok: true, transportOk: true, httpStatus: 200, correlationId: "synthetic", attempts: 1, durationMs: 1, retryable: false,
      resultXml: `<CaregiverInfo xmlns:v="urn:synthetic" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><ID>15</ID>${fields}</CaregiverInfo>` };
  } }, { operation: "GetCaregiverDemographics", id: "15" });
  assert.equal(data.records[0]?.ID, "15");
  return data.records[0]?.EmploymentDisciplines;
}

test("caregiver disciplines preserve exact direct source values and a genuinely empty list", async () => {
  assert.equal(await disciplines('<EmploymentTypes><Discipline>Synthetic A</Discipline><Discipline> Synthetic B </Discipline><Discipline/></EmploymentTypes>'), '["Synthetic A"," Synthetic B ",""]');
  assert.equal(await disciplines('<v:EmploymentTypes><!-- source list --><v:Discipline>Synthetic A</v:Discipline></v:EmploymentTypes>'), '["Synthetic A"]');
  assert.equal(await disciplines('<EmploymentTypes/>'), '[]');
});

test("unproved caregiver discipline lists never become an apparently empty or partial list", async () => {
  for (const xml of ['', '<EmploymentTypes xsi:nil="true"/>',
    '<EmploymentTypes/><EmploymentTypes><Discipline>Synthetic A</Discipline></EmploymentTypes>',
    '<Other><EmploymentTypes><Discipline>Synthetic A</Discipline></EmploymentTypes></Other>',
    '<EmploymentTypes><Other><Discipline>Synthetic A</Discipline></Other></EmploymentTypes>',
    '<EmploymentTypes><Discipline>Synthetic A</Discipline><Other><Discipline>Synthetic B</Discipline></Other></EmploymentTypes>',
    '<EmploymentTypes><Discipline><Name>Synthetic A</Name></Discipline></EmploymentTypes>',
    '<EmploymentTypes><Discipline xsi:nil="1"/></EmploymentTypes>',
    '<EmploymentTypes>' + '<Discipline>A</Discipline>'.repeat(201) + '</EmploymentTypes>',
    '<EmploymentTypes><Discipline>' + 'A'.repeat(1001) + '</Discipline></EmploymentTypes>']) {
    assert.equal(await disciplines(xml), null);
  }
});
