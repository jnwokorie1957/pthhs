import { logger } from "firebase-functions";
import { onRequest } from "firebase-functions/v2/https";

const API_PREFIX = "/primetime/api";

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
    response.set("Cache-Control", "no-store");

    if (!path.startsWith(API_PREFIX)) {
      response.status(404).json({ error: "not_found" });
      return;
    }

    if (request.method === "GET" && path === `${API_PREFIX}/status`) {
      response.status(200).json({
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

    response.status(404).json({ error: "not_found" });
  },
);
