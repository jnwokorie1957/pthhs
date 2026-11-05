import { randomUUID } from "node:crypto";
import { onRequest } from "firebase-functions/v2/https";
import { defineString } from "firebase-functions/params";
import { workforceIdentity } from "./auth.js";
import { WorkforceStore } from "./store.js";
import { WorkforceError } from "./policy.js";
import type { Action } from "./opportunities.js";
// Default closed. These do not authorize applicant collection or vendor writes.
const staffEnabled = defineString("WORKFORCE_STAFF_APPROVED", { default: "false" });
const publicEnabled = defineString("WORKFORCE_PUBLIC_OPPORTUNITIES_APPROVED", { default: "false" });
export const workforceApi = process.env.PRIMETIME_API_ONLY_DEPLOY === "true" ? undefined : onRequest({ region: "us-central1", maxInstances: 5, timeoutSeconds: 30 }, async (req, res) => {
  res.set("Cache-Control", "no-store");
  res.set("X-Content-Type-Options", "nosniff");
  const path = req.path.replace(/^\/(?:caregiver|primetime)\/workforce-api/, "");
  try {
    if (path === "/configuration" && req.method === "GET") {
      res.json({ staffEnabled: staffEnabled.value() === "true", accountsEnabled: false, applicationsEnabled: false }); return;
    }
    if (path === "/opportunities" && req.method === "GET") {
      res.json(publicEnabled.value() === "true" && staffEnabled.value() === "true" ? await new WorkforceStore().publicList() : { items: [], release: "pending" }); return;
    }
    if (staffEnabled.value() !== "true") throw new WorkforceError(503, "workforce_release_pending");
    const uid = await workforceIdentity(req);
    const store = new WorkforceStore();
    if (path === "/session" && req.method === "GET") { res.json(await store.actor(uid)); return; }
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
