import { randomUUID } from "node:crypto";
import { onRequest } from "firebase-functions/v2/https";
import { defineString } from "firebase-functions/params";
import { workforceIdentity, recentWorkforceIdentity } from "./auth.js";
import { WorkforceStore } from "./store.js";
import { WorkforceError } from "./policy.js";
import type { Action } from "./opportunities.js";
import { IntakeStore } from "./intakeStore.js";
import { intakePacket, packetInventory } from "./packet.js";
import { MAX_DOCUMENT_BYTES } from "./documents.js";
import { GoogleAddressLookup } from "./addresses.js";
// Default closed. These do not authorize applicant collection or vendor writes.
const staffEnabled = defineString("WORKFORCE_STAFF_APPROVED", { default: "false" });
const publicEnabled = defineString("WORKFORCE_PUBLIC_OPPORTUNITIES_APPROVED", { default: "false" });
const collectionApproved = defineString("WORKFORCE_APPLICANT_COLLECTION_APPROVED", { default: "false" });
const packetApproved = defineString("WORKFORCE_PACKET_REVIEW_APPROVED", { default: "false" });
const documentsApproved = defineString("WORKFORCE_ID_DOCUMENTS_APPROVED", { default: "false" });
const retentionApproved = defineString("WORKFORCE_ID_RETENTION_APPROVED", { default: "false" });
const intakeOffice = defineString("WORKFORCE_INTAKE_OFFICE", { default: "" });
const placesApproved = defineString("WORKFORCE_GOOGLE_PLACES_APPROVED", { default: "false" });
export const workforceApi = process.env.PRIMETIME_API_ONLY_DEPLOY === "true" ? undefined : onRequest({ region: "us-central1", maxInstances: 5, concurrency: 2, timeoutSeconds: 60, memory: "512MiB" }, async (req, res) => {
  res.set("Cache-Control", "no-store");
  res.set("X-Content-Type-Options", "nosniff");
  res.set("Referrer-Policy", "no-referrer");
  const path = req.path.replace(/^\/(?:caregiver|primetime)\/workforce-api/, "");
  try {
    const applicationsEnabled = staffEnabled.value() === "true" && collectionApproved.value() === "true" && packetApproved.value() === "true" && !!intakeOffice.value();
    const uploadsEnabled = applicationsEnabled && documentsApproved.value() === "true" && retentionApproved.value() === "true";
    if (path === "/configuration" && req.method === "GET") {
      res.json({ staffEnabled: staffEnabled.value() === "true", accountsEnabled: applicationsEnabled, applicationsEnabled, documentsEnabled: uploadsEnabled, addressLookupEnabled: placesApproved.value() === "true" }); return;
    }
    if (path === "/opportunities" && req.method === "GET") {
      res.json(publicEnabled.value() === "true" && staffEnabled.value() === "true" ? await new WorkforceStore().publicList() : { items: [], release: "pending" }); return;
    }
    // The schema has no completed records or original packet scans. Actual
    // collection requires separately reviewed server-side release parameters.
    if (path === "/application/packet" && req.method === "GET") { res.json({ packet: intakePacket, inventory: packetInventory }); return; }
    if (path === "/application/session" && req.method === "GET") {
      if (!applicationsEnabled) throw new WorkforceError(503, "application_collection_pending");
      res.json({ uid: await workforceIdentity(req), kind: "caregiver", applicationsEnabled, documentsEnabled: uploadsEnabled, addressLookupEnabled: placesApproved.value() === "true" }); return;
    }
    if (path === "/application" || path.startsWith("/application/")) {
      if (!applicationsEnabled) throw new WorkforceError(503, "application_collection_pending");
      const uid = await recentWorkforceIdentity(req), store = new IntakeStore();
      if (["/application/address/suggest", "/application/address/details"].includes(path)) {
        if (placesApproved.value() !== "true") throw new WorkforceError(503, "address_lookup_unavailable");
        if (req.method !== "POST" || !req.is("application/json") || req.rawBody.length > 1500) throw new WorkforceError(400, "invalid_address_request");
        await store.reserveAddressLookup(uid);
        res.json(await new GoogleAddressLookup().lookup(req.body, path.endsWith("/details"))); return;
      }
      if (path === "/application" && req.method === "GET") { res.json({ application: await store.load(uid) }); return; }
      if (path === "/application/documents" && req.method === "GET") {
        if (!uploadsEnabled) throw new WorkforceError(503, "document_collection_pending");
        res.json(await store.listDocuments(uid)); return;
      }
      const download = path.match(/^\/application\/documents\/([a-zA-Z0-9_-]{1,128})$/);
      if (download && req.method === "GET") {
        if (!uploadsEnabled) throw new WorkforceError(503, "document_collection_pending");
        const bytes = await store.download(uid, download[1]!, uid);
        const pdf = bytes.subarray(0, 5).toString("ascii") === "%PDF-";
        res.set("Content-Type", pdf ? "application/pdf" : "image/jpeg"); res.set("Content-Disposition", `attachment; filename="private-document.${pdf ? "pdf" : "jpg"}"`); res.set("Content-Security-Policy", "sandbox");
        res.send(bytes); return;
      }
      if (req.method !== "POST") throw new WorkforceError(405, "method_not_allowed");
      const upload = path === "/application/documents";
      if (upload && !uploadsEnabled) throw new WorkforceError(503, "document_collection_pending");
      if (!req.is("application/json") || req.rawBody.length > (upload ? Math.ceil(MAX_DOCUMENT_BYTES / 3) * 4 + 2048 : 64000)
        || !req.body || typeof req.body !== "object" || Array.isArray(req.body)) throw new WorkforceError(400, "invalid_request");
      const allowed = upload ? ["kind", "base64"] : path === "/application/submit" ? ["revision", "signature"] : ["revision", "answers"];
      if (Object.keys(req.body).some(k => !allowed.includes(k))) throw new WorkforceError(400, "invalid_request");
      if (upload) { res.json({ document: await store.upload(uid, req.body.kind, req.body.base64) }); return; }
      if (!Number.isInteger(req.body.revision) || req.body.revision < 0) throw new WorkforceError(400, "invalid_request");
      if (path === "/application") { res.json({ application: await store.save(uid, req.body.revision, req.body.answers, intakeOffice.value()) }); return; }
      if (path === "/application/submit") { res.json({ application: await store.submit(uid, req.body.revision, req.body.signature) }); return; }
      throw new WorkforceError(404, "route_not_found");
    }
    if (staffEnabled.value() !== "true") throw new WorkforceError(503, "workforce_release_pending");
    const uid = await workforceIdentity(req);
    const store = new WorkforceStore();
    if (path === "/session" && req.method === "GET") { res.json(await store.actor(uid)); return; }
    if (path.startsWith("/staff/applications") && req.method === "GET") {
      if (!applicationsEnabled) throw new WorkforceError(503, "application_collection_pending");
      await recentWorkforceIdentity(req);
      const personnel = new IntakeStore();
      if (path === "/staff/applications") { res.json(await personnel.queue(await store.actor(uid))); return; }
      const detail = path.match(/^\/staff\/applications\/([a-zA-Z0-9_-]{1,128})(?:\/documents(?:\/([a-zA-Z0-9_-]{1,128}))?)?$/);
      if (!detail) throw new WorkforceError(404, "route_not_found");
      const target = detail[1]!, docs = path.includes("/documents");
      const application = await personnel.hrRead(uid, target, docs);
      if (!docs) { res.json({ application }); return; }
      if (!uploadsEnabled) throw new WorkforceError(503, "document_collection_pending");
      if (!detail[2]) { res.json(await personnel.listDocuments(target, uid)); return; }
      const bytes = await personnel.download(target, detail[2], uid);
      const pdf = bytes.subarray(0, 5).toString("ascii") === "%PDF-";
      res.set("Content-Type", pdf ? "application/pdf" : "image/jpeg"); res.set("Content-Disposition", `attachment; filename="private-document.${pdf ? "pdf" : "jpg"}"`); res.set("Content-Security-Policy", "sandbox");
      res.send(bytes); return;
    }
    if (path === "/staff/opportunities" && req.method === "GET") { res.json(await store.list(uid)); return; }
    if (req.method !== "POST") throw new WorkforceError(405, "method_not_allowed");
    if (!req.is("application/json") || req.rawBody.length > 12000 || !req.body || typeof req.body !== "object" || Array.isArray(req.body)) throw new WorkforceError(400, "invalid_request");
    if (path === "/staff/grant") { res.json(await store.grant(uid, req.body.uid, req.body.grant)); return; }
    if (path === "/staff/opportunities") {
      const action: unknown = req.body.action;
      if (action !== undefined && !["submit", "approve", "publish", "close", "archive"].includes(action as string)) throw new WorkforceError(400, "invalid_action");
      res.json(await store.mutate(uid, req.body.id ?? randomUUID(), req.body.revision, req.body.data, action as Action | undefined, req.body.privacyConfirmed === true)); return;
    }
    throw new WorkforceError(404, "route_not_found");
  } catch (error) {
    // No request payloads, Firebase tokens, patient references or document data in logs.
    res.status(error instanceof WorkforceError ? error.status : 503).json({ error: error instanceof WorkforceError ? error.code : "workforce_unavailable" });
  }
});
