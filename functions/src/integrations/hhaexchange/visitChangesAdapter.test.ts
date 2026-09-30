import assert from "node:assert/strict";
import test from "node:test";
import { HhaSoapClient } from "./client.js";
import { createVisitChangesAdapter, visitCheckpointCodec } from "./visitChangesAdapter.js";

test("visit checkpoint round-trips explicit modified-after boundary and page", () => {
  const encoded = visitCheckpointCodec.encode({
    modifiedAfter: "2026-09-01T00:00:00",
    page: 4,
  });
  assert.deepEqual(
    visitCheckpointCodec.decode(encoded, "2026-08-01T00:00:00"),
    { modifiedAfter: "2026-09-01T00:00:00", page: 4 },
  );
});

test("visit checkpoint requires a valid encoded value", () => {
  assert.throws(
    () => visitCheckpointCodec.decode("not-a-checkpoint", "2026-08-01T00:00:00"),
    /invalid_visit_checkpoint/,
  );
});

test("HHA visit request envelope never omits Authentication", () => {
  const client = new HhaSoapClient("https://example.invalid", {
    appName: "app",
    appSecret: "secret",
    appKey: "key",
  });
  const xml = client.buildEnvelope(
    "GetVisitChangesV5",
    "<ModifiedAfter>2026-09-01</ModifiedAfter><PageNumber>1</PageNumber>",
  );
  assert.match(xml, /<Authentication>/);
  assert.match(xml, /<GetVisitChangesV5 /);
});

test("empty resumed sync preserves the durable boundary", async () => {
  const client = new HhaSoapClient("https://example.invalid", { appName: "app", appSecret: "secret", appKey: "key" });
  client.call = async () => ({ ok: true, transportOk: true, operation: "GetVisitChangesV5", httpStatus: 200, resultXml: "<Pagination><CurrentPage>1</CurrentPage><TotalPages>1</TotalPages><TotalRecords>0</TotalRecords></Pagination>", correlationId: "synthetic", attempts: 1, durationMs: 1, retryable: false });
  const adapter = createVisitChangesAdapter(client, "2026-08-01T00:00:00Z", { async resolveOrCreateId() { return "synthetic"; } });
  const page = await adapter.fetchPage(visitCheckpointCodec.encode({ modifiedAfter: "2026-09-20T00:00:00Z", page: 1 }));
  assert.equal(visitCheckpointCodec.decode(page.nextCheckpoint, "").modifiedAfter, "2026-09-20T00:00:00Z");
});

test("malformed rows cannot disappear behind a successful page", async () => {
  const client = new HhaSoapClient("https://example.invalid", { appName: "app", appSecret: "secret", appKey: "key" });
  client.call = async () => ({ ok: true, transportOk: true, operation: "GetVisitChangesV5", httpStatus: 200, resultXml: "<GetVisitChangesV5Info><Patient><ID>synthetic</ID></Patient></GetVisitChangesV5Info>", correlationId: "synthetic", attempts: 1, durationMs: 1, retryable: false });
  const adapter = createVisitChangesAdapter(client, "2026-08-01T00:00:00Z", { async resolveOrCreateId() { return "synthetic"; } });
  await assert.rejects(adapter.fetchPage(), /visit_missing_source_id/);
});
