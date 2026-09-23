import assert from "node:assert/strict";
import test from "node:test";
import { HhaSoapClient } from "./client.js";
import { visitCheckpointCodec } from "./visitChangesAdapter.js";

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
