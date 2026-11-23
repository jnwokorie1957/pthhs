import {actorLabels} from './activity.js';
import {weeklySchedule, schedulesOverlap, type WeeklySchedule} from './assignmentSchedule.js';
import {schedulingReleased} from './staffRelease.js';
import { createHash, randomUUID } from "node:crypto";
import { getFirestore, type Transaction } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { parseGrant, requirePermission, validId, WorkforceError, type Actor, type Grant } from "./policy.js";
import { saveOpportunity, transition, publicOpportunity, type Opportunity, type Action } from "./opportunities.js";
import { canApplyWithCaregiverProfile, caregiverRecruitingProfile } from "./existingCaregiverInterest.js";
import type { HhaProfile } from "./hhaSource.js";

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
        actor: uid, target: ref.id, action: "staff_invite_accepted", offices: grant.offices, at: new Date(now).toISOString()
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
    for(const item of items){if(!item.createdBy){const first=(await this.db.collection('workforceOpportunities').doc(item.id).collection('versions').doc('1').get()).data();if(first&&validId(first.updatedBy)&&typeof first.updatedAt==='string'){item.createdBy=first.updatedBy;item.createdAt=first.updatedAt;}}if(!item.publishedBy&&item.state==='published'){item.publishedBy=item.updatedBy;item.publishedAt=item.updatedAt;}}
    const people=await actorLabels(items.flatMap(item=>[item.createdBy,item.publishedBy,item.updatedBy].filter((id):id is string=>!!id)),ids=>this.auth().getUsers(ids.map(uid=>({uid}))));
    const current=await this.actor(uid);for(const office of actor.grant.offices)requirePermission(current,"opportunities.read",office);return { items, people, limitPerOffice: 100 };
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
  async existingCaregiverInterest(uid: string, id: string, profile?: HhaProfile) {
    if (!validId(uid) || !validId(id)) throw new WorkforceError(400, "invalid_request");
    const opening = this.db.collection("workforceOpportunities").doc(id);
    const interest = opening.collection("existingCaregiverInterests").doc(hashCode(uid));
    return this.db.runTransaction(async tx => {
      const opportunity = (await tx.get(opening)).data() as Opportunity | undefined;
      if (!opportunity || !publicOpportunity(opportunity)) throw new WorkforceError(409, "opportunity_unavailable");
      const saved = await tx.get(interest);
      if (!profile) return {recorded: saved.data()?.office === opportunity.office, opportunityId: id};
      if (!canApplyWithCaregiverProfile(profile)) throw new WorkforceError(403, "existing_caregiver_not_active");
      if (profile.office !== opportunity.office) throw new WorkforceError(403, "opportunity_office_mismatch");

      await this.verifyCaregiverLink(tx, uid, profile.id, profile.office, hashCode(profile.email.trim().toLowerCase()));
      if (saved.data()?.office !== opportunity.office) {
        const at = new Date().toISOString();
        const name = [profile.firstName, profile.lastName].filter(Boolean).join(" ");
        tx.set(interest, {uid, caregiverId: profile.id, name, office: opportunity.office, createdAt: at});
        tx.create(this.db.collection("workforceAudit").doc(randomUUID()), {
          actor: uid, target: id, office: opportunity.office, action: "existing_caregiver_opportunity_interest", at,
        });
      }
      return {recorded: true, opportunityId: id};
    });
  }
  private async verifyCaregiverLink(tx: Transaction, uid: string, caregiverId: string, office: string, emailKey?: string) {
    const [forward, reverse] = await Promise.all([
      tx.get(this.db.collection("workforceHhaLinks").doc(uid)),
      tx.get(this.db.collection("workforceHhaAssignments").doc(caregiverId)),
    ]);
    const link = forward.data();
    const assignment = reverse.data();
    if (link?.uid !== uid || assignment?.uid !== uid || link.caregiverId !== caregiverId ||
        assignment.caregiverId !== caregiverId || link.office !== office || assignment.office !== office ||
        typeof link.emailKey !== "string" || link.emailKey !== assignment.emailKey ||
        (emailKey !== undefined && link.emailKey !== emailKey)) {
      throw new WorkforceError(403, "hha_profile_unavailable");
    }
  }
  private async caregiverApplicantOpening(tx: Transaction, uid: string, id: string) {
    const staff = (await tx.get(this.db.collection("workforceStaff").doc(uid))).data();
    if (!staff) throw new WorkforceError(403, "staff_access_required");
    const actor = {uid, grant: parseGrant(staff)};
    requirePermission(actor, "opportunities.read");
    requirePermission(actor, "applicants.review");
    const opening = this.db.collection("workforceOpportunities").doc(id);
    const opportunity = (await tx.get(opening)).data() as Opportunity | undefined;
    if (!opportunity) throw new WorkforceError(404, "opportunity_not_found");
    requirePermission(actor, "opportunities.read", opportunity.office);
    requirePermission(actor, "applicants.review", opportunity.office);
    return {actor, opening, opportunity};
  }
  async existingCaregiverApplicants(uid: string, id: string, after?: string) {
    if (!validId(id) || (after !== undefined && !validId(after))) throw new WorkforceError(400, "invalid_request");
    return this.db.runTransaction(async tx => {
      const {opening, opportunity} = await this.caregiverApplicantOpening(tx, uid, id);
      let query = opening.collection("existingCaregiverInterests").orderBy("__name__").limit(51);
      if (after) query = query.startAfter(after);
      const [{docs}, selection] = await Promise.all([tx.get(query), tx.get(opening.collection("selection").doc("chosen"))]);
      const choice = selection.data();
      return {
        items: docs.slice(0, 50).filter(doc => doc.data().office === opportunity.office).map(doc => {
          const {name, caregiverId, createdAt, response} = doc.data();
          const status = response ?? (choice?.applicationId === doc.id && choice?.office === opportunity.office ? "pending" : null);
          return {id: doc.id, name, caregiverId, createdAt, ...(status ? {response: status} : {})};
        }),
        next: docs.length > 50 ? docs[49]!.id : null,
      };
    });
  }
  async existingCaregiverApplicantProfile(uid: string, openingId: string, applicationId: string) {
    if (!validId(openingId) || !validId(applicationId)) throw new WorkforceError(400, "invalid_request");
    return this.db.runTransaction(async tx => {
      const {actor, opening, opportunity} = await this.caregiverApplicantOpening(tx, uid, openingId);
      const application = (await tx.get(opening.collection("existingCaregiverInterests").doc(applicationId))).data();
      if (!application || application.office !== opportunity.office || !validId(application.caregiverId)) {
        throw new WorkforceError(404, "application_not_found");
      }
      const {name, caregiverId, createdAt} = application;
      const cached = (await tx.get(this.db.collection("workforceHhaProfiles").doc(caregiverId))).data() as HhaProfile | undefined;
      const profile = cached?.id === caregiverId && cached.office === opportunity.office ? caregiverRecruitingProfile(cached) : null;
      const choice = (await tx.get(opening.collection("selection").doc("chosen"))).data();
      tx.create(this.db.collection("workforceAudit").doc(randomUUID()), {
        actor: uid, target: openingId, applicationId, office: opportunity.office,
        action: "existing_caregiver_recruiting_profile_read", at: new Date().toISOString(),
      });
      const isSelected = choice?.applicationId === applicationId && choice.office === opportunity.office;
      const selection = isSelected ? "selected" :
        choice && (choice.response !== "declined" || choice.office !== opportunity.office) ? "another_selected" : null;
      const {response, respondedAt} = application;
      const canSelect = !selection && !response && actor.grant.permissions.includes("opportunities.edit") && !!publicOpportunity(opportunity);
      return {name, caregiverId, createdAt, profile, selection, canSelect, ...(response ? {response, respondedAt} : {})};
    });
  }
  async selectExistingCaregiver(uid: string, openingId: string, applicationId: string, revision: number) {
    if (!validId(openingId) || !validId(applicationId) || !Number.isSafeInteger(revision) || revision < 1) {
      throw new WorkforceError(400, "invalid_request");
    }
    return this.db.runTransaction(async tx => {
      const {actor, opening, opportunity} = await this.caregiverApplicantOpening(tx, uid, openingId);
      requirePermission(actor, "opportunities.edit", opportunity.office);
      const application = (await tx.get(opening.collection("existingCaregiverInterests").doc(applicationId))).data();
      if (!application || application.office !== opportunity.office || !validId(application.uid) || !validId(application.caregiverId)) {
        throw new WorkforceError(404, "application_not_found");
      }
      const choiceRef = opening.collection("selection").doc("chosen");
      const choice = (await tx.get(choiceRef)).data();
      if (choice) {
        if (choice.applicationId === applicationId && choice.office === opportunity.office && !application.response) return {selected: true};
        if (choice.response !== "declined" || choice.office !== opportunity.office) {
          throw new WorkforceError(409, "opportunity_already_selected");
        }
      }
      if (application.response) throw new WorkforceError(409, "opportunity_response_recorded");
      if (opportunity.revision !== revision) throw new WorkforceError(409, "revision_conflict");
      if (!publicOpportunity(opportunity)) throw new WorkforceError(409, "opportunity_unavailable");
      await this.verifyCaregiverLink(tx, application.uid, application.caregiverId, opportunity.office);
      const latest = (await tx.get(this.db.collection("workforceHhaProfiles").doc(application.caregiverId))).data() as HhaProfile | undefined;
      if (latest && (latest.id !== application.caregiverId || latest.office !== opportunity.office || !canApplyWithCaregiverProfile(latest))) {
        throw new WorkforceError(403, "existing_caregiver_not_active");
      }

      const at = new Date().toISOString();
      const notice = this.selectionNotice(application.uid, openingId);
      tx.set(choiceRef, {applicationId, caregiverId: application.caregiverId, office: opportunity.office, revision, selectedBy: uid, at});
      tx.create(notice, {opportunityId: openingId, location: opportunity.public.location, weeklyHours: opportunity.public.weeklyHours, at});
      tx.create(this.db.collection("workforceAudit").doc(randomUUID()), {
        actor: uid, target: openingId, applicationId, office: opportunity.office, action: "opportunity_caregiver_selected", at,
      });
      return {selected: true};
    });
  }
  private selectionNotice(uid: string, openingId: string) {
    return this.db.collection("workforceOpportunityInboxes").doc(uid).collection("selections").doc(openingId);
  }
  async respondToOpportunitySelection(uid: string, openingId: string, response: unknown) {
    if (!validId(uid) || !validId(openingId) || (response !== "accepted" && response !== "declined")) {
      throw new WorkforceError(400, "invalid_request");
    }
    return this.db.runTransaction(async tx => {
      const noticeRef = this.selectionNotice(uid, openingId);
      const notice = (await tx.get(noticeRef)).data();
      if (!notice || notice.opportunityId !== openingId) throw new WorkforceError(404, "selection_not_found");
      if (notice.response === response) return {response, respondedAt: notice.respondedAt};
      if (notice.response) throw new WorkforceError(409, "opportunity_response_recorded");

      const opening = this.db.collection("workforceOpportunities").doc(openingId);
      const choiceRef = opening.collection("selection").doc("chosen");
      const choice = (await tx.get(choiceRef)).data();
      if (!choice || choice.response || !validId(choice.applicationId)) throw new WorkforceError(409, "opportunity_selection_changed");
      const applicationRef = opening.collection("existingCaregiverInterests").doc(choice.applicationId);
      const application = (await tx.get(applicationRef)).data();
      if (!application || application.uid !== uid || application.office !== choice.office ||
          application.caregiverId !== choice.caregiverId || !validId(application.caregiverId)) {
        throw new WorkforceError(403, "workforce_forbidden");
      }
      await this.verifyCaregiverLink(tx, uid, application.caregiverId, choice.office);
      if (response === "accepted") {
        const record = (await tx.get(opening)).data() as Opportunity | undefined;
        if (!record || record.office !== choice.office || record.revision !== choice.revision || !publicOpportunity(record)) {
          throw new WorkforceError(409, "opportunity_selection_changed");
        }
      }
      const decision = {response, respondedAt: new Date().toISOString()};
      tx.set(noticeRef, {...notice, ...decision});
      tx.set(choiceRef, {...choice, ...decision});
      tx.set(applicationRef, {...application, ...decision});
      tx.create(this.db.collection("workforceAudit").doc(randomUUID()), {
        actor: uid, target: openingId, applicationId: choice.applicationId, office: choice.office,
        action: response === "accepted" ? "opportunity_caregiver_accepted" : "opportunity_caregiver_declined", at: decision.respondedAt,
      });
      return decision;
    });
  }
  async assignmentSchedule(uid: string, openingId: string, applicationId: string, update?: {revision:number; schedule:unknown}) {
    if (!schedulingReleased()) throw new WorkforceError(423, "staff_phase_pending");
    if (!validId(openingId) || !validId(applicationId) ||
        (update && (!Number.isSafeInteger(update.revision) || update.revision < 0))) throw new WorkforceError(400, "invalid_request");
    return this.db.runTransaction(async tx => {
      const {actor, opening, opportunity} = await this.caregiverApplicantOpening(tx, uid, openingId);
      requirePermission(actor, "opportunities.edit", opportunity.office);
      const [applicationSnap, choiceSnap] = await Promise.all([
        tx.get(opening.collection("existingCaregiverInterests").doc(applicationId)),
        tx.get(opening.collection("selection").doc("chosen")),
      ]);
      const application = applicationSnap.data(), choice = choiceSnap.data();
      if (!application || !choice || choice.applicationId !== applicationId || choice.response !== "accepted" ||
          application.response !== "accepted" || application.office !== opportunity.office || choice.office !== opportunity.office ||
          choice.caregiverId !== application.caregiverId || !validId(application.caregiverId) || !validId(application.uid)) {
        throw new WorkforceError(409, "accepted_assignment_required");
      }
      await this.verifyCaregiverLink(tx, application.uid, application.caregiverId, opportunity.office);
      const calendar = this.db.collection("workforceAssignmentCalendars").doc(application.caregiverId);
      const assignments = calendar.collection("assignments"), ref = assignments.doc(openingId);
      const prior = (await tx.get(ref)).data();
      if (prior && (prior.uid !== application.uid || prior.office !== opportunity.office || prior.applicationId !== applicationId)) {
        throw new WorkforceError(409, "opportunity_selection_changed");
      }
      const result = (schedule: WeeklySchedule | null, revision: number) => ({schedule, revision});
      if (!update) return result(prior?.schedule ?? null, prior?.revision ?? 0);
      const filled = opportunity.state === "closed" && opportunity.revision === choice.revision + 1;
      const archivedAfterFill = opportunity.state === "archived" && opportunity.revision === choice.revision + 2;
      if (!filled && !archivedAfterFill) {
        throw new WorkforceError(409, "filled_assignment_required");
      }
      const schedule = weeklySchedule(update.schedule, opportunity.public);
      if (prior && JSON.stringify(weeklySchedule(prior.schedule, opportunity.public)) === JSON.stringify(schedule)) {
        return result(schedule, prior.revision);
      }
      if (update.revision !== (prior?.revision ?? 0)) throw new WorkforceError(409, "revision_conflict");
      // Serialize even the first two confirmations for different openings on an empty calendar.
      await tx.get(calendar);
      const others = await tx.get(assignments.orderBy("__name__"));
      if (others.docs.some(doc => doc.id !== openingId && schedulesOverlap(doc.data().schedule, schedule))) {
        throw new WorkforceError(409, "assignment_schedule_conflict");
      }
      const at = new Date().toISOString(), revision = update.revision + 1;
      tx.set(calendar, {updatedAt:at});
      tx.set(ref, {schedule, revision, uid:application.uid, office:opportunity.office, applicationId,
        location:opportunity.public.location, weeklyHours:opportunity.public.weeklyHours, updatedAt:at, updatedBy:uid});
      tx.create(this.db.collection("workforceAudit").doc(randomUUID()), {actor:uid, target:openingId, office:opportunity.office,
        action:"assignment_schedule_confirmed", applicationId, revision, schedule, at});
      return result(schedule, revision);
    });
  }
  async ownAssignmentSchedules(uid: string) {
    if (!schedulingReleased()) throw new WorkforceError(423, "staff_phase_pending");
    return this.db.runTransaction(async tx => {
      const link = (await tx.get(this.db.collection("workforceHhaLinks").doc(uid))).data();
      if (!link || !validId(link.caregiverId) || !validId(link.office)) throw new WorkforceError(403, "hha_profile_unavailable");
      await this.verifyCaregiverLink(tx, uid, link.caregiverId, link.office);
      const assignments = this.db.collection("workforceAssignmentCalendars").doc(link.caregiverId).collection("assignments");
      const snapshot = await tx.get(assignments.orderBy("__name__"));
      return {items:snapshot.docs.flatMap(doc => {
        const record = doc.data();
        if (record.uid !== uid || record.office !== link.office) return [];
        return [{schedule:record.schedule as WeeklySchedule, location:record.location, weeklyHours:record.weeklyHours}];
      })};
    });
  }
  async ownOpportunitySelections(uid: string) {
    if (!validId(uid)) throw new WorkforceError(400, "invalid_request");
    const snapshot = await this.db.collection("workforceOpportunityInboxes").doc(uid)
      .collection("selections").orderBy("at", "desc").limit(20).get();
    return {items: snapshot.docs.map(doc => {
      const {opportunityId, location, weeklyHours, at, response, respondedAt} = doc.data();
      return {opportunityId, location, weeklyHours, at, ...(response ? {response, respondedAt} : {})};
    })};
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
        actor: uid, target, action: "staff_grant", offices: next.offices, before: prior.data() ?? null, after: next, at: new Date().toISOString()
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
