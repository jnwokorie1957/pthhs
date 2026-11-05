import { createHash, randomUUID } from "node:crypto";
import { getFirestore, type Transaction } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { FORM_BUCKET } from "../forms/library.js";
import { parseGrant, requirePermission, validId, WorkforceError, type Actor } from "./policy.js";
import { saveIntake, submitIntake, type Intake } from "./intake.js";
import { sanitizeDocument, documentKind, documentSummary, type PrivateDocument } from "./documents.js";

export function privateDocumentPath(uid: string, id: string): string {
  if (!validId(uid) || !validId(id)) throw new WorkforceError(400, "invalid_document_id");
  return `workforce-private/${uid}/${id}.jpg`;
}
export function requireDocumentOwner(doc: PrivateDocument, uid: string): void {
  if (doc.uid !== uid) throw new WorkforceError(404, "document_not_found");
  if (doc.state !== "pending_review" || !doc.generation || !doc.sha256) throw new WorkforceError(409, "document_not_ready");
}
export class IntakeStore {
  constructor(private db = getFirestore(), private bucket = getStorage().bucket(FORM_BUCKET)) {}
  private app(uid: string) {
    if (!validId(uid)) throw new WorkforceError(400, "invalid_account_id");
    return this.db.collection("workforceApplications").doc(uid);
  }
  private audit(tx: Transaction, actor: string, action: string, target: string, extra: Record<string, unknown> = {}) {
    tx.create(this.db.collection("workforcePersonnelAudit").doc(randomUUID()), { actor, action, target, at: new Date().toISOString(), ...extra });
  }
  private async employeeGuard(tx: Transaction, uid: string) {
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
      const next = submitIntake(uid, doc.data() as Intake, revision, signature, new Date().toISOString());
      tx.set(ref, next); tx.create(ref.collection("versions").doc(String(next.revision)), next);
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
        items.push({ uid: app.uid, office: app.office, state: app.state, updatedAt: app.updatedAt, revision: app.revision });
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
    const kind = documentKind(kindInput), id = randomUUID(), path = privateDocumentPath(uid, id);
    // Limit attempts before image decoding, including malformed attempts.
    await this.db.runTransaction(async tx => {
      const ref = this.db.collection("workforceUploadLimits").doc(uid), doc = await tx.get(ref);
      const now = Date.now(), old = doc.data(), sameHour = typeof old?.startedAt === "number" && now - old.startedAt < 3_600_000;
      const attempts = sameHour ? Number(old?.attempts ?? 0) : 0;
      if (attempts >= 20) throw new WorkforceError(429, "upload_limit_reached");
      tx.set(ref, { startedAt: sameHour ? old!.startedAt : now, attempts: attempts + 1 });
    });
    const bytes = await sanitizeDocument(encoded), sha256 = createHash("sha256").update(bytes).digest("hex");
    const ref = this.db.collection("workforcePrivateDocuments").doc(id);
    const record: PrivateDocument = { id, uid, kind, state: "upload_pending", createdAt: new Date().toISOString(), size: bytes.length, sha256, generation: null };
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
        metadata: { contentType: "image/jpeg", cacheControl: "private, no-store", contentDisposition: "attachment", metadata: { sha256 } } });
      const [metadata] = await file.getMetadata();
      const generation = String(metadata.generation ?? "");
      if (!/^\d+$/.test(generation)) throw Error();
      const completed: PrivateDocument = { ...record, generation, state: "pending_review" };
      await this.db.runTransaction(async tx => {
        const pending = await tx.get(ref);
        if (pending.data()?.state !== "upload_pending") throw new WorkforceError(409, "document_not_ready");
        tx.update(ref, { generation, state: "pending_review" });
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
    const [bytes] = await this.bucket.file(privateDocumentPath(uid, id), { generation: record.generation! }).download({ validation: "crc32c" });
    if (bytes.length !== record.size || createHash("sha256").update(bytes).digest("hex") !== record.sha256) throw new WorkforceError(503, "document_integrity_error");
    return bytes;
  }
}
