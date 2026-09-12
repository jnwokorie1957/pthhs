import { onRequest } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";

const API_PREFIX = "/primetime/api";

function writeJson(
  response: Parameters<Parameters<typeof onRequest>[0]>[1],
  status: number,
  body: Record<string, unknown>,
): void {
  response.status(status).set("Cache-Control", "no-store").json(body);
}

/**
 * Backend entry point for the internal management layer.
 *
 * Intended public-facing namespace through Firebase Hosting:
 *   /primetime/api/*
 *
 * IMPORTANT: No HHA credential-bearing endpoint should be added until the
 * admin authentication/authorization gate is wired and verified.
 */
export const primetimeApi = onRequest(
  {
    region: "us-central1",
    timeoutSeconds: 60,
    memory: "256MiB",
    maxInstances: 10,
  },
  (request, response) => {
    const path = request.path;

    if (!path.startsWith(API_PREFIX)) {
      writeJson(response, 404, { error: "not_found" });
      return;
    }

    if (request.method === "GET" && path === `${API_PREFIX}/status`) {
      writeJson(response, 200, {
        ok: true,
        service: "primetime-admin-api",
        stage: "scaffolded",
        hhaConnection: "not_tested",
      });
      return;
    }

    logger.info("Unhandled Primetime API route", {
      method: request.method,
      path,
    });

    writeJson(response, 404, { error: "not_found" });
  },
);
