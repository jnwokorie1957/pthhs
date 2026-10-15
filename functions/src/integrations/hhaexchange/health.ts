import { WorkflowError } from "../../operations/reads.js";
import type { HhaCredentials } from "./config.js";
import type { HhaRequestBudget, HhaSoapClient, HhaCallResponse } from "./client.js";

interface HealthDependencies {
  getCredentials(): unknown;
  createClient(credentials: HhaCredentials, budget: HhaRequestBudget): Pick<HhaSoapClient, "getCollectionStatuses">;
  reserveRead(): Promise<void>;
  deferReads(seconds: number): Promise<void>;
  now?: () => Date;
}
type Readiness = {
  credentials: "ready" | "unavailable";
  requestBudget: "not_checked" | "ready" | "deferred" | "unavailable";
  authentication: "not_established" | "accepted" | "rejected";
};
export interface HhaHealthResult {
  status: number;
  body: {
    ok: boolean; hhaConnection: string; operation: string; stage: string; error?: string;
    readiness: Readiness; checkedAt: string;
    referenceCount?: number; correlationId?: string; durationMs?: number;
    httpStatus?: number; errorId?: number; errorKind?: string; retryAfterSeconds?: number;
  };
}
const OPERATION = "GetCollectionStatus";
const BUDGET_CODES = new Set(["vendor_backoff_active", "read_budget_exhausted_retry_next_minute"]);

function credentials(value: unknown): HhaCredentials {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid_credentials");
  const input = value as Record<string, unknown>;
  if (["appName", "appSecret", "appKey"].some(key => typeof input[key] !== "string" || !(input[key] as string).trim())) throw new Error("invalid_credentials");
  return { appName: input.appName as string, appSecret: input.appSecret as string, appKey: input.appKey as string };
}
function safeMetadata(result: HhaCallResponse) {
  return {
    ...(typeof result.correlationId === "string" && /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(result.correlationId) ? { correlationId: result.correlationId } : {}),
    ...(Number.isFinite(result.durationMs) && result.durationMs >= 0 ? { durationMs: Math.round(result.durationMs) } : {}),
    ...(Number.isInteger(result.httpStatus) && result.httpStatus >= 0 && result.httpStatus <= 599 ? { httpStatus: result.httpStatus } : {}),
    ...(result.error?.id !== undefined && Number.isSafeInteger(result.error.id) ? { errorId: result.error.id } : {}),
  };
}

// A reference read proves vendor authentication only when the vendor accepts the
// operation. Neither a configured secret nor an HTTP 200 is that acceptance.
// Error messages, SOAP bodies and reference values never enter this response.
export async function checkHhaHealth(dependencies: HealthDependencies): Promise<HhaHealthResult> {
  const readiness: Readiness = { credentials: "unavailable", requestBudget: "not_checked", authentication: "not_established" };
  const checkedAt = (dependencies.now?.() ?? new Date()).toISOString();
  const failure = (status: number, stage: "credentials" | "storage" | "hha", error: string, hhaConnection: string, extra: Record<string, unknown> = {}) => ({
    status, body: { ok: false, hhaConnection, operation: OPERATION, stage, error, readiness: { ...readiness }, checkedAt, ...extra },
  });
  let value: HhaCredentials;
  try { value = credentials(dependencies.getCredentials()); readiness.credentials = "ready"; }
  catch { return failure(503, "credentials", "hha_credentials_unavailable_or_invalid", "not_configured"); }
  let storageFailure: { error: unknown; during: "reserve" | "defer" } | undefined;
  const storageResult = () => {
    const error = storageFailure?.error;
    if (storageFailure?.during === "reserve" && error instanceof WorkflowError && BUDGET_CODES.has(error.code) && error.status === 429) {
      readiness.requestBudget = "deferred";
      const wait = error.retryAfterSeconds;
      return failure(429, "storage", error.code, "deferred", typeof wait === "number" && Number.isFinite(wait) && wait > 0 ? { retryAfterSeconds: Math.ceil(wait) } : {});
    }
    readiness.requestBudget = "unavailable";
    return failure(503, "storage", storageFailure?.during === "defer" ? "hha_backoff_storage_unavailable" : "hha_read_budget_storage_unavailable", "unavailable");
  };
  const budget: HhaRequestBudget = {
    async beforeRequest() {
      try { await dependencies.reserveRead(); readiness.requestBudget = "ready"; }
      catch (error) { storageFailure = { error, during: "reserve" }; throw error; }
    },
    async defer(seconds) {
      try { await dependencies.deferReads(seconds); }
      catch (error) { storageFailure = { error, during: "defer" }; throw error; }
    },
  };
  try {
    const result = await dependencies.createClient(value, budget).getCollectionStatuses("Active");
    if (storageFailure) return storageResult();
    const metadata = safeMetadata(result.response);
    if (result.response.ok) {
      readiness.authentication = "accepted";
      return { status: 200, body: { ok: true, hhaConnection: "reachable", operation: OPERATION, stage: "complete", readiness: { ...readiness }, checkedAt,
        referenceCount: result.statuses.length, ...metadata } };
    }
    if ([401, 403].includes(result.response.httpStatus)) {
      readiness.authentication = "rejected";
      return failure(502, "hha", "hha_authentication_rejected", "auth_failure", { ...metadata, errorKind: "transport" });
    }
    const kind = result.response.error?.kind;
    if (result.response.httpStatus === 0 || kind === "transport") return failure(503, "hha", "hha_transport_unavailable", "transport_failure", { ...metadata, errorKind: "transport" });
    if (kind === "application") return failure(502, "hha", "hha_application_rejected", "operation_failure", { ...metadata, errorKind: "application" });
    if (kind === "soap_fault") return failure(502, "hha", "hha_soap_fault", "operation_failure", { ...metadata, errorKind: "soap_fault" });
    return failure(502, "hha", "hha_response_not_accepted", "operation_failure", { ...metadata, errorKind: "protocol" });
  } catch {
    if (storageFailure) return storageResult();
    return failure(503, "hha", "hha_health_check_unavailable", "unavailable");
  }
}
