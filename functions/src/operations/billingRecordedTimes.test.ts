import assert from "node:assert/strict";
import test from "node:test";
import { operationalRead } from "./reads.js";

const clocks = ["VisitStartTime", "VisitEndTime"] as const;
type Operation = "GetVisitBillInfo" | "GetVisitBillInfoV2";
async function read(operation: Operation, fields: string) {
  let calls = 0;
  const result = await operationalRead({ async call(sourceOperation, body, attempts) {
    calls++;
    assert.equal(sourceOperation, operation);
    assert.equal(body, "<VisitBillInfo><ID>77</ID></VisitBillInfo>");
    assert.equal(attempts, 1);
    return { operation, ok: true, transportOk: true, httpStatus: 200, correlationId: "synthetic", attempts: 1, durationMs: 1, retryable: false,
      resultXml: `<VisitBillInfo xmlns:v="urn:synthetic" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><ID>77</ID><VisitDate>2026-10-23</VisitDate><Patient><ID>5</ID></Patient><Caregiver><ID>6</ID></Caregiver><ScheduleStartTime>schedule-only</ScheduleStartTime><ScheduleEndTime>schedule-only</ScheduleEndTime><SuggestedEndTime>suggested-only</SuggestedEndTime><PrimaryBillTo><BilledMinutes>240</BilledMinutes><BilledAmount>99</BilledAmount></PrimaryBillTo>${fields}</VisitBillInfo>` };
  } }, { operation, id: "77" });
  assert.equal(calls, 1);
  assert.equal(result.operation, operation);
  assert.equal(result.source, "hhaexchange");
  assert.equal(result.records.length, 1);
  const row = result.records[0]!;
  assert.equal(row.ID, "77");
  assert.equal(row["Patient/ID"], "5");
  assert.equal(row["Caregiver/ID"], "6");
  assert.equal(row.VisitDate, "2026-10-23");
  assert.equal(row["PrimaryBillTo/BilledMinutes"], "240");
  assert.equal(row["PrimaryBillTo/BilledAmount"], "99");
  assert.equal("ActualHours" in row, false);
  assert.equal("EVVEndTime" in row, false);
  return row;
}

for (const operation of ["GetVisitBillInfo", "GetVisitBillInfoV2"] as const) {
  test(`${operation} retains documented recorded clocks as independent raw source fields`, async () => {
    const row = await read(operation, "<VisitStartTime>2026-10-23 06:15</VisitStartTime><VisitEndTime>2026-10-23 09:35</VisitEndTime>");
    assert.equal(row.VisitStartTime, "2026-10-23 06:15");
    assert.equal(row.VisitEndTime, "2026-10-23 09:35");
    for (const name of clocks) {
      assert.equal((await read(operation, `<${name}/>`))[name], "");
      assert.equal((await read(operation, `<v:${name}> 0 </v:${name}>`))[name], " 0 ");
      assert.equal((await read(operation, ""))[name], null);
    }
  });

  test(`${operation} never borrows ambiguous clocks or replaces them with schedule or billing data`, async () => {
    for (const name of clocks) {
      for (const fields of [
        `<Other><${name}>foreign-time</${name}></Other>`,
        `<${name}>first</${name}><v:${name}>second</v:${name}>`,
        `<${name}><Value>nested-time</Value></${name}>`,
        `<${name} xsi:nil=" true ">contradictory</${name}>`,
        `<${name} xsi:nil="1"/>`,
      ]) assert.equal((await read(operation, fields))[name], null);
      assert.equal((await read(operation, `<${name}/><Other><${name}>foreign-time</${name}></Other>`))[name], "");
    }
  });
}
