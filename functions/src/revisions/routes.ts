import { WorkflowError } from "../operations/reads.js";
import { recordId, strictObject } from "./policy.js";
import type { RevisionActor, RevisionBackend } from "./service.js";

export async function revisionRoute(backend: RevisionBackend, actor: RevisionActor, method: string, path: string, value: unknown) {
  if (!path.startsWith("/revisions/")) return null;
  try {
    let result: unknown;
    if (method === "GET" && path === "/revisions/status") { strictObject(value, [], []); result = await backend.status(actor); return { status: 200, body: result }; }
    if (method === "GET" && path === "/revisions/visits") { result = await backend.visits(actor, value); return { status: 200, body: result }; }
    if (path === "/revisions/policy" && ["GET", "POST"].includes(method)) { if (method === "GET") strictObject(value, [], []); result = await backend.policy(actor, method === "POST" ? value : undefined); }
    else if (path === "/revisions/contacts" && ["GET", "POST"].includes(method)) {
      const query = method === "GET" ? strictObject(value, ["cursor"], []) : null;
      if (query?.cursor !== undefined && typeof query.cursor !== "string") throw new WorkflowError("invalid_page_cursor");
      result = await backend.contacts(actor, method === "POST" ? value : undefined, query?.cursor as string | undefined);
    } else if (method === "GET" && path === "/revisions/requirements") {
      const query = strictObject(value, ["cursor"], []);
      if (query.cursor !== undefined && typeof query.cursor !== "string") throw new WorkflowError("invalid_page_cursor");
      result = await backend.requirements(actor, query.cursor as string | undefined);
    } else if (method === "GET" && ["/revisions/exceptions", "/revisions/call-matches"].includes(path)) {
      const records = await backend.records(actor);
      result = await records.page(path.endsWith("exceptions") ? "exceptions" : "callMatches", value);
    } else if (method === "POST" && path === "/revisions/requirements/save") result = await (await backend.records(actor)).saveRequirement(value);
    else if (method === "POST" && path === "/revisions/requirements/complete") result = await (await backend.records(actor)).recordCompletion(value);
    else if (method === "POST" && path === "/revisions/requirements/review") result = await (await backend.records(actor)).reviewCompletion(value);
    else if (method === "POST" && path === "/revisions/exceptions/review") result = await (await backend.records(actor)).reviewException(value);
    else if (method === "POST" && path === "/revisions/call-matches/prepare") result = await backend.callCandidates(actor, value);
    else if (method === "POST" && path === "/revisions/call-matches/decide") result = await backend.decideCallMatch(actor, value);
    else if (method === "GET" && path === "/revisions/notifications") {
      const query = strictObject(value, ["cursor"], []);
      if (query.cursor !== undefined && typeof query.cursor !== "string") throw new WorkflowError("invalid_page_cursor");
      const { box, context } = await backend.outbox(actor); result = await box.page(context, query.cursor as string | undefined);
    } else if (method === "POST" && path === "/revisions/notifications/acknowledge") {
      const input = strictObject(value, ["id", "note"]);
      if (typeof input.note !== "string") throw new WorkflowError("invalid_notification_acknowledgement");
      const { box, context } = await backend.outbox(actor); result = await box.acknowledge(recordId(input.id), context, input.note);
    } else return { status: ["GET", "POST"].includes(method) ? 404 : 405, body: { ok: false, error: "revision_route_not_found" } };
    return { status: 200, body: { ok: true, mode: "live", source: "primetime", ...(result && typeof result === "object" ? result : { result }) } };
  } catch (error) {
    return { status: error instanceof WorkflowError ? error.status : 503, body: { ok: false, error: error instanceof WorkflowError ? error.code : "revision_backend_unavailable",
      ...(error instanceof WorkflowError && error.retryAfterSeconds ? { retryAfterSeconds: error.retryAfterSeconds } : {}) } };
  }
}
