import assert from "node:assert/strict";
import test from "node:test";
import { uploadForm, downloadForm, listForms, MAX_FORM_BYTES, type FormStore, type FormRecord, type FormKind } from "./library.js";
import { formRoute } from "./routes.js";
const pdf = Buffer.from("%PDF-1.4\nSynthetic form test only\n%%EOF\n");
const input = (extra = {}) => ({ kind: "templates", filename: "Synthetic form.pdf", base64: pdf.toString("base64"), ...extra });
function fixture() {
  const records = new Map<string, { record: FormRecord; generation: string; bytes: Buffer; actor: string }>();
  let pages: { kind: FormKind; cursor: string | undefined }[] = [];
  const store: FormStore = {
    async create(record, bytes, actor) { const key = record.kind + record.id; if (records.has(key)) return false; records.set(key, { record, bytes, actor, generation: "123" }); return true; },
    async metadata(kind, id) { const item = records.get(kind + id); if (!item) throw new Error("missing"); return item; },
    async page(kind, cursor) { pages.push({ kind, cursor }); return { items: [...records.values()].map(x => x.record).filter(x => x.kind === kind), nextCursor: cursor ? null : "next-page" }; },
    async bytes(kind, id, generation) { assert.equal(generation, "123"); return records.get(kind + id)!.bytes; }
  };
  return { store, records, pages };
}
test("private form round trip retains exact bytes, provenance and hash; duplicate retry does not overwrite", async () => {
  const f = fixture(), saved = await uploadForm(f.store, input(), "admin-a", new Date("2026-10-21T12:00:00Z"));
  assert.equal(saved.duplicate, false); assert.equal(saved.item.size, pdf.length);
  const retry = await uploadForm(f.store, input({ filename: "Another name.pdf" }), "admin-b");
  assert.equal(retry.duplicate, true); assert.deepEqual(retry.item, saved.item); assert.equal(f.records.size, 1);
  assert.equal([...f.records.values()][0]!.actor, "admin-a");
  const received = await downloadForm(f.store, "templates", saved.item.id); assert.deepEqual(received.bytes, pdf);
  assert.equal(received.record.filename, "Synthetic form.pdf");
});
test("folders remain separate and listing forwards only the bounded opaque cursor", async () => {
  const f = fixture(); await uploadForm(f.store, input(), "admin"); await uploadForm(f.store, input({ kind: "submissions" }), "admin");
  assert.equal(f.records.size, 2);
  assert.equal((await listForms(f.store, { kind: "templates" })).items.length, 1);
  assert.equal((await listForms(f.store, { kind: "submissions", cursor: "next-page" })).nextCursor, null);
  assert.deepEqual(f.pages, [{ kind: "templates", cursor: undefined }, { kind: "submissions", cursor: "next-page" }]);
});
test("upload rejects traversal, executable extensions, injected metadata and bad encodings before Storage", async () => {
  const f = fixture();
  for (const extra of [{ kind: "../../" }, { filename: "../secret.pdf" }, { filename: "x.html" }, { filename: 'x".pdf' }, { filename: "x\r\n.pdf" }, { uploadedBy: "victim" }, { path: "other/object" }, { base64: "" }, { base64: "Zm9=" }, { base64: "%%%=" }, { base64: "ab" }]) await assert.rejects(uploadForm(f.store, input(extra), "admin"));
  assert.equal(f.records.size, 0);
});
test("size and content checks run server-side including filename mismatch and exact maximum", async () => {
  const f = fixture();
  await assert.rejects(uploadForm(f.store, input({ filename: "x.png" }), "admin"), /extension_mismatch/);
  await assert.rejects(uploadForm(f.store, input({ base64: Buffer.from("<html>bad</html>").toString("base64") }), "admin"), /unsupported_form_content/);
  const large = Buffer.alloc(MAX_FORM_BYTES, 32); pdf.copy(large); large.write("%%EOF", large.length - 5);
  assert.equal((await uploadForm(f.store, input({ base64: large.toString("base64") }), "admin")).item.size, MAX_FORM_BYTES);
  await assert.rejects(uploadForm(f.store, input({ base64: Buffer.concat([large, Buffer.from(" ")]).toString("base64") }), "admin"), /size_or_encoding/);
});
test("PNG and JPEG are recognized by content and JPEG extension is normalized for object identity", async () => {
  const f = fixture();
  for (const [filename, bytes, type] of [["test.png", Buffer.from([137,80,78,71,13,10,26,10,0]), "image/png"], ["test.jpeg", Buffer.from([255,216,255,224,0,255,217]), "image/jpeg"]] as const) {
    const result = await uploadForm(f.store, input({ filename, base64: bytes.toString("base64") }), "admin");
    assert.equal(result.item.contentType, type); assert.deepEqual((await downloadForm(f.store, "templates", result.item.id)).bytes, bytes);
  }
});
test("download fences the object generation and rejects tampered or oversize content", async () => {
  const f = fixture(), saved = await uploadForm(f.store, input(), "admin"), item = f.records.get("templates" + saved.item.id)!;
  item.bytes = Buffer.from("changed"); await assert.rejects(downloadForm(f.store, "templates", saved.item.id), /integrity/);
  item.record.size = MAX_FORM_BYTES + 1; f.store.bytes = async () => { throw new Error("must not read"); };
  await assert.rejects(downloadForm(f.store, "templates", saved.item.id), /integrity/);
  for (const id of ["../x", "x", saved.item.id + "/other"]) await assert.rejects(downloadForm(f.store, "templates", id));
});
test("library rejects unknown filters, alternate buckets and invalid cursors", async () => {
  const f = fixture();
  for (const query of [{ kind: "templates", bucket: "other" }, { kind: "all" }, { kind: "templates", cursor: [] }, { kind: "templates", cursor: "x".repeat(4097) }, { kind: "templates", cursor: "bad\n" }]) await assert.rejects(listForms(f.store, query));
  assert.equal(f.pages.length, 0);
});
test("route enforces operational gate and sanitizes Storage failures without leaking file data", async () => {
  const f = fixture();
  assert.equal((await formRoute(f.store, "POST", "/forms", input(), "admin", false)).status, 403); assert.equal(f.records.size, 0);
  assert.equal((await formRoute(f.store, "DELETE", "/forms", {}, "admin", true)).status, 404);
  assert.equal((await formRoute(f.store, "POST", "/forms", input(), "admin", true)).status, 200);
  f.store.page = async () => { throw new Error("private object content credential"); };
  const result = await formRoute(f.store, "GET", "/forms", { kind: "templates" }, "admin", true);
  assert.deepEqual(result, { status: 503, body: { ok: false, error: "form_storage_unavailable" } });
});
