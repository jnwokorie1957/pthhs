import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { HhaSoapClient } from "../integrations/hhaexchange/client.js";
import { HhaNotSubmittedError } from "../integrations/hhaexchange/dispatch.js";
import { operationalRead, WorkflowError } from "./reads.js";

const credentials = { appName: "synthetic", appSecret: "synthetic", appKey: "synthetic" };
function deniedClient(failure: Error, context: TestContext) {
  let admissions = 0, dispatches = 0;
  const client = new HhaSoapClient("https://fixture.invalid", credentials, { async beforeRequest() { admissions++; throw failure; }, async defer() { assert.fail("a refused admission cannot create vendor response evidence"); } });
  context.mock.method(globalThis, "fetch", async () => { dispatches++; throw Error("must_not_dispatch"); });
  return { client, counts: () => ({ admissions, dispatches }) };
}

test("audited operational reads preserve known retry cursors even for single-attempt methods", async context => {
  for (const operation of ["GetVisitInfoV3", "GetPatientDemographics", "GetVisitBillInfoV2", "GetVisitBillInfo"] as const) for (const code of ["read_budget_exhausted_retry_next_minute", "vendor_backoff_active"]) {
    const denied = deniedClient(new WorkflowError(code, 429, 17), context);
    await assert.rejects(operationalRead(denied.client, { operation, id: "14" }), error => error instanceof WorkflowError && error.code === code && error.status === 429 && error.retryAfterSeconds === 17);
    assert.deepEqual(denied.counts(), { admissions: 1, dispatches: 0 });
  }
});

test("write admission refusals remain explicitly not submitted with no dispatch or retry", async context => {
  const denied = deniedClient(new WorkflowError("read_budget_exhausted_retry_next_minute", 429, 17), context);
  await assert.rejects(denied.client.call("CreateSchedule", "<ScheduleInfo/>", 1), error => error instanceof HhaNotSubmittedError && error.message === "hha_not_submitted");
  assert.deepEqual(denied.counts(), { admissions: 1, dispatches: 0 });
});

test("operational reads never unwrap arbitrary, untrusted or non-budget error causes", async () => {
  for (const cause of [Error("private-synthetic-marker"), { code: "vendor_backoff_active", status: 429, retryAfterSeconds: 17 }, new WorkflowError("unrelated_private_error", 500), new WorkflowError("vendor_backoff_active", 500, 17)]) {
    const wrapped = new HhaNotSubmittedError(); Object.defineProperty(wrapped, "cause", { value: cause });
    await assert.rejects(operationalRead({ async call() { throw wrapped; } }, { operation: "GetVisitBillInfo", id: "14" }), error => error === wrapped);
    assert.equal(JSON.stringify(wrapped).includes("private-synthetic-marker"), false);
  }
});
