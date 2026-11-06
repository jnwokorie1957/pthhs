import { readings } from "./readings.js";
import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { IntakeStore } from "./intakeStore.js";
import type { Intake } from "./intake.js";
import type { Actor } from "./policy.js";

interface Ref { path: string; collection: (name: string) => unknown; update: (data: object) => Promise<void> }
function fixture() {
  const records = new Map<string, Record<string, unknown>>(), files = new Map<string, Buffer>();
  let failStorage = false, failFinalize = false;
  const storageOptions: unknown[] = [];
  function collection(path: string) {
    const doc = (id: string): Ref => ({ path: path + "/" + id, collection: name => collection(path + "/" + id + "/" + name),
      update: async data => { records.set(path + "/" + id, { ...records.get(path + "/" + id), ...data }); } });
    return { doc, add: async (data: Record<string, unknown>) => { records.set(path + "/event-" + records.size, data); },
      where: (key: string, _: string, value: unknown) => ({ limit: () => ({ get: async () => ({ docs: [...records].filter(([p, record]) => p.startsWith(path + "/") && p.split("/").length === 2 && record[key] === value).map(([, record]) => ({ data: () => structuredClone(record) })) }) }) }) };
  }
  const db = { collection, runTransaction: async (fn: (transaction: unknown) => Promise<unknown>) => {
    const writes: [string, Record<string, unknown>][] = [];
    const result = await fn({ get: async (ref: Ref & { get?: () => Promise<unknown> }) => ref.get ? ref.get() : ({ exists: records.has(ref.path), ref, data: () => structuredClone(records.get(ref.path)) }),
      set: (ref: Ref, data: Record<string, unknown>) => writes.push([ref.path, structuredClone(data)]),
      create: (ref: Ref, data: Record<string, unknown>) => { assert.ok(!records.has(ref.path)); writes.push([ref.path, structuredClone(data)]); },
      update: (ref: Ref, data: Record<string, unknown>) => { if (failFinalize && data.state === "pending_review") throw Error("metadata failure"); writes.push([ref.path, { ...records.get(ref.path), ...data }]); } });
    for (const [path, data] of writes) records.set(path, data);
    return result;
  } };
  const bucket = { file: (path: string, generation?: { generation: string }) => ({
    save: async (bytes: Buffer, options: unknown) => { if (failStorage) throw Error("storage failure"); assert.ok(!files.has(path)); storageOptions.push(options); files.set(path, Buffer.from(bytes)); },
    getMetadata: async () => [{ generation: "123" }],
    download: async () => { assert.equal(generation?.generation, "123"); return [files.get(path)]; }
  }) };
  return {
    store: new IntakeStore(db as unknown as ConstructorParameters<typeof IntakeStore>[0], bucket as unknown as ConstructorParameters<typeof IntakeStore>[1]),
    records, files, storageOptions, failStorage: () => { failStorage = true; }, failFinalize: () => { failFinalize = true; }
  };
}
const answers = { firstName: "Synthetic", lastName: "Applicant", applicationDate: "2026-11-05", email: "synthetic@example.invalid", phone: "555-0100", eligibleToWork: "Yes", conviction: "No", jobDescriptionRead: "Yes", ssn: "000-00-0000", birthDate: "2000-01-01", street: "100 Synthetic Street", city: "Synthetic City", state: "TX", zip: "77000", highSchool_school: "Synthetic High School", ...Object.fromEntries(readings.flatMap(r => [[`read_page_${r.page}`, "Read"], ...(r.agreement ? [[`terms_page_${r.page}`, "I have questions for HR before agreeing"]] : [])])), highSchool_completed: "2018", emergencyName: "Synthetic Contact", emergencyRelationship: "Friend", availableDate: "2026-11-10", weeklyHours: "20", emergencyPhone: "555-0101" };
const image = sharp({ create: { width: 200, height: 140, channels: 3, background: "#789abc" } }).png().toBuffer().then(b => b.toString("base64"));

test("application inbox supplies names without identity answers and stays office-scoped",async()=>{
 const f=fixture();await f.store.save("synthetic-a",0,answers,"synthetic-office");await f.store.save("synthetic-b",0,{...answers,firstName:"Other"},"other-office");
 const actor:Actor={uid:"synthetic-hr",grant:{active:true,role:"hr",offices:["synthetic-office"],permissions:["applications.review"]}};
 const result=await f.store.queue(actor);assert.equal(result.items.length,1);assert.equal(result.items[0]!.displayName,"Synthetic Applicant");
 assert.ok(!JSON.stringify(result).includes(answers.ssn));assert.ok(!JSON.stringify(result).includes(answers.birthDate));assert.ok(!JSON.stringify(result).includes("synthetic-b"));
 await assert.rejects(f.store.queue({...actor,grant:{...actor.grant,permissions:[]}}),/workforce_forbidden/);
});
test("application drafts persist by UID with immutable history and content-free audit metadata", async () => {
  const f = fixture();
  const first = await f.store.save("synthetic-a", 0, answers, "synthetic-office");
  assert.equal(first.revision, 1); assert.equal((await f.store.load("synthetic-a"))?.uid, "synthetic-a");
  assert.equal(f.records.get("workforceCaregiverDirectory/synthetic-a")?.firstName,"Synthetic");
  const before = structuredClone(f.records.get("workforceApplications/synthetic-a/versions/1"));
  await f.store.save("synthetic-a", 1, { ...answers, firstName:"Renamed", city: "Synthetic City" }, "synthetic-office");
  assert.equal(f.records.get("workforceCaregiverDirectory/synthetic-a")?.firstName,"Renamed");
  assert.ok(!(f.records.get("workforceCaregiverDirectory/synthetic-a")?.namePrefixes as string[]).includes("synthetic"));
  assert.deepEqual(f.records.get("workforceApplications/synthetic-a/versions/1"), before);
  for (const [key, value] of f.records) if (key.startsWith("workforcePersonnelAudit/")) assert.ok(!JSON.stringify(value).includes("Synthetic Applicant"));
  assert.equal((f.records.get("workforceAccounts/synthetic-a")!).uid, "synthetic-a");
  await assert.rejects(f.store.save("synthetic-a", 0, answers, "synthetic-office"), /revision_conflict/);
});
test("active and former employment accounts cannot be replaced by a new applicant identity", async () => {
  const f = fixture();
  for (const employmentStatus of ["active", "inactive", "former"]) {
    f.records.set("workforceAccounts/synthetic-a", { uid: "synthetic-a", employmentStatus, existingEmployeeId: "synthetic-existing" });
    await assert.rejects(f.store.save("synthetic-a", 0, answers, "synthetic-office"), /employee_reactivation_review/);
    assert.equal(f.records.get("workforceAccounts/synthetic-a")!.existingEmployeeId, "synthetic-existing");
  }
});
test("HR reads require current explicit permission and exact office scope", async () => {
  const f = fixture(); await f.store.save("synthetic-a", 0, answers, "synthetic-office");
  const grant = { active: true, role: "hr", offices: ["synthetic-office"], permissions: ["applications.review", "documents.review"] };
  f.records.set("workforceStaff/synthetic-hr", grant);
  assert.equal((await f.store.hrRead("synthetic-hr", "synthetic-a")).uid, "synthetic-a");
  for (const patch of [{ active: false }, { offices: ["other-office"] }, { permissions: [] }, { role: "supervisor" }]) {
    f.records.set("workforceStaff/synthetic-hr", { ...grant, ...patch });
    await assert.rejects(f.store.hrRead("synthetic-hr", "synthetic-a"));
  }
});

test("official form drafts preserve versions and HR access rechecks current grants with the actual reader in the audit", async () => {
 const f=fixture();await f.store.save("synthetic-a",0,answers,"synthetic-office");
 const first=await f.store.saveForm("synthetic-a","w4",{revision:0,fields:{}});
 assert.equal(first.state,"draft");assert.equal((await f.store.loadForm("synthetic-a","w4"))?.revision,1);
 assert.ok(f.records.has("workforceFormDrafts/synthetic-a_w4/versions/1"));
 const grant={active:true,role:"hr",offices:["synthetic-office"],permissions:["applications.review","documents.review"]};
 f.records.set("workforceStaff/synthetic-hr",grant);
 assert.equal((await f.store.loadForm("synthetic-a","w4","synthetic-hr"))?.uid,"synthetic-a");
 assert.ok([...f.records.values()].some(r=>r.action==="official_form_read"&&r.actor==="synthetic-hr"));
 for(const patch of [{active:false},{offices:["other-office"]},{permissions:["applications.review"]},{role:"supervisor"}]){
  f.records.set("workforceStaff/synthetic-hr",{...grant,...patch});await assert.rejects(f.store.loadForm("synthetic-a","w4","synthetic-hr"));
 }
 for(const r of f.records.values())if(r.action==="official_form_saved")assert.ok(!("fields"in r));
});
test("private upload stores only sanitized bytes, generation-bound retrieval and safe metadata", async () => {
  const f = fixture(); await f.store.save("synthetic-a", 0, answers, "synthetic-office");
  const doc = await f.store.upload("synthetic-a", "identity", await image);
  assert.equal(doc.state, "pending_review"); assert.ok(!JSON.stringify(doc).includes("workforce-private"));
  assert.equal((await f.store.listDocuments("synthetic-a")).items.length, 1);
  const bytes = await f.store.download("synthetic-a", doc.id, "synthetic-a");
  assert.equal((await sharp(bytes).metadata()).format, "jpeg");
  await assert.rejects(f.store.download("synthetic-b", doc.id, "synthetic-b"), /document_not_found/);
  const options = f.storageOptions[0] as { preconditionOpts: { ifGenerationMatch: number }; metadata: { cacheControl: string; metadata: object } };
  assert.equal(options.preconditionOpts.ifGenerationMatch, 0); assert.equal(options.metadata.cacheControl, "private, no-store");
  assert.ok(!JSON.stringify(options).includes("originalFilename"));
});
test("upload/storage and metadata-finalization failures cannot appear as completed uploads", async () => {
  for (const mode of ["storage", "metadata"]) {
    const f = fixture(); await f.store.save("synthetic-a", 0, answers, "synthetic-office");
    mode === "storage" ? f.failStorage() : f.failFinalize();
    await assert.rejects(f.store.upload("synthetic-a", "social_security", await image), /document_upload_unconfirmed/);
    const doc = [...f.records].find(([key]) => key.startsWith("workforcePrivateDocuments/"))![1];
    assert.equal(doc.state, "upload_failed");
    await assert.rejects(f.store.download("synthetic-a", doc.id as string, "synthetic-a"), /document_not_ready/);
  }
});
test("revoking HR document permission blocks a subsequent direct file download", async () => {
  const f = fixture(); await f.store.save("synthetic-a", 0, answers, "synthetic-office");
  const doc = await f.store.upload("synthetic-a", "identity", await image);
  f.records.set("workforceStaff/synthetic-hr", { active: true, role: "hr", offices: ["synthetic-office"], permissions: ["applications.review", "documents.review"] });
  await f.store.download("synthetic-a", doc.id, "synthetic-hr");
  f.records.get("workforceStaff/synthetic-hr")!.permissions = ["applications.review"];
  await assert.rejects(f.store.download("synthetic-a", doc.id, "synthetic-hr"), /workforce_forbidden/);
});
test("missing application, attempt quotas, total folder cap and integrity failure stay closed", async () => {
  const f = fixture();
  await assert.rejects(f.store.upload("synthetic-a", "identity", await image), /save_application_first/);
  await f.store.save("synthetic-a", 0, answers, "synthetic-office");
  f.records.set("workforceUploadLimits/synthetic-a", { startedAt: Date.now(), attempts: 20 });
  await assert.rejects(f.store.upload("synthetic-a", "identity", await image), /upload_limit_reached/);
  f.records.delete("workforceUploadLimits/synthetic-a");
  f.records.set("workforceDocumentLimits/synthetic-a", { count: 100 });
  await assert.rejects(f.store.upload("synthetic-a", "identity", await image), /document_folder_limit_reached/);
  f.records.delete("workforceDocumentLimits/synthetic-a");
  const doc = await f.store.upload("synthetic-a", "identity", await image);
  f.files.set(`workforce-private/synthetic-a/${doc.id}.jpg`, Buffer.from("tampered synthetic bytes"));
  await assert.rejects(f.store.download("synthetic-a", doc.id, "synthetic-a"), /document_integrity_error/);
});
test("submitted intake and its signature have immutable version history", async () => {
  const f = fixture(); const first = await f.store.save("synthetic-a", 0, answers, "synthetic-office");
  await f.store.upload("synthetic-a", "identity", await image); await f.store.upload("synthetic-a", "social_security", await image);
  const submitted = await f.store.submit("synthetic-a", first.revision, { name: [answers.firstName, answers.lastName].join(" "), documentRead: true, electronicConsent: true });
  assert.equal(submitted.state, "submitted");
  const original = f.records.get("workforceApplications/synthetic-a/versions/1") as unknown as Intake;
  assert.equal(original.state, "draft"); assert.equal(original.signature, null);
  await assert.rejects(f.store.submit("synthetic-a", submitted.revision, { name: [answers.firstName, answers.lastName].join(" "), documentRead: true, electronicConsent: true }), /application_already_submitted/);
});
test("required personnel documents are enforced by the server and PDF quarantine cannot be downloaded", async () => {
  const f = fixture(); const draft = await f.store.save("synthetic-a", 0, answers, "synthetic-office");
  const signature = { name: [answers.firstName, answers.lastName].join(" "), documentRead: true, electronicConsent: true };
  await assert.rejects(f.store.submit("synthetic-a", draft.revision, signature), /required_documents_missing/);
  await f.store.upload("synthetic-a", "identity", await image);
  const pdf = Buffer.from("%PDF-1.7\nSynthetic untrusted PDF\n%%EOF\n");
  const doc = await f.store.upload("synthetic-a", "social_security", pdf.toString("base64"));
  assert.equal(doc.state, "pending_security_review");
  await assert.rejects(f.store.download("synthetic-a", doc.id, "synthetic-a"), /document_not_ready/);
  const submitted = await f.store.submit("synthetic-a", draft.revision, signature);
  assert.equal(submitted.state, "submitted"); // HR/security eligibility is still pending.
  assert.ok(f.files.has(`workforce-private/synthetic-a/${doc.id}.pdf`));
});
test("address request quotas bound both individual and project-wide requests", async () => {
  const f = fixture(); await f.store.reserveAddressLookup("synthetic-a");
  assert.equal(f.records.get("workforceAddressLimits/synthetic-a")?.attempts, 1);
  f.records.set("workforceAddressLimits/synthetic-a", { startedAt: Date.now(), attempts: 60 });
  await assert.rejects(f.store.reserveAddressLookup("synthetic-a"), /address_lookup_limit/);
  f.records.set("workforceAddressLimits/_project_daily", { day: new Date().toISOString().slice(0, 10), attempts: 1000 });
  await assert.rejects(f.store.reserveAddressLookup("synthetic-b"), /address_lookup_limit/);
});
