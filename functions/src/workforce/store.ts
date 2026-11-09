import { createHash, randomUUID } from "node:crypto";
import { getFirestore, type Transaction } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { parseGrant, requirePermission, validId, WorkforceError, type Actor, type Grant } from "./policy.js";
import { saveOpportunity, transition, publicOpportunity, type Opportunity, type Action } from "./opportunities.js";

interface StaffInvitation {
  grant: Grant;
  issuedBy: string;
  expiresAt: number;
  state: "pending" | "accepted" | "cancelled";
}

function workEmail(value: unknown): string {
  const email = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new WorkforceError(400, "invalid_staff_email");
  }
  return email;
}

export class WorkforceStore {
  constructor(private db = getFirestore(), private auth = getAuth) {}
  private invitation(email: string) {
    const key = createHash("sha256").update(email).digest("hex");
    return this.db.collection("workforceStaffInvitations").doc(key);
  }
  private async inviteManager(tx: Transaction, uid: string, offices: string[]) {
    const owner = await tx.get(this.db.collection("workforceStaff").doc(uid));
    if (!owner.exists) throw new WorkforceError(403, "staff_access_required");
    const actor = { uid, grant: parseGrant(owner.data()) };
    requirePermission(actor, "staff.manage");
    for (const office of offices) requirePermission(actor, "staff.manage", office);
  }
  async inviteStaff(uid: string, address: unknown, input: unknown, now = Date.now()) {
    const email = workEmail(address), grant = parseGrant(input);
    if (!grant.active || grant.role === "owner" || !grant.permissions.length) {
      throw new WorkforceError(400, "invalid_staff_grant");
    }
    const manager = await this.actor(uid);
    requirePermission(manager, "staff.manage");
    const user = await this.auth().getUserByEmail(email).catch(error => {
      if (error.code === "auth/user-not-found") return null;
      throw error;
    });
    if (user?.uid === uid || user?.disabled) throw new WorkforceError(409, "invalid_staff_target");
    const ref = this.invitation(email);
    await this.db.runTransaction(async tx => {
      await this.inviteManager(tx, uid, grant.offices);
      const prior = (await tx.get(ref)).data() as StaffInvitation | undefined;
      if (prior?.state === "pending") await this.inviteManager(tx, uid, prior.grant.offices);
      if (prior?.state === "accepted" && !user) throw new WorkforceError(409, "staff_already_registered");
      if (user && (await tx.get(this.db.collection("workforceStaff").doc(user.uid))).exists) {
        throw new WorkforceError(409, "staff_already_registered");
      }
      const invite: StaffInvitation = { grant, issuedBy: uid, state: "pending", expiresAt: now + 7 * 86400000 };
      tx.set(ref, invite);
      tx.create(this.db.collection("workforceAudit").doc(randomUUID()), {
        actor: uid, target: ref.id, action: "staff_invited", offices: grant.offices, at: new Date(now).toISOString()
      });
    });
    return { email };
  }
  async cancelStaffInvite(uid: string, address: unknown) {
    const ref = this.invitation(workEmail(address));
    await this.db.runTransaction(async tx => {
      await this.inviteManager(tx, uid, []);
      const invite = (await tx.get(ref)).data() as StaffInvitation | undefined;
      if (invite?.state !== "pending") throw new WorkforceError(409, "staff_invite_not_pending");
      await this.inviteManager(tx, uid, invite.grant.offices);
      tx.set(ref, { ...invite, state: "cancelled" });
      tx.create(this.db.collection("workforceAudit").doc(randomUUID()), {
        actor: uid, target: ref.id, action: "staff_invite_cancelled", at: new Date().toISOString()
      });
    });
    return { cancelled: true };
  }
  async acceptStaffInvite(uid: string, now = Date.now()): Promise<Actor> {
    const user = await this.auth().getUser(uid);
    if (!user.email || !user.emailVerified || user.disabled) throw new WorkforceError(401, "verified_identity_required");
    const ref = this.invitation(workEmail(user.email));
    const staff = this.db.collection("workforceStaff").doc(uid);
    return this.db.runTransaction(async tx => {
      // Concurrent sign-in callbacks may reach this endpoint after activation.
      // Return the current active grant without consuming or replacing it.
      const current = await tx.get(staff);
      if (current.exists) {
        const grant = parseGrant(current.data());
        if (!grant.active) throw new WorkforceError(403, "staff_access_revoked");
        return { uid, grant };
      }
      const invite = (await tx.get(ref)).data() as StaffInvitation | undefined;
      if (invite?.state !== "pending" || invite.expiresAt <= now) {
        throw new WorkforceError(403, "staff_invite_unavailable");
      }
      const grant = parseGrant(invite.grant);
      if (!grant.active || grant.role === "owner" || invite.issuedBy === uid) {
        throw new WorkforceError(403, "staff_invite_unavailable");
      }
      await this.inviteManager(tx, invite.issuedBy, grant.offices);
      tx.create(staff, grant);
      tx.set(ref, { ...invite, state: "accepted" });
      tx.create(this.db.collection("workforceAudit").doc(randomUUID()), {
        actor: uid, target: ref.id, action: "staff_invite_accepted", at: new Date(now).toISOString()
      });
      return { uid, grant };
    });
  }
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
  async interest(uid: string, id: string) {
    if (!validId(uid)||!validId(id)) throw new WorkforceError(400,"invalid_request");
    return this.db.runTransaction(async tx=>{
      const opportunity=await tx.get(this.db.collection("workforceOpportunities").doc(id));
      if (!opportunity.exists||!publicOpportunity(opportunity.data() as Opportunity)) throw new WorkforceError(409,"opportunity_unavailable");
      const key=createHash("sha256").update(JSON.stringify([uid,id])).digest("hex");
      const ref=this.db.collection("workforceOpportunityInterests").doc(key), prior=await tx.get(ref);
      if(!prior.exists){
        tx.create(ref,{uid,opportunityId:id,office:opportunity.data()!.office,state:"interest_recorded",createdAt:new Date().toISOString()});
        tx.create(this.db.collection("workforceAudit").doc(randomUUID()),{actor:uid,target:id,action:"opportunity_interest",at:new Date().toISOString()});
      }
      return {recorded:true,opportunityId:id};
    });
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
