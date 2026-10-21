import { WorkflowError } from "../operations/reads.js";
import { downloadForm, listForms, uploadForm, type FormStore } from "./library.js";

// Called only after the shared revoked-token/admin and live-mode checks.
export async function formRoute(store: FormStore, method: string, path: string, input: unknown, actor: string, dataApproved: boolean) {
  try {
    if (!dataApproved) throw new WorkflowError("operational_data_release_not_approved", 403);
    if (path === "/forms" && method === "GET") return { status: 200, body: await listForms(store, input) };
    if (path === "/forms" && method === "POST") return { status: 200, body: await uploadForm(store, input, actor) };
    const match = /^\/forms\/(templates|submissions)\/([a-f0-9]{64}\.(?:pdf|png|jpg))$/.exec(path);
    if (match && method === "GET") {
      if (!input || typeof input !== "object" || Object.keys(input).length) throw new WorkflowError("invalid_form_request");
      const result = await downloadForm(store, match[1], match[2]);
      return { status: 200, download: result };
    }
    throw new WorkflowError("form_route_not_found", 404);
  } catch (error) {
    return { status: error instanceof WorkflowError ? error.status : 503,
      body: { ok: false, error: error instanceof WorkflowError ? error.code : "form_storage_unavailable" } };
  }
}
