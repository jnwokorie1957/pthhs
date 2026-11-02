import assert from "node:assert/strict";
import test from "node:test";
import { operationalRead } from "./reads.js";

const names = ["ScheduleStartTime", "ScheduleEndTime", "VisitStartTime", "VisitEndTime", "EVVStartTime", "EVVEndTime", "ActualHours", "ActualHoursRounded"];
async function read(fields: string) {
  let calls = 0;
  const result = await operationalRead({ async call(operation, body, attempts) {
    calls++;
    assert.equal(operation, "GetVisitInfoV3");
    assert.equal(body, "<VisitInfo><ID>77</ID></VisitInfo>");
    assert.equal(attempts, 1);
    return { operation, ok: true, transportOk: true, httpStatus: 200, correlationId: "synthetic", attempts: 1, durationMs: 1, retryable: false,
      resultXml: `<VisitInfo xmlns:v="urn:synthetic" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><ID>77</ID><Patient><ID>5</ID></Patient><Caregiver><ID>6</ID></Caregiver>${fields}<BilledAmount>99</BilledAmount><PayHours>88</PayHours><SuggestedEndTime>2026-10-24 18:00</SuggestedEndTime></VisitInfo>` };
  } }, { operation: "GetVisitInfoV3", id: "77" });
  assert.equal(calls, 1);
  assert.equal(result.records[0]?.ID, "77");
  assert.equal(result.records[0]?.["Patient/ID"], "5");
  assert.equal(result.records[0]?.BilledAmount, "99");
  return result.records[0]!;
}

test("V3 time and hour projection preserves explicit empty, zero and exact text independently", async () => {
  for (const name of names) {
    assert.equal((await read(`<${name}/>`))[name], "");
    assert.equal((await read(`<v:${name}></v:${name}>`))[name], "");
    assert.equal((await read(`<${name}>0</${name}>`))[name], "0");
    assert.equal((await read(`<${name}> 0.00 </${name}>`))[name], " 0.00 ");
    assert.equal((await read(""))[name], null);
  }
  const row = await read('<ScheduleDuration><ScheduleDurationHours>0</ScheduleDurationHours><ScheduleDurationMinutes/></ScheduleDuration><ActualHours/><ActualHoursRounded>0.00</ActualHoursRounded>');
  assert.equal(row["ScheduleDuration/ScheduleDurationHours"], "0");
  assert.equal(row["ScheduleDuration/ScheduleDurationMinutes"], "");
  assert.equal(row.ActualHours, "");
  assert.equal(row.ActualHoursRounded, "0.00");
  assert.equal(row.VisitEndTime, null);
  assert.equal(row.EVVEndTime, null);
});

test("V3 clock and duration fields never borrow nested, duplicate or nil evidence", async () => {
  for (const name of names) {
    for (const xml of [
      `<Other><${name}>nested-only</${name}></Other>`,
      `<${name}>first</${name}><v:${name}>second</v:${name}>`,
      `<${name}><Value>nested-content</Value></${name}>`,
      `<${name} xsi:nil=" true ">contradictory</${name}>`,
      `<${name} xsi:nil='1'/>`,
    ]) assert.equal((await read(xml))[name], null, `${name}: ${xml}`);
    assert.equal((await read(`<${name}/><Other><${name}>nested</${name}></Other>`))[name], "");
  }
  for (const xml of [
    '<Other><ScheduleDuration><ScheduleDurationHours>7</ScheduleDurationHours></ScheduleDuration></Other>',
    '<ScheduleDuration xsi:nil=" true "><ScheduleDurationHours>7</ScheduleDurationHours></ScheduleDuration>',
    '<ScheduleDuration><ScheduleDurationHours>7</ScheduleDurationHours></ScheduleDuration><ScheduleDuration><ScheduleDurationHours>8</ScheduleDurationHours></ScheduleDuration>',
    '<ScheduleDuration><Other><ScheduleDurationHours>7</ScheduleDurationHours></Other></ScheduleDuration>',
    '<ScheduleDuration><ScheduleDurationHours>7</ScheduleDurationHours><ScheduleDurationHours>8</ScheduleDurationHours></ScheduleDuration>',
  ]) assert.equal((await read(xml))["ScheduleDuration/ScheduleDurationHours"], null);
});
