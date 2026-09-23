import { logger } from "firebase-functions";
import { onRequest } from "firebase-functions/v2/https";
import {
  PrimetimeAuthError,
  requirePrimetimeAdmin,
} from "./auth/admin.js";
import {
  getHhaCredentials,
  hhaBaseUrl,
  hhaCredentials,
} from "./integrations/hhaexchange/config.js";
import { HhaSoapClient } from "./integrations/hhaexchange/client.js";

const API_PREFIX = "/primetime/api";

function apiPath(path: string): string {
  if (path.startsWith(API_PREFIX)) {
    return path.slice(API_PREFIX.length) || "/";
  }
  return path || "/";
}

export const primetimeApi = onRequest(
  {
    region: "us-central1",
    timeoutSeconds: 60,
    memory: "256MiB",
    maxInstances: 10,
    secrets: [hhaCredentials],
  },
  async (request, response) => {
    response.set("Cache-Control", "no-store");

    let principal;
    try {
      principal = await requirePrimetimeAdmin(request);
    } catch (error) {
      if (error instanceof PrimetimeAuthError) {
        response.status(error.statusCode).json({ error: error.code });
        return;
      }

      logger.error("Primetime authentication failed unexpectedly", {
        errorName: error instanceof Error ? error.name : "unknown",
      });
      response.status(500).json({ error: "auth_internal_error" });
      return;
    }

    const path = apiPath(request.path);

    if (request.method === "GET" && path === "/session") {
      response.status(200).json({
        ok: true,
        uid: principal.uid,
        roles: principal.roles,
        ...(principal.email ? { email: principal.email } : {}),
      });
      return;
    }

    if (request.method === "GET" && path === "/status") {
      response.status(200).json({
        ok: true,
        service: "primetime-admin-api",
        stage: "auth-gated",
        hhaConnection: "not_tested",
      });
      return;
    }

    if (request.method === "GET" && path === "/hha/health") {
      const client = new HhaSoapClient(
        hhaBaseUrl.value(),
        getHhaCredentials(),
      );
      const result = await client.getCollectionStatuses("Active");

      if (result.response.ok) {
        response.status(200).json({
          ok: true,
          hhaConnection: "reachable",
          operation: "GetCollectionStatus",
          correlationId: result.response.correlationId,
          referenceCount: result.statuses.length,
          durationMs: result.response.durationMs,
        });
        return;
      }

      const statusCode = result.response.httpStatus === 0 ? 503 : 502;
      response.status(statusCode).json({
        ok: false,
        hhaConnection:
          result.response.httpStatus === 401 || result.response.httpStatus === 403
            ? "auth_failure"
            : "operation_failure",
        operation: "GetCollectionStatus",
        correlationId: result.response.correlationId,
        httpStatus: result.response.httpStatus,
        applicationStatus: result.response.status ?? "unknown",
        errorKind: result.response.error?.kind ?? "unknown",
        ...(result.response.error?.id !== undefined
          ? { errorId: result.response.error.id }
          : {}),
      });
      return;
    }

    logger.info("Unhandled Primetime API route", {
      method: request.method,
      path,
      uid: principal.uid,
    });

    response.status(404).json({ error: "not_found" });
  },
);
