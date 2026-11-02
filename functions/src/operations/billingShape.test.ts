import assert from "node:assert/strict";
import test from "node:test";
import { operationalRead } from "./reads.js";
import { billingResponseShape } from "./billingShape.js";

async function read(resultXml: string, status?: string) {
  return operationalRead({ async call(operation) { return { operation, ok: true, transportOk: true, httpStatus: 200, correlationId: "synthetic", attempts: 1, durationMs: 1, retryable: false, resultXml, ...(status ? { status } : {}) }; } }, { operation: "GetVisitBillInfoV2", id: "14" });
}

test("empty billing diagnostics distinguish absent, nil, versioned and encoded markup without source values", async () => {
  for (const [xml, expected, versioned, encoded] of [
    ["<Result Status='Success'/>", "absent", "absent", false],
    ["<v:VisitBillInfo xmlns:v='urn:synthetic' xsi:nil='true'/>", "self_closed_nil", "absent", false],
    ["<VisitBillInfo/>", "self_closed", "absent", false],
    ["<VisitBillInfoV2><ID>private-synthetic-marker</ID></VisitBillInfoV2>", "absent", "paired", false],
    ["&lt;VisitBillInfo&gt;private-synthetic-marker&lt;/VisitBillInfo&gt;", "absent", "absent", true],
    ["<!-- <VisitBillInfo/> --><![CDATA[<VisitBillInfo/>]]>", "absent", "absent", false]
  ] as const) {
    const data = await read(xml, "Success"), shape = Reflect.get(data, "billingShape");
    assert.equal(data.records.length, 0);
    assert.deepEqual(shape, { expected, versioned, encoded, successStatus: "explicit" });
    assert.equal(JSON.stringify(shape).includes("private-synthetic-marker"), false);
  }
  assert.equal((await read("<Result/>")).billingShape?.successStatus, "implicit");
  assert.equal(billingResponseShape('<VisitBillInfo/><VisitBillInfo/>', 'Success').expected, 'multiple');
});

test("a projected billing record receives no empty-source diagnostic and retains exact identity", async () => {
  const data = await read("<VisitBillInfo><ID>14</ID><Patient><ID>13</ID></Patient><Caregiver><ID>15</ID></Caregiver><VisitDate>2026-10-24</VisitDate></VisitBillInfo>");
  assert.equal(data.records[0]?.ID, "14");
  assert.equal(Reflect.get(data, "billingShape"), undefined);
});
