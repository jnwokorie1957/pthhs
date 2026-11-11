import { createHash, randomBytes, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import { getFirestore } from "firebase-admin/firestore";
import { WorkforceError } from "./policy.js";

export interface DocumentPrincipal { uid: string; email: string; authTime: number }
export type DocumentAccessCheck = () => Promise<void>;
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const matches = (left: unknown, right: string) => typeof left === "string" && /^[a-f0-9]{64}$/.test(left)
  && timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));

// Only applicant uploads and generated personnel PDFs belong to this flow.
// HHA source files retain their existing separately scoped read path.
export function sensitiveDocumentPath(path: unknown): path is string {
  return typeof path === "string" && (
    /^\/application\/(documents\/[a-zA-Z0-9_-]{1,128}|forms\/(i9|w4|new_hire|cch)\/pdf)$/.test(path)
    || /^\/staff\/applications\/[a-zA-Z0-9_-]{1,128}\/(pdf|packet\/pdf|forms\/(i9|w4|new_hire|cch)\/pdf|documents\/[a-zA-Z0-9_-]{1,128}(\/print)?)$/.test(path));
}

export class DocumentAccess {
  constructor(private db = getFirestore(), private now = () => Date.now()) {}
  async request(principal: DocumentPrincipal, path: string, authorize: DocumentAccessCheck) {
    if (!sensitiveDocumentPath(path)) throw new WorkforceError(400, "invalid_document_request");
    await authorize();
    const id = randomUUID(), code = String(randomInt(0, 1_000_000)).padStart(6, "0"), salt = randomBytes(32).toString("hex");
    const now = this.now(), expiresAt = now + 300000;
    await this.db.runTransaction(async tx => {
      const limit = this.db.collection("workforceDocumentAccessLimits").doc(principal.uid), previous = await tx.get(limit);
      const old = previous.data(), sameWindow = typeof old?.startedAt === "number" && now - old.startedAt < 600000;
      if (sameWindow && Number(old?.attempts ?? 0) >= 3) throw new WorkforceError(429, "document_verification_limit");
      tx.set(limit, {startedAt: sameWindow ? old!.startedAt : now, attempts: sameWindow ? Number(old?.attempts ?? 0) + 1 : 1});
      tx.create(this.db.collection("workforceDocumentChallenges").doc(id), {
        uid: principal.uid, email: principal.email, authTime: principal.authTime, path, salt, codeHash: hash(salt + code),
        expiresAt, attempts: 0, verified: false, consumed: false, deleteAfter: new Date(expiresAt + 3600000)
      });
      tx.create(this.db.collection("workforceIdentityMail").doc("verify-" + id), {
        to: [principal.email], deleteAfter: new Date(expiresAt + 3600000),
        message: {subject: "Your Primetime document verification code", text: `Your verification code is ${code}. It expires in 5 minutes and can only be used for the document request you started. Do not share this code.`}
      });
      tx.create(this.db.collection("workforcePersonnelAudit").doc(randomUUID()), {
        actor: principal.uid, action: "document_verification_requested", at: new Date(now).toISOString(), challenge: id
      });
    });
    const [name, domain] = principal.email.split("@");
    return {challengeId: id, maskedEmail: (name?.slice(0, 1) || "") + "***@" + domain, expiresAt, delivery: "queued"};
  }
  async verify(principal: DocumentPrincipal, id: unknown, code: unknown, authorize: (path: string) => Promise<void>) {
    if (typeof id !== "string" || !/^[a-f0-9-]{36}$/.test(id) || typeof code !== "string" || !/^\d{6}$/.test(code)) {
      throw new WorkforceError(400, "invalid_document_code");
    }
    const ref = this.db.collection("workforceDocumentChallenges").doc(id);
    const snapshot = await ref.get(), challenge = snapshot.data();
    if (!challenge || challenge.uid !== principal.uid || challenge.email !== principal.email || challenge.authTime !== principal.authTime
      || !sensitiveDocumentPath(challenge.path)) throw new WorkforceError(403, "document_verification_required");
    await authorize(challenge.path);
    const accessToken = randomBytes(32).toString("hex"), now = this.now();
    const valid = await this.db.runTransaction(async tx => {
      const current = (await tx.get(ref)).data();
      if (!current || current.uid !== principal.uid || current.email !== principal.email || current.authTime !== principal.authTime
        || current.path !== challenge.path || current.verified || current.consumed || current.expiresAt <= now || current.attempts >= 5) return false;
      if (!matches(current.codeHash, hash(current.salt + code))) {
        tx.update(ref, {attempts: Number(current.attempts) + 1}); return false;
      }
      tx.update(ref, {verified: true, proofHash: hash(accessToken), proofExpiresAt: Math.min(now + 120000, current.expiresAt), codeHash: "", salt: ""});
      return true;
    });
    if (!valid) throw new WorkforceError(403, "invalid_document_code");
    return {accessToken: id + "." + accessToken};
  }
  async consume(principal: DocumentPrincipal, path: string, token: unknown, authorize: DocumentAccessCheck) {
    await authorize();
    if (typeof token !== "string" || !/^[a-f0-9-]{36}\.[a-f0-9]{64}$/.test(token)) throw new WorkforceError(403, "document_verification_required");
    const [id, secret] = token.split("."), now = this.now();
    await this.db.runTransaction(async tx => {
      const ref = this.db.collection("workforceDocumentChallenges").doc(id!), challenge = (await tx.get(ref)).data();
      if (!challenge || challenge.uid !== principal.uid || challenge.email !== principal.email || challenge.authTime !== principal.authTime || challenge.path !== path
        || !challenge.verified || challenge.consumed || challenge.proofExpiresAt <= now || !matches(challenge.proofHash, hash(secret!))) {
        throw new WorkforceError(403, "document_verification_required");
      }
      tx.update(ref, {consumed: true, proofHash: ""});
      tx.create(this.db.collection("workforcePersonnelAudit").doc(randomUUID()), {
        actor: principal.uid, action: "document_access_verified", at: new Date(now).toISOString(), challenge: id
      });
    });
  }
}
