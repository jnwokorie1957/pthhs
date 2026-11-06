import { readings } from "./readings.js";
import { policyDocument, POLICY_EDITION } from "./policyDocuments.js";
import { createHash } from "node:crypto";
import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { readFileSync } from "node:fs";
import { intakePacket, packetInventory, PACKET_SHA256 } from "./packet.js";
import { intakeAnswers, saveIntake, submitIntake } from "./intake.js";
import { sanitizeDocument, prepareDocument, documentSummary, missingRequiredDocuments, documentKind, type PrivateDocument } from "./documents.js";
import { privateDocumentPath, requireDocumentOwner } from "./intakeStore.js";
import { parseGrant, requirePermission, type Actor } from "./policy.js";
import { recentWorkforceIdentity } from "./auth.js";
const now = "2026-11-05T18:00:00.000Z";
test("identity uploads cannot receive tax forms or other document categories",()=>{
 assert.equal(documentKind("identity"),"identity");assert.equal(documentKind("social_security"),"social_security");
 for(const kind of ["i9","w4","new_hire","employment_authorization","",null])assert.throws(()=>documentKind(kind),/invalid_document_kind/);
});
const answers = () => ({ firstName: "Synthetic", lastName: "Applicant", applicationDate: "2026-11-05", email: "synthetic@example.invalid", phone: "555-0100", eligibleToWork: "Yes", conviction: "No", jobDescriptionRead: "Yes", ssn: "000-00-0000", birthDate: "2000-01-01", street: "100 Synthetic Street", city: "Synthetic City", state: "TX", zip: "77000", highSchool_school: "Synthetic High School", ...Object.fromEntries(readings.flatMap(r => [[`read_page_${r.page}`, "Read"], ...(r.agreement ? [[`terms_page_${r.page}`, "I have questions for HR before agreeing"]] : [])])), highSchool_completed: "2018", emergencyName: "Synthetic Contact", emergencyRelationship: "Friend", emergencyAddress: "1 Test Road", emergencyPhone: "555-0101" });
test("packet maps all 27 pages and only digitizes applicant-owned questions", () => {
  assert.deepEqual(packetInventory.flatMap(item => item.pages), Array.from({ length: 27 }, (_, i) => i + 1));
  assert.equal(new Set(intakePacket.fields.map(f => f.id)).size, intakePacket.fields.length);
  for (const id of ["firstName", "lastName", "ssn", "birthDate", "emergencyName", "visaType", "convictionDetails", "highSchool_completed", "job1_from", "job1_duties", "referenceCompany"]) assert.ok(intakePacket.fields.some(f => f.id === id));
  assert.ok(!intakePacket.fields.some(f => /rating|screeningResult|supervisorSignature|bank/i.test(f.id)));
  assert.ok(packetInventory.find(i => i.pages.includes(25))?.state.includes("current_official_form"));
});
test("owner-requested v2 groups, required fields, education and single work record are explicit", () => {
  for(const id of ["firstName","lastName","emergencyName","emergencyRelationship","emergencyAddress","emergencyPhone"])assert.equal(intakePacket.fields.find(f=>f.id===id)?.required,true);
  for (const id of ["street", "birthDate", "ssn", "highSchool_school", "highSchool_completed", "jobDescriptionRead"]) assert.equal(intakePacket.fields.find(f => f.id === id)?.required, true);
  for (const field of intakePacket.fields.filter(f => f.id.startsWith("college_"))) assert.equal(field.required, false);
  assert.equal(intakePacket.fields.find(f => f.id === "firstName")?.section, "Contact information");
  assert.ok(!intakePacket.fields.some(f => f.section === "About you" || f.id.startsWith("job2_") || ["highSchool_major", "highSchool_degree"].includes(f.id)));
  assert.deepEqual(intakePacket.fields.find(f => f.id === "weeklyHours")?.options, ["10", "20", "30", "40"]);
  assert.ok(intakePacket.fields.some(f => f.id === "unit" && !f.required));
});

test("updated duplex readings include all continuation pages and preserve a request to discuss terms without forcing agreement",()=>{
 assert.deepEqual(readings.find(r=>r.page===22)?.sourcePages,[43,44]);assert.deepEqual(readings.find(r=>r.page===14)?.sourcePages,[27,28]);
 const draft=saveIntake("synthetic-a",null,0,answers(),"synthetic-office",false,now);
 const signed=submitIntake("synthetic-a",draft,1,{name:"Synthetic Applicant",electronicConsent:true,documentRead:true},now);
 assert.equal(signed.policyAcknowledgments?.length,readings.length);
 for(const acknowledgment of signed.policyAcknowledgments!) {
  const document=policyDocument(acknowledgment.page)!;
  assert.equal(acknowledgment.edition,POLICY_EDITION);
  assert.equal(acknowledgment.contentSha256,createHash("sha256").update(document.text).digest("hex"));
 }
 assert.equal(signed.policyAcknowledgments?.find(r=>r.page===23)?.response,"I have questions for HR before agreeing");
 const input=answers();delete input.applicationDate;const dated=saveIntake("synthetic-a",null,0,input,"synthetic-office",false,"2026-11-06T02:00:00Z");assert.equal(dated.answers.applicationDate,"2026-11-05");
});

test("digital policies retain complete continuations and distinguish elections from reading",()=>{
 assert.equal(readings.length,16);
 for(const reading of readings)assert.ok(policyDocument(reading.page)?.text.length);
 assert.equal(policyDocument(7),null);
 assert.match(policyDocument(8)!.text,/within 72 hours/);
 assert.match(policyDocument(14)!.text,/Maintain worker medical and training records/);
 assert.match(policyDocument(21)!.text,/PFD-LTSS@hhs.texas.gov/);
 assert.match(policyDocument(22)!.text,/one-year probation/);
 assert.match(policyDocument(23)!.text,/does not require arbitration of claims/);
 assert.match(readings.find(r=>r.page===15)!.note!,/does not elect or decline/);
});
test("complete role reading includes all qualifications, duties, essential functions and both source acknowledgments", () => {
  const role = intakePacket.jobDescription;
  assert.equal(role.qualifications.length, 7); assert.equal(role.duties.length, 3); assert.equal(role.essentialFunctions.length, 11);
  assert.deepEqual(role.sourcePages, [1, 3]);
  assert.ok(role.essentialFunctions[10]?.includes("corrective actions"));
  assert.ok(role.initialAcknowledgment.includes("all questions")); assert.ok(role.discussionAcknowledgment.includes("revised and discussed"));
  const draft = saveIntake("synthetic-applicant", null, 0, { ...answers(), jobDescriptionRead: "" }, "synthetic-office", false, now);
  assert.throws(() => submitIntake("synthetic-applicant", draft, 1, { name: [answers().firstName, answers().lastName].join(" "), electronicConsent: true, documentRead: true }, now), /application_incomplete/);
});
test("PDF uploads remain byte-for-byte intact in private security quarantine; identity requirements are separate", async () => {
  const pdf = Buffer.from("%PDF-1.7\n1 0 obj << /JS (untrusted) >> endobj\n%%EOF\n");
  const result = await prepareDocument(pdf.toString("base64"));
  assert.equal(result.contentType, "application/pdf"); assert.equal(result.state, "pending_security_review"); assert.deepEqual(result.bytes, pdf);
  await assert.rejects(prepareDocument(Buffer.from("%PDF-1.7\ntruncated").toString("base64")), /invalid_pdf/);
  assert.deepEqual(missingRequiredDocuments([{ kind: "identity", state: "pending_review" }]), ["social_security"]);
  assert.deepEqual(missingRequiredDocuments([{ kind: "identity", state: "pending_review" }, { kind: "social_security", state: "pending_security_review" }]), []);
  assert.deepEqual(missingRequiredDocuments([{ kind: "identity", state: "upload_failed" }, { kind: "social_security", state: "upload_pending" }]), ["identity", "social_security"]);
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
  assert.deepEqual(Object.keys(documentSummary(doc)).sort(), ["id", "kind", "state", "createdAt", "size", "contentType"].sort());
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
