import { createHash, randomUUID } from "node:crypto";
import { getFirestore, type Transaction } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { FORM_BUCKET } from "../forms/library.js";
import { parseGrant, requirePermission, validId, WorkforceError, type Actor } from "./policy.js";
import { saveIntake, submitIntake, type Intake } from "./intake.js";
import { prepareDocument, documentKind, documentSummary, missingRequiredDocuments, type DocumentKind, type PrivateDocument } from "./documents.js";
import { formSchema, formRecord, type FormKind, type FormRecord } from "./eforms.js";
import { EMPLOYER_NAME, EMPLOYER_ADDRESS, chicagoDate } from "./dates.js";
import { directoryEntry } from "./directory.js";

export function privateDocumentPath(uid: string, id: string, extension: "jpg" | "pdf" = "jpg"): string {
  if (!validId(uid) || !validId(id) || !["jpg", "pdf"].includes(extension)) throw new WorkforceError(400, "invalid_document_id");
  return `workforce-private/${uid}/${id}.${extension}`;
}
export function requireDocumentOwner(doc: PrivateDocument, uid: string): void {
  if (doc.uid !== uid) throw new WorkforceError(404, "document_not_found");
  if (doc.state !== "pending_review" || !doc.generation || !doc.sha256) throw new WorkforceError(409, "document_not_ready");
}
export class IntakeStore {
  constructor(private db = getFirestore(), private bucket = getStorage().bucket(FORM_BUCKET)) {}
  async formContext(uid:string,ein:string) {
    const account=await this.db.collection("workforceAccounts").doc(uid).get();
    const start=account.data()?.firstDayOfEmployment;
    const date=typeof start==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(start)?start.split("-"):null;
    const [year,month,day]=chicagoDate(new Date()).split("-");
    return {name:EMPLOYER_NAME,address:EMPLOYER_ADDRESS,companyAddress:EMPLOYER_NAME+"\n"+EMPLOYER_ADDRESS,
      ein:/^\d{2}-?\d{7}$/.test(ein)?ein:"",firstDay:date?`${date[1]}/${date[2]}/${date[0]}`:"",street:"11602 Burdine St # A",city:"Houston",state:"TX",zip:"77035",phone:"7139777721",fax:"7139777728",signingDate:`${month}/${day}/${year}`};
  }
  async loadForm(uid: string, kind: FormKind, actorId = uid) {
    if (!validId(uid)) throw new WorkforceError(400, "invalid_account_id");
    return this.db.runTransaction(async tx => {
      if (actorId !== uid) {
        const grant = await tx.get(this.db.collection("workforceStaff").doc(actorId)), app = await tx.get(this.app(uid));
        if (!grant.exists || !app.exists) throw new WorkforceError(403,"workforce_forbidden");
        const actor: Actor = {uid:actorId,grant:parseGrant(grant.data())};
        requirePermission(actor,"applications.review",app.data()!.office);requirePermission(actor,"documents.review",app.data()!.office);
      }
      const ref = this.db.collection("workforceFormDrafts").doc(`${uid}_${kind}`), doc = await tx.get(ref);
      this.audit(tx, actorId, "official_form_read", uid, {kind});
      return doc.exists ? doc.data() as FormRecord : null;
    });
  }
  async saveForm(uid: string, kind: FormKind, input: unknown) {
    const schema = await formSchema(kind);
    return this.db.runTransaction(async tx => {
      const application = await tx.get(this.app(uid)), account = await tx.get(this.db.collection("workforceAccounts").doc(uid));
      const ref = this.db.collection("workforceFormDrafts").doc(`${uid}_${kind}`), old = await tx.get(ref);
      if (!application.exists) throw new WorkforceError(409, "application_not_found");
      const app = application.data() as Intake;
      const name = [app.answers.firstName, app.answers.lastName].filter(Boolean).join(" ");
      const next = formRecord(uid, app.office, schema, old.exists ? old.data() as FormRecord : null, input, name,
        typeof account.data()?.jobOfferAcceptedAt === "string" && Number.isFinite(Date.parse(account.data()!.jobOfferAcceptedAt)), new Date().toISOString());
      tx.set(ref, next); tx.create(ref.collection("versions").doc(String(next.revision)), next);
      this.audit(tx, uid, next.state === "submitted" ? "official_form_submitted" : "official_form_saved", uid, {kind,revision:next.revision});
      return next;
    });
  }
  async reserveAddressLookup(uid: string) {
    await this.db.runTransaction(async tx => {
      const ref = this.db.collection("workforceAddressLimits").doc(uid), doc = await tx.get(ref), now = Date.now();
      const globalRef = this.db.collection("workforceAddressLimits").doc("_project_daily"), global = await tx.get(globalRef);
      const day = new Date(now).toISOString().slice(0, 10), daily = global.data()?.day === day ? Number(global.data()?.attempts ?? 0) : 0;
      if (daily >= 1000) throw new WorkforceError(429, "address_lookup_limit");
      const old = doc.data(), sameWindow = typeof old?.startedAt === "number" && now - old.startedAt < 600000;
      const attempts = sameWindow ? Number(old?.attempts ?? 0) : 0;
      if (attempts >= 60) throw new WorkforceError(429, "address_lookup_limit");
      tx.set(ref, { startedAt: sameWindow ? old!.startedAt : now, attempts: attempts + 1 });
      tx.set(globalRef, { day, attempts: daily + 1 });
    });
  }
  private app(uid: string) {
    if (!validId(uid)) throw new WorkforceError(400, "invalid_account_id");
    return this.db.collection("workforceApplications").doc(uid);
  }
  private audit(tx: Transaction, actor: string, action: string, target: string, extra: Record<string, unknown> = {}) {
    tx.create(this.db.collection("workforcePersonnelAudit").doc(randomUUID()), { actor, action, target, at: new Date().toISOString(), ...extra });
  }
  private async employeeGuard(tx: Transaction, uid: string) {
    const sourceLink=await tx.get(this.db.collection("workforceHhaLinks").doc(uid));
    if(sourceLink.exists)throw new WorkforceError(409,"existing_caregiver_on_file");
    const account = await tx.get(this.db.collection("workforceAccounts").doc(uid));
    if (account.exists && account.data()?.employmentStatus !== "applicant") throw new WorkforceError(409, "employee_reactivation_review");
    return account;
  }
  async load(uid: string) {
    return this.db.runTransaction(async tx => {
      const document = await tx.get(this.app(uid));
      this.audit(tx, uid, "application_read", uid);
      return document.exists ? document.data() as Intake : null;
    });
  }
  async save(uid: string, revision: number, answers: unknown, office: string) {
    if (!validId(office)) throw new WorkforceError(503, "intake_office_unconfigured");
    return this.db.runTransaction(async tx => {
      const account = await this.employeeGuard(tx, uid);
      const ref = this.app(uid), document = await tx.get(ref), now = new Date().toISOString();
      const next = saveIntake(uid, document.exists ? document.data() as Intake : null, revision, answers, office, false, now);
      if (!account.exists) tx.create(account.ref, { uid, employmentStatus: "applicant", office, createdAt: now });
      tx.set(ref, next);
      tx.set(this.db.collection("workforceCaregiverDirectory").doc(uid), directoryEntry(next));
      tx.create(ref.collection("versions").doc(String(next.revision)), next);
      this.audit(tx, uid, "application_saved", uid, { revision: next.revision });
      return next;
    });
  }
  async submit(uid: string, revision: number, signature: unknown) {
    return this.db.runTransaction(async tx => {
      await this.employeeGuard(tx, uid);
      const ref = this.app(uid), doc = await tx.get(ref);
      if (!doc.exists) throw new WorkforceError(404, "application_not_found");
      const application = doc.data() as Intake;
      const documents = await tx.get(this.db.collection("workforcePrivateDocuments").where("uid", "==", uid).limit(100));
      const exception = await tx.get(this.db.collection("workforceDocumentExceptions").doc(uid));
      const review = exception.data();
      const approvedException = review?.approved === true && review.office === application.office && typeof review.approvedBy === "string"
        && typeof review.approvedAt === "string" && Array.isArray(review.kinds) ? { approved: true, kinds: review.kinds as DocumentKind[] } : undefined;
      if (missingRequiredDocuments(documents.docs.map(d => d.data() as PrivateDocument), approvedException).length) throw new WorkforceError(409, "required_documents_missing");
      const next = submitIntake(uid, doc.data() as Intake, revision, signature, new Date().toISOString());
      tx.set(ref, next); tx.create(ref.collection("versions").doc(String(next.revision)), next);
      tx.set(this.db.collection("workforceCaregiverDirectory").doc(uid), directoryEntry(next));
      // Use the immutable application as the transfer source. Keep answers and files out of the queue.
      tx.create(this.db.collection("workforceOnboardingJobs").doc(uid), {
        applicationUid: uid, applicationRevision: next.revision, office: next.office, submittedAt: next.updatedAt,
        hha: { target: "applicant", state: "awaiting_connection" },
        adp: { target: "approved_hire", state: "awaiting_connection" }
      });
      this.audit(tx, uid, "application_submitted", uid, { revision: next.revision });
      return next;
    });
  }
  async hrRead(actorId: string, uid: string, documentAccess = false) {
    return this.db.runTransaction(async tx => {
      const grant = await tx.get(this.db.collection("workforceStaff").doc(actorId));
      if (!grant.exists) throw new WorkforceError(403, "workforce_forbidden");
      const actor: Actor = { uid: actorId, grant: parseGrant(grant.data()) };
      requirePermission(actor, "applications.review");
      const doc = await tx.get(this.app(uid));
      if (!doc.exists) throw new WorkforceError(404, "application_not_found");
      const application = doc.data() as Intake;
      requirePermission(actor, "applications.review", application.office);
      if (documentAccess) requirePermission(actor, "documents.review", application.office);
      this.audit(tx, actorId, documentAccess ? "personnel_folder_access" : "hr_application_read", uid);
      return application;
    });
  }
  async queue(actor: Actor) {
    requirePermission(actor, "applications.review");
    const items = [];
    for (const office of actor.grant.offices) {
      const result = await this.db.collection("workforceApplications").where("office", "==", office).limit(50).get();
      for (const d of result.docs) {
        const app = d.data() as Intake;
        items.push({ uid: app.uid, displayName:[app.answers.firstName,app.answers.lastName].filter(Boolean).join(" "), office: app.office, state: app.state, updatedAt: app.updatedAt, revision: app.revision,
          weeklyHours: app.answers.weeklyHours ?? null, hoursReviewRequired: app.answers.weeklyHours === "40" });
      }
    }
    return { items, limitPerOffice: 50 };
  }
  async listDocuments(uid: string, actorId = uid) {
    // uid always comes from verified identity or a separate HR scope check.
    if (actorId !== uid) await this.hrRead(actorId, uid, true);
    await this.db.collection("workforcePersonnelAudit").add({ actor: actorId, action: "document_folder_list", target: uid, at: new Date().toISOString() });
    const docs = await this.db.collection("workforcePrivateDocuments").where("uid", "==", uid).limit(100).get();
    return { items: docs.docs.map(d => documentSummary(d.data() as PrivateDocument)), limit: 100 };
  }
  async upload(uid: string, kindInput: unknown, encoded: unknown) {
    const kind = documentKind(kindInput), id = randomUUID();
    // Limit attempts before image decoding, including malformed attempts.
    await this.db.runTransaction(async tx => {
      const ref = this.db.collection("workforceUploadLimits").doc(uid), doc = await tx.get(ref);
      const now = Date.now(), old = doc.data(), sameHour = typeof old?.startedAt === "number" && now - old.startedAt < 3_600_000;
      const attempts = sameHour ? Number(old?.attempts ?? 0) : 0;
      if (attempts >= 20) throw new WorkforceError(429, "upload_limit_reached");
      tx.set(ref, { startedAt: sameHour ? old!.startedAt : now, attempts: attempts + 1 });
    });
    const prepared = await prepareDocument(encoded), bytes = prepared.bytes, path = privateDocumentPath(uid, id, prepared.extension);
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const ref = this.db.collection("workforcePrivateDocuments").doc(id);
    const record: PrivateDocument = { id, uid, kind, state: "upload_pending", createdAt: new Date().toISOString(), size: bytes.length, sha256, generation: null, extension: prepared.extension, contentType: prepared.contentType };
    await this.db.runTransaction(async tx => {
      // A folder belongs to an existing application, never an arbitrary target UID.
      const application = await tx.get(this.app(uid));
      if (!application.exists) throw new WorkforceError(409, "save_application_first");
      const limit = this.db.collection("workforceDocumentLimits").doc(uid), count = await tx.get(limit);
      if (Number(count.data()?.count ?? 0) >= 100) throw new WorkforceError(429, "document_folder_limit_reached");
      tx.set(limit, { count: Number(count.data()?.count ?? 0) + 1 });
      tx.create(ref, { ...record, retentionClass: "employment_identity", legalHold: false });
      this.audit(tx, uid, "document_upload_started", id, { kind });
    });
    try {
      const file = this.bucket.file(path);
      await file.save(bytes, { resumable: false, validation: "crc32c", preconditionOpts: { ifGenerationMatch: 0 },
        metadata: { contentType: prepared.contentType, cacheControl: "private, no-store", contentDisposition: "attachment", metadata: { sha256 } } });
      const [metadata] = await file.getMetadata();
      const generation = String(metadata.generation ?? "");
      if (!/^\d+$/.test(generation)) throw Error();
      const completed: PrivateDocument = { ...record, generation, state: prepared.state };
      await this.db.runTransaction(async tx => {
        const pending = await tx.get(ref);
        if (pending.data()?.state !== "upload_pending") throw new WorkforceError(409, "document_not_ready");
        tx.update(ref, { generation, state: prepared.state });
        this.audit(tx, uid, "document_uploaded", id, { kind, size: bytes.length });
      });
      return documentSummary(completed);
    } catch {
      // An orphaned object is never exposed as a completed upload. No automatic
      // deletion: retention/hold policy and orphan recovery need operator review.
      await ref.update({ state: "upload_failed" }).catch(() => undefined);
      throw new WorkforceError(503, "document_upload_unconfirmed");
    }
  }
  async download(uid: string, id: string, actorId: string) {
    privateDocumentPath(uid, id);
    const record = await this.db.runTransaction(async tx => {
      if (actorId !== uid) {
        const grant = await tx.get(this.db.collection("workforceStaff").doc(actorId));
        const application = await tx.get(this.app(uid));
        if (!grant.exists || !application.exists) throw new WorkforceError(403, "workforce_forbidden");
        const actor: Actor = { uid: actorId, grant: parseGrant(grant.data()) };
        requirePermission(actor, "applications.review", application.data()!.office);
        requirePermission(actor, "documents.review", application.data()!.office);
      }
      const doc = await tx.get(this.db.collection("workforcePrivateDocuments").doc(id));
      if (!doc.exists) throw new WorkforceError(404, "document_not_found");
      const record = doc.data() as PrivateDocument;
      requireDocumentOwner(record, uid);
      this.audit(tx, actorId, "document_download", id);
      return record;
    });
    const [bytes] = await this.bucket.file(privateDocumentPath(uid, id, record.extension ?? "jpg"), { generation: record.generation! }).download({ validation: "crc32c" });
    if (bytes.length !== record.size || createHash("sha256").update(bytes).digest("hex") !== record.sha256) throw new WorkforceError(503, "document_integrity_error");
    return bytes;
  }
}
