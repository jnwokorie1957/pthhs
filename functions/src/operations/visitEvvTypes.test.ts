import assert from "node:assert/strict";
import test from "node:test";
import { operationalRead } from "./reads.js";

async function read(fields: string) {
  const data = await operationalRead({ async call(operation) { return { operation, ok: true, transportOk: true, httpStatus: 200, correlationId: "synthetic", attempts: 1, durationMs: 1, retryable: false,
    resultXml: `<VisitInfo><ID>14</ID><Patient><ID>13</ID></Patient>${fields}</VisitInfo>` }; } }, { operation: "GetVisitInfoV3", id: "14" });
  return data.records[0]!;
}

test("V3 EVV source types preserve direct raw values, empty and zero without supplying a missing clock", async () => {
  for (const value of ["GPS In", "GPS Out", "0", "", " Source type "]) {
    const row = await read(`<ClockInEvvType>${value}</ClockInEvvType><ClockOutEvvType>${value}</ClockOutEvvType><EVVEndTime/>`);
    assert.equal(row.ClockInEvvType, value); assert.equal(row.ClockOutEvvType, value);
    assert.equal(row.EVVEndTime, ""); assert.equal(row.ActualHours, null);
  }
  const row = await read('<v:ClockInEvvType xmlns:v="urn:synthetic"><![CDATA[GPS In]]></v:ClockInEvvType><ClockOutEvvType/>');
  assert.equal(row.ClockInEvvType, "GPS In"); assert.equal(row.ClockOutEvvType, "");
});

test("EVV source-type evidence rejects absent, nested, duplicate, nil and non-scalar paths", async () => {
  for (const key of ["ClockInEvvType", "ClockOutEvvType"]) for (const fields of ["", `<Other><${key}>Foreign type</${key}></Other>`,
    `<${key}>A</${key}><${key}>B</${key}>`, `<${key} xsi:nil="true">A</${key}>`, `<${key}><Other>A</Other></${key}>`]) {
    assert.equal((await read(fields))[key], null, key);
  }
});
