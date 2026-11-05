import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { readFileSync } from "node:fs";
import { intakePacket, packetInventory, PACKET_SHA256 } from "./packet.js";
import { intakeAnswers, saveIntake, submitIntake } from "./intake.js";
import { sanitizeDocument, documentSummary, type PrivateDocument } from "./documents.js";
import { privateDocumentPath, requireDocumentOwner } from "./intakeStore.js";
import { parseGrant, requirePermission, type Actor } from "./policy.js";
import { recentWorkforceIdentity } from "./auth.js";
const now = "2026-11-05T18:00:00.000Z";
const answers = () => ({ name: "Synthetic Applicant", applicationDate: "2026-11-05", email: "synthetic@example.invalid", phone: "555-0100", eligibleToWork: "Yes", conviction: "No" });
test("packet maps all 27 pages and only digitizes applicant-owned questions", () => {
  assert.deepEqual(packetInventory.flatMap(item => item.pages), Array.from({ length: 27 }, (_, i) => i + 1));
  assert.equal(new Set(intakePacket.fields.map(f => f.id)).size, intakePacket.fields.length);
  for (const id of ["name", "ssn", "birthDate", "emergencyName", "visaType", "convictionDetails", "highSchool_degree", "job1_from", "job2_duties", "referenceCompany"]) assert.ok(intakePacket.fields.some(f => f.id === id));
  assert.ok(!intakePacket.fields.some(f => /rating|screeningResult|supervisorSignature|bank/i.test(f.id)));
  assert.ok(packetInventory.find(i => i.pages.includes(25))?.state.includes("current_official_form"));
});
test("generated application fields cannot collide with static portal control IDs", () => {
  const html = readFileSync(new URL("../../../public/caregiver.html", import.meta.url), "utf8");
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(ids).size, ids.length);
  for (const field of intakePacket.fields) assert.ok(!ids.includes("application-" + field.id));
});
test("save and resume preserves all source fields and disallows arbitrary answers", () => {
  const draft = saveIntake("synthetic-applicant", null, 0, { ...answers(), ssn: "000-00-0000", job1_reason: "Synthetic only" }, "synthetic-office", false, now);
  assert.equal(draft.sourceSha256, PACKET_SHA256);
  assert.equal(draft.answers.job1_reason, "Synthetic only");
  assert.throws(() => saveIntake("other-applicant", draft, 1, answers(), "synthetic-office", false, now), /application_forbidden/);
  assert.throws(() => saveIntake("synthetic-applicant", draft, 0, answers(), "synthetic-office", false, now), /revision_conflict/);
  assert.throws(() => saveIntake("synthetic-applicant", null, 0, { owner: "true" }, "synthetic-office", false, now), /invalid_answers/);
  assert.throws(() => saveIntake("synthetic-applicant", null, 0, answers(), "synthetic-office", true, now), /active_employee_application_not_required/);
});
test("SSN, date, email and choice validation rejects malformed data before persistence", () => {
  for (const input of [{ ssn: "123" }, { birthDate: "2026-02-31" }, { email: "bad" }, { conviction: "maybe" }, { name: "x".repeat(251) }, { name: "bad\u0000" }]) assert.throws(() => intakeAnswers(input), /invalid_answers/);
});
test("signature binds verified UID, exact source, answers version and server timestamp", () => {
  const draft = saveIntake("synthetic-applicant", null, 0, answers(), "synthetic-office", false, now);
  for (const signature of [{}, { name: "Another person", electronicConsent: true, documentRead: true }, { name: "Synthetic Applicant", electronicConsent: false, documentRead: true }]) assert.throws(() => submitIntake("synthetic-applicant", draft, 1, signature, now), /signature_required/);
  const signed = submitIntake("synthetic-applicant", draft, 1, { name: "Synthetic Applicant", electronicConsent: true, documentRead: true }, now);
  assert.equal(signed.state, "submitted"); assert.equal(signed.signature?.sourceSha256, PACKET_SHA256);
  assert.equal(signed.signature?.uid, "synthetic-applicant"); assert.equal(signed.signature?.signedAt, now);
  assert.equal(signed.signature?.answersSha256.length, 64); assert.equal(draft.signature, null);
  assert.throws(() => saveIntake("synthetic-applicant", signed, signed.revision, answers(), "synthetic-office", false, now), /application_already_submitted/);
  assert.throws(() => submitIntake("other", draft, 1, { name: "Synthetic Applicant", electronicConsent: true, documentRead: true }, now), /application_forbidden/);
});
test("submission requires approved minimum questions and conditional details", () => {
  const incomplete = saveIntake("synthetic-applicant", null, 0, {}, "synthetic-office", false, now);
  assert.throws(() => submitIntake("synthetic-applicant", incomplete, 1, { name: "", electronicConsent: true, documentRead: true }, now));
  const draft = saveIntake("synthetic-applicant", null, 0, { ...answers(), conviction: "Yes" }, "synthetic-office", false, now);
  assert.throws(() => submitIntake("synthetic-applicant", draft, 1, { name: "Synthetic Applicant", electronicConsent: true, documentRead: true }, now), /application_incomplete/);
});
test("only explicitly authorized HR/owner roles can view personnel records within their offices", () => {
  const hr: Actor = { uid: "synthetic-hr", grant: { active: true, role: "hr", offices: ["synthetic-office"], permissions: ["applications.review", "documents.review"] } };
  requirePermission(hr, "documents.review", "synthetic-office");
  assert.throws(() => requirePermission(hr, "documents.review", "other-office"));
  for (const role of ["office", "supervisor"] as const) {
    assert.throws(() => parseGrant({ ...hr.grant, role }));
    assert.throws(() => requirePermission({ ...hr, grant: { ...hr.grant, role } }, "documents.review", "synthetic-office"));
  }
  assert.throws(() => requirePermission({ ...hr, grant: { ...hr.grant, active: false } }, "applications.review"));
});
test("document ownership and finalized-generation checks prevent IDOR and premature downloads", () => {
  const doc: PrivateDocument = { uid: "synthetic-a", id: "synthetic-document", kind: "identity", state: "pending_review", generation: "123", sha256: "synthetic-hash", createdAt: now, size: 100 };
  requireDocumentOwner(doc, "synthetic-a");
  assert.throws(() => requireDocumentOwner(doc, "synthetic-b"), /document_not_found/);
  for (const state of ["upload_pending", "upload_failed"] as const) assert.throws(() => requireDocumentOwner({ ...doc, state }, "synthetic-a"), /document_not_ready/);
  assert.throws(() => requireDocumentOwner({ ...doc, generation: null }, "synthetic-a"));
  assert.deepEqual(Object.keys(documentSummary(doc)).sort(), ["id", "kind", "state", "createdAt", "size"].sort());
  assert.equal(privateDocumentPath(doc.uid, doc.id), "workforce-private/synthetic-a/synthetic-document.jpg");
  for (const id of ["../a", "a/b", "", "https://example.invalid"]) assert.throws(() => privateDocumentPath(doc.uid, id));
});
test("raster sanitizer decodes, rotates and strips EXIF before storing JPEG", async () => {
  const input = await sharp({ create: { width: 240, height: 160, channels: 3, background: "#497ba0" } }).jpeg().withMetadata({ orientation: 6, exif: { IFD0: { Copyright: "Synthetic metadata" } } }).toBuffer();
  const clean = await sanitizeDocument(input.toString("base64"));
  const metadata = await sharp(clean).metadata();
  assert.equal(metadata.format, "jpeg"); assert.equal(metadata.exif, undefined);
  assert.equal(metadata.width, 160); assert.equal(metadata.height, 240);
  assert.ok(!clean.includes(Buffer.from("Synthetic metadata")));
});
test("upload rejects SVG, PDF, malformed encodings, fake images and undersized images", async () => {
  for (const input of ["bad", Buffer.from("<svg><script>bad</script></svg>").toString("base64"), Buffer.from("%PDF-test").toString("base64"), Buffer.from([255, 216, 255, 0, 0]).toString("base64")]) await assert.rejects(sanitizeDocument(input));
  const tiny = await sharp({ create: { width: 10, height: 10, channels: 3, background: "white" } }).png().toBuffer();
  await assert.rejects(sanitizeDocument(tiny.toString("base64")), /unreadable_document_image/);
  await assert.rejects(sanitizeDocument("A".repeat(12_000_000)), /invalid_document_size/);
});
test("sensitive document operations require a recent verified login", async () => {
  const current = Date.parse(now);
  const fixture = (age: number) => ({ verifyIdToken: async () => ({ uid: "synthetic-a", email: "a@example.invalid", email_verified: true, auth_time: current / 1000 - age }), getUser: async () => ({ uid: "synthetic-a", email: "a@example.invalid", emailVerified: true, disabled: false }) });
  const request = { get: () => "Bearer synthetic-only" };
  assert.equal(await recentWorkforceIdentity(request, fixture(10) as unknown as Parameters<typeof recentWorkforceIdentity>[1], current), "synthetic-a");
  for (const age of [901, -120]) await assert.rejects(recentWorkforceIdentity(request, fixture(age) as unknown as Parameters<typeof recentWorkforceIdentity>[1], current), /recent_sign_in_required/);
});
