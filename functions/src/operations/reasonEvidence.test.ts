import assert from "node:assert/strict";
import test from "node:test";
import type { HhaSoapClient } from "../integrations/hhaexchange/client.js";
import { operationalRead } from "./reads.js";
import { vendorContractBlocked } from "../integrations/hhaexchange/contractGates.js";
const operation = "GetVisitEditReasonActionTaken";
function client(xml: string, ok = true): Pick<HhaSoapClient, "call"> {
  return { call: async name => ({ operation: name, httpStatus: 200, transportOk: true, ok, status: "Success", resultXml: xml,
    correlationId: "synthetic", attempts: 1, durationMs: 1, retryable: false }) };
}
const read = (xml: string) => operationalRead(client(xml), { operation, id: "77" });
const action = (id: string, label: string, description: string, status: string) => `<VisitEditActionTakenInfo><VisitEditActionTakenReasonID>${id}</VisitEditActionTakenReasonID><VisitEditActionTakenReason>${label}</VisitEditActionTakenReason><VisitEditActionTakenReasonDescription>${description}</VisitEditActionTakenReasonDescription><VisitEditActionTakenStatus>${status}</VisitEditActionTakenStatus></VisitEditActionTakenInfo>`;
const reason = (id: string, actions: string) => `<VisitEditReasonInfo><VisitEditReasonID>${id}</VisitEditReasonID><VisitEditReason>Reason</VisitEditReason><VisitEditReasonDescription>Reason description</VisitEditReasonDescription><VisitEditStatus>Unmapped</VisitEditStatus>${actions}</VisitEditReasonInfo>`;

test("typed reason/action evidence preserves delimiters, descriptions and repeated associations without changing legacy records", async () => {
  const result = await read(reason("1", action("9", "A | B; C", "First &amp; second", "Unknown")) + reason("2", action("9", "Same ID", "Different association", "0") + action("9", "Repeated", "", "")));
  assert.deepEqual(result.visitEditReasons, [
    { id: "1", label: "Reason", description: "Reason description", status: "Unmapped", actions: [{ id: "9", label: "A | B; C", description: "First & second", status: "Unknown" }] },
    { id: "2", label: "Reason", description: "Reason description", status: "Unmapped", actions: [{ id: "9", label: "Same ID", description: "Different association", status: "0" }, { id: "9", label: "Repeated", description: "", status: "" }] }
  ]);
  assert.equal(result.records[0]!.Actions, "9 | A | B; C | Unknown");
  assert.equal(result.records[1]!.Actions, "9 | Same ID | 0; 9 | Repeated | ");
  assert.equal(result.validation, "source_unvalidated");
  assert.equal(result.timezone, "source_values_unconverted");
  assert.equal(vendorContractBlocked(operation), true);
});

test("missing, empty, duplicate and nested fields remain distinct from affirmative action evidence", async () => {
  const result = await read(`<VisitEditReasonInfo><VisitEditReasonID>1</VisitEditReasonID><VisitEditActionTakenInfo><VisitEditActionTakenReasonID>9</VisitEditActionTakenReasonID><VisitEditActionTakenReasonID>10</VisitEditActionTakenReasonID><VisitEditActionTakenReason/><VisitEditActionTakenReasonDescription xsi:nil="true"/><Other><VisitEditActionTakenStatus>Active</VisitEditActionTakenStatus></Other></VisitEditActionTakenInfo></VisitEditReasonInfo>`);
  assert.deepEqual(result.visitEditReasons, [{ id: "1", label: null, description: null, status: null, actions: [{ id: null, label: "", description: null, status: null }] }]);
  const none = await read(reason("2", "")); assert.deepEqual(none.visitEditReasons![0]!.actions, []);
});

test("qualified fields and CDATA preserve exact descriptions without borrowing unrelated nested actions", async () => {
  const xml = reason("1", action("9", "Synthetic", "<![CDATA[  literal | ; <text>  ]]>", "Unrecognized") + `<Other>${action("10", "Unrelated", "Not a direct action", "Active")}</Other>`).replace(/<(\/?)(VisitEdit\w+)/g, "<$1h:$2");
  const result = await read(xml);
  assert.equal(result.visitEditReasons![0]!.actions.length, 1);
  assert.equal(result.visitEditReasons![0]!.actions[0]!.description, "  literal | ; <text>  ");
});

test("typed associations use the same 200-reason preview bound and explicit truncation as records", async () => {
  const result = await read(Array.from({length: 201}, (_, i) => reason(String(i + 1), action("9", "Synthetic", "Description", "Unknown"))).join(""));
  assert.equal(result.truncated, true); assert.equal(result.records.length, 200); assert.equal(result.visitEditReasons!.length, 200);
  assert.equal(result.visitEditReasons![199]!.id, "200");
});

test("empty responses stay unvalidated, failed responses reject and unrelated reads have no reason projection", async () => {
  const empty = await read("<VisitEditReasonActionTaken/>"); assert.deepEqual(empty.visitEditReasons, []); assert.equal(empty.validation, "source_unvalidated");
  await assert.rejects(operationalRead(client("<Result/>", false), { operation, id: "77" }), /hha_read_failed/);
  const other = await operationalRead(client("<VisitInfo><ID>77</ID></VisitInfo>"), {operation: "GetVisitInfoV3", id: "77"});
  assert.equal(other.visitEditReasons, undefined);
});


test("review fixtures ignore commented reasons and join CDATA while preserving literal closing tags", async () => {
  const a = '<VisitEditActionTakenInfo><VisitEditActionTakenReasonID>9</VisitEditActionTakenReasonID><VisitEditActionTakenStatus>Unknown</VisitEditActionTakenStatus></VisitEditActionTakenInfo>';
  const r = (body: string) => `<VisitEditReasonInfo><VisitEditReasonID>1</VisitEditReasonID>${body}</VisitEditReasonInfo>`;
  const wrapped = (body: string) => `<VisitEditReasonActionTaken>${body}</VisitEditReasonActionTaken>`;
  const commented = await read(wrapped(`<!--${r(a)}-->${r('')}`));
  assert.equal(commented.visitEditReasons!.length, 1); assert.deepEqual(commented.visitEditReasons![0]!.actions, []);
  assert.equal(commented.records.length, 2, "legacy regex projection unchanged");
  const adjacent = await read(wrapped(r('<VisitEditReasonDescription><![CDATA[A]]><![CDATA[B]]></VisitEditReasonDescription>')));
  assert.equal(adjacent.visitEditReasons![0]!.description, 'AB');
  const literal = await read(wrapped(r('<VisitEditReasonDescription><![CDATA[</VisitEditReasonInfo> literal]]></VisitEditReasonDescription>'+a)));
  assert.equal(literal.visitEditReasons![0]!.id, '1');
  assert.equal(literal.visitEditReasons![0]!.description, '</VisitEditReasonInfo> literal');
  assert.equal(literal.visitEditReasons![0]!.actions[0]!.id, '9');
});


test("typed scalar decoding joins text, comments and CDATA and decodes XML references only once", async () => {
  const result = await read(reason("1", action("&#57;", "A<!--ignored-->B<![CDATA[&amp;]]>&amp;#57;", "&#65;&#x42;", "Unknown")));
  assert.equal(result.visitEditReasons![0]!.actions[0]!.id, "9");
  assert.equal(result.visitEditReasons![0]!.actions[0]!.label, "AB&amp;&#57;");
  assert.equal(result.visitEditReasons![0]!.actions[0]!.description, "AB");
  const nil = await read('<VisitEditReasonInfo><VisitEditReasonID xsi:nil="&#32;true&#32;">1</VisitEditReasonID></VisitEditReasonInfo>');
  assert.equal(nil.visitEditReasons![0]!.id, null);
});

test("malformed and declaration-bearing typed evidence rejects without evaluating external entities", async () => {
  for (const xml of [
    reason("1", "") + '<bad',
    '<!DOCTYPE x [<!ENTITY e SYSTEM "file:///synthetic">]>' + reason("1", ""),
    '<!--'.repeat(16000),
    '<x>'.repeat(101) + '</x>'.repeat(101),
    '</EvidenceResult><EvidenceResult>',
  ]) await assert.rejects(read(xml), /invalid_reason_evidence_xml/);
});


test("typed reason overflow independently marks 200 versus 201 self-closing and mixed reasons", async () => {
  for (const mixed of [false, true]) for (const count of [200, 201]) {
    const xml = Array.from({length: count}, (_, i) => mixed && i % 2 ? reason(String(i + 1), "") : "<VisitEditReasonInfo/>").join("");
    const result = await read(`<VisitEditReasonActionTaken>${xml}</VisitEditReasonActionTaken>`);
    assert.equal(result.visitEditReasons!.length, Math.min(count, 200));
    assert.equal(result.truncated, count > 200);
    assert.equal(result.records.length, mixed ? Math.floor(count / 2) : 0, "legacy records remain unchanged");
  }
});
