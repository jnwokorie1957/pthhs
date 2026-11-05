import { randomUUID } from "node:crypto";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { parseGrant, requirePermission, validId, WorkforceError, type Actor, type Grant } from "./policy.js";
import { saveOpportunity, transition, publicOpportunity, type Opportunity, type Action } from "./opportunities.js";

export class WorkforceStore {
  constructor(private db = getFirestore()) {}
  async actor(uid: string): Promise<Actor> {
    const doc = await this.db.collection("workforceStaff").doc(uid).get();
    if (!doc.exists) throw new WorkforceError(403, "staff_access_required");
    const grant = parseGrant(doc.data());
    if (!grant.active) throw new WorkforceError(403, "staff_access_revoked");
    return { uid, grant };
  }
  async list(uid: string) {
    const actor = await this.actor(uid);
    requirePermission(actor, "opportunities.read");
    const items: Opportunity[] = [];
    // Individual office queries avoid a multi-field index and enforce scope before retrieval.
    for (const office of actor.grant.offices) {
      const result = await this.db.collection("workforceOpportunities").where("office", "==", office).limit(100).get();
      items.push(...result.docs.map(d => d.data() as Opportunity));
    }
    return { items, limitPerOffice: 100 };
  }
  async publicList() {
    const result = await this.db.collection("workforceOpportunities").where("state", "==", "published").limit(100).get();
    return { items: result.docs.map(d => publicOpportunity(d.data() as Opportunity)).filter(Boolean), limit: 100 };
  }
  async mutate(uid: string, id: string, revision: number, data: unknown, action?: Action, privacy = false) {
    if (!validId(id) || !Number.isInteger(revision) || revision < 0) throw new WorkforceError(400, "invalid_request");
    const ref = this.db.collection("workforceOpportunities").doc(id);
    const audit = this.db.collection("workforceAudit").doc(randomUUID());
    return this.db.runTransaction(async tx => {
      // Read current grant inside the same transaction: revoked scope cannot race a write.
      const grant = await tx.get(this.db.collection("workforceStaff").doc(uid));
      if (!grant.exists) throw new WorkforceError(403, "staff_access_required");
      const actor: Actor = { uid, grant: parseGrant(grant.data()) };
      const doc = await tx.get(ref), previous = doc.exists ? doc.data() as Opportunity : null;
      if (action && !previous) throw new WorkforceError(404, "opportunity_not_found");
      const now = new Date().toISOString();
      const next = action ? transition(actor, previous!, revision, action, privacy, now) : saveOpportunity(actor, previous, id, revision, data, now);
      tx.set(ref, next);
      tx.create(audit, { actor: uid, action: action ?? "save", opportunity: id, revision: next.revision, office: next.office, at: now });
      // Version history remains private; public reads use only the current reviewed revision.
      tx.create(ref.collection("versions").doc(String(next.revision)), next);
      return next;
    });
  }
  async grant(uid: string, target: string, input: unknown) {
    if (!validId(target) || target === uid) throw new WorkforceError(400, "invalid_staff_target");
    const next: Grant = parseGrant(input);
    // Owner bootstrap is an offline identity-verified administrative operation.
    // The web API cannot create or modify an owner, preventing privilege escalation.
    if (next.role === "owner") throw new WorkforceError(403, "owner_grant_requires_offline_review");
    const user = await getAuth().getUser(target);
    if (user.disabled || !user.emailVerified) throw new WorkforceError(409, "staff_identity_unverified");
    return this.db.runTransaction(async tx => {
      const source = await tx.get(this.db.collection("workforceStaff").doc(uid));
      const actor = { uid, grant: parseGrant(source.data()) };
      requirePermission(actor, "staff.manage");
      for (const office of next.offices) requirePermission(actor, "staff.manage", office);
      const ref = this.db.collection("workforceStaff").doc(target), prior = await tx.get(ref);
      if (prior.exists) {
        const old = parseGrant(prior.data());
        if (old.role === "owner") throw new WorkforceError(403, "owner_grant_requires_offline_review");
        for (const office of old.offices) requirePermission(actor, "staff.manage", office);
      }
      tx.set(ref, next);
      tx.create(this.db.collection("workforceAudit").doc(randomUUID()), {
        actor: uid, target, action: "staff_grant", before: prior.data() ?? null, after: next, at: new Date().toISOString()
      });
      return { updated: true };
    });
  }
}
