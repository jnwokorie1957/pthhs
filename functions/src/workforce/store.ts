import { createHash, randomUUID } from "node:crypto";
import { getFirestore, type Transaction } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { parseGrant, requirePermission, validId, WorkforceError, type Actor, type Grant } from "./policy.js";
import { saveOpportunity, transition, publicOpportunity, type Opportunity, type Action } from "./opportunities.js";

const INVITATION_LIFETIME_MS = 86_400_000;
const TRAINING_VERSION = "workspace-walkthrough-v1";
const TRAINING_DURATION_MS = 49_000;

interface StaffInvitation {
  grant: Grant;
  issuedBy: string;
  issuedAt?: number;
  expiresAt: number;
  state: "pending" | "accepted" | "cancelled";
  requiresPasswordSetup?: boolean;
  activationHash?: string;
}
const hashCode = (value: string) => createHash("sha256").update(value).digest("hex");

export function workEmail(value: unknown): string {
  const email = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new WorkforceError(400, "invalid_staff_email");
  }
  return email;
}
function invitationOpen(invite: StaffInvitation | undefined, now: number): invite is StaffInvitation {
  if (invite?.state !== "pending") return false;
  const issuedAt = invite.issuedAt ?? invite.expiresAt - 7 * INVITATION_LIFETIME_MS;
  return Math.min(invite.expiresAt, issuedAt + INVITATION_LIFETIME_MS) > now;
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
    const activationCode = randomUUID();
    await this.db.runTransaction(async tx => {
      await this.inviteManager(tx, uid, grant.offices);
      const prior = (await tx.get(ref)).data() as StaffInvitation | undefined;
      if (prior?.state === "pending") await this.inviteManager(tx, uid, prior.grant.offices);
      if (prior?.state === "accepted" && !user) throw new WorkforceError(409, "staff_already_registered");
      if (user && (await tx.get(this.db.collection("workforceStaff").doc(user.uid))).exists) {
        throw new WorkforceError(409, "staff_already_registered");
      }
      const invite: StaffInvitation = {
        grant, issuedBy: uid, state: "pending", issuedAt: now, expiresAt: now + INVITATION_LIFETIME_MS,
        requiresPasswordSetup: true, activationHash: hashCode(activationCode)
      };
      tx.set(ref, invite);
      tx.create(this.db.collection("workforceAudit").doc(randomUUID()), {
        actor: uid, target: ref.id, action: "staff_invited", offices: grant.offices, at: new Date(now).toISOString()
      });
    });
    return { email, activationCode };
  }
  async acceptStaffInvite(uid: string, now = Date.now(), activationCode?: string): Promise<Actor> {
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
      if (!invitationOpen(invite, now)) {
        throw new WorkforceError(403, "staff_invite_unavailable");
      }
      if (invite.activationHash && (!activationCode || hashCode(activationCode) !== invite.activationHash)) {
        throw new WorkforceError(403, "staff_invite_link_required");
      }
      const grant = parseGrant(invite.grant);
      if (!grant.active || grant.role === "owner" || invite.issuedBy === uid) {
        throw new WorkforceError(403, "staff_invite_unavailable");
      }
      await this.inviteManager(tx, invite.issuedBy, grant.offices);
      tx.create(staff, grant);
      if (invite.requiresPasswordSetup) {
        tx.create(this.db.collection("workforceStaffCredentials").doc(uid), { setupRequired: true });
      }
      tx.set(ref, { ...invite, state: "accepted" });
      tx.create(this.db.collection("workforceAudit").doc(randomUUID()), {
        actor: uid, target: ref.id, action: "staff_invite_accepted", at: new Date(now).toISOString()
      });
      return { uid, grant };
    });
  }
  async canRequestPasswordSetup(email: string): Promise<boolean> {
    const user = await this.auth().getUserByEmail(email).catch(error => {
      if (error.code === "auth/user-not-found") return null;
      throw error;
    });
    if (!user || user.disabled) return false;
    const staff = await this.db.collection("workforceStaff").doc(user.uid).get();
    return staff.exists && parseGrant(staff.data()).active;
  }
  async actor(uid: string): Promise<Actor> {
    const doc = await this.db.collection("workforceStaff").doc(uid).get();
    if (!doc.exists) throw new WorkforceError(403, "staff_access_required");
    const grant = parseGrant(doc.data());
    if (!grant.active) throw new WorkforceError(403, "staff_access_revoked");
    return { uid, grant };
  }
  private training(uid: string) {
    return this.db.collection("workforceStaffTraining").doc(uid);
  }
  async trainingRequired(actor: Actor): Promise<boolean> {
    if (actor.grant.role === "owner") return false;
    const progress = (await this.training(actor.uid).get()).data();
    return progress?.version !== TRAINING_VERSION || typeof progress.completedAt !== "number";
  }
  async recordTraining(uid: string, action: "start" | "complete", now = Date.now()) {
    const ref = this.training(uid);
    return this.db.runTransaction(async tx => {
      const staff = await tx.get(this.db.collection("workforceStaff").doc(uid));
      if (!staff.exists) throw new WorkforceError(403, "staff_access_required");
      const grant = parseGrant(staff.data());
      if (!grant.active) throw new WorkforceError(403, "staff_access_revoked");
      if (grant.role === "owner") return { complete: true };
      const progress = (await tx.get(ref)).data();
      if (progress?.version === TRAINING_VERSION) {
        if (typeof progress.completedAt === "number") return { complete: true };
        if (action === "start" && typeof progress.startedAt === "number") return { complete: false };
      }
      if (action === "start") {
        tx.set(ref, { version: TRAINING_VERSION, startedAt: now });
        return { complete: false };
      }
      if (progress?.version !== TRAINING_VERSION || typeof progress.startedAt !== "number"
        || now - progress.startedAt < TRAINING_DURATION_MS) {
        throw new WorkforceError(409, "staff_training_incomplete");
      }
      tx.set(ref, { version: TRAINING_VERSION, startedAt: progress.startedAt, completedAt: now });
      return { complete: true };
    });
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
  async reviewTeam(uid: string) {
    const actor = await this.actor(uid);
    requirePermission(actor, "staff.review");
    const limitPerOffice = 50;
    const snapshots = await Promise.all(actor.grant.offices.map(office => this.db.collection("workforceStaff")
      .where("offices", "array-contains", office).limit(limitPerOffice).get()));
    const grants = new Map(snapshots.flatMap(snapshot => snapshot.docs.map(doc => [doc.id, parseGrant(doc.data())] as const)));
    const ids = [...grants.keys()];
    const users = [];
    for (let offset = 0; offset < ids.length; offset += 100) {
      const batch = await this.auth().getUsers(ids.slice(offset, offset + 100).map(uid => ({ uid })));
      users.push(...batch.users);
    }
    // Recheck access after the lookups and restrict the response to the original office scope.
    const current = await this.actor(uid);
    requirePermission(current, "staff.review");
    for (const office of actor.grant.offices) requirePermission(current, "staff.review", office);
    return {
      limitPerOffice,
      items: users.filter(user => user.email).map(user => {
        const grant = grants.get(user.uid)!;
        return { email: user.email, active: grant.active && !user.disabled, role: grant.role, permissions: grant.permissions,
          offices: grant.offices.filter(office => actor.grant.offices.includes(office)) };
      }).sort((a, b) => a.email!.localeCompare(b.email!)),
    };
  }
}
