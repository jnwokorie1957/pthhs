import assert from "node:assert/strict";
import test from "node:test";
import { operationalRead } from "./reads.js";

test("V3 preserves optional original and split references without another read or time fallback", async () => {
  const calls: string[] = [];
  const data = await operationalRead({ async call(operation, body, attempts) {
    calls.push(operation);
    assert.equal(body, "<VisitInfo><ID>77</ID></VisitInfo>");
    assert.equal(attempts, 1);
    return { operation, ok: true, transportOk: true, httpStatus: 200, correlationId: "synthetic", attempts: 1, durationMs: 1, retryable: false,
      resultXml: '<VisitInfo><ID>77</ID><Patient><ID>5</ID></Patient><Caregiver><ID>6</ID></Caregiver><OriginalVisitID>9223372036854775807</OriginalVisitID><SplitVisitID>00088</SplitVisitID><ScheduleStartTime>2026-10-24 08:00</ScheduleStartTime><SuggestedEndTime>2026-10-24 12:00</SuggestedEndTime><PayHours>4</PayHours></VisitInfo>' };
  } }, { operation: "GetVisitInfoV3", id: "77" });
  assert.deepEqual(calls, ["GetVisitInfoV3"]);
  const row = data.records[0]!;
  assert.equal(row.OriginalVisitID, "9223372036854775807");
  assert.equal(row.SplitVisitID, "00088");
  for (const field of ["VisitStartTime", "VisitEndTime", "EVVStartTime", "EVVEndTime", "ActualHours", "ActualHoursRounded"]) assert.equal(row[field], null);
  assert.equal(row.ID, "77");
  assert.equal(data.validation, "source_unvalidated");
});

test("V3 reference projection requires unique direct scalars and preserves zero, empty and missing separately", async () => {
  const cases: [string, string | null, string | null][] = [
    ['<OriginalVisitID>0</OriginalVisitID><SplitVisitID/>', "0", ""],
    ['<Other><OriginalVisitID>88</OriginalVisitID><SplitVisitID>99</SplitVisitID></Other>', null, null],
    ['<OriginalVisitID>88</OriginalVisitID><OriginalVisitID>89</OriginalVisitID><SplitVisitID><ID>99</ID></SplitVisitID>', null, null],
    ['<OriginalVisitID xsi:nil="true"/><SplitVisitID xsi:nil="1"/>', null, null],
    ['<v:OriginalVisitID>88</v:OriginalVisitID><v:SplitVisitID>99</v:SplitVisitID>', "88", "99"],
  ];
  for (const [fields, original, split] of cases) {
    const data = await operationalRead({ async call(operation) {
      return { operation, ok: true, transportOk: true, httpStatus: 200, correlationId: "synthetic", attempts: 1, durationMs: 1, retryable: false,
        resultXml: `<VisitInfo xmlns:v="urn:synthetic" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><ID>77</ID>${fields}</VisitInfo>` };
    } }, { operation: "GetVisitInfoV3", id: "77" });
    assert.equal(data.records[0]?.OriginalVisitID, original);
    assert.equal(data.records[0]?.SplitVisitID, split);
  }
});
