import test from "node:test";
import assert from "node:assert/strict";
import { EnvelopeDocumentCipher, kmsDocumentCipher } from "./documentEncryption.js";

test("each upload encrypts differently, binds the caregiver/file, and detects changed ciphertext", async () => {
  const cipher = new EnvelopeDocumentCipher("synthetic-key", {wrap: async key => Buffer.from(key), unwrap: async key => Buffer.from(key)});
  const original = Buffer.from("Synthetic identity document"), context = "workforce-private/synthetic-a/file-a.pdf";
  const first = await cipher.encrypt(original, context), second = await cipher.encrypt(original, context);
  assert.notDeepEqual(first.bytes, original);
  assert.notDeepEqual(first.bytes, second.bytes);
  assert.deepEqual(await cipher.decrypt(first.bytes, first.envelope, context), original);
  await assert.rejects(cipher.decrypt(first.bytes, first.envelope, "workforce-private/synthetic-b/file-a.pdf"), /document_integrity_error/);
  const changed = Buffer.from(first.bytes); changed[0] = changed[0]! ^ 1;
  await assert.rejects(cipher.decrypt(changed, first.envelope, context), /document_integrity_error/);
  await assert.rejects(cipher.decrypt(first.bytes, {...first.envelope, keyName: "foreign-key"}, context), /document_key_unavailable/);
});

test("missing KMS configuration never falls back to unencrypted storage", () => {
  const previous = process.env.WORKFORCE_DOCUMENT_KMS_KEY;
  delete process.env.WORKFORCE_DOCUMENT_KMS_KEY;
  try { assert.throws(() => kmsDocumentCipher(), /document_key_unavailable/); }
  finally { if (previous !== undefined) process.env.WORKFORCE_DOCUMENT_KMS_KEY = previous; }
});
