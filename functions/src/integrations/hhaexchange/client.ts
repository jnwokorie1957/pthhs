import { HhaNotSubmittedError } from "./dispatch.js";
import { randomUUID } from "node:crypto";
import { vendorContractBlocked } from "./contractGates.js";
import { logger } from "firebase-functions";
import type { HhaCredentials } from "./config.js";
import {
  extractElementBodies,
  extractElementText,
  parseHhaSoapResponse,
  type HhaNormalizedError,
  type HhaParsedSoapResponse,
} from "./parser.js";

const HHA_NAMESPACE = "https://www.hhaexchange.com/apis/hhaws.integration";
const DEFAULT_MAX_ATTEMPTS = 3;
const REQUEST_TIMEOUT_MS = 20_000;
const MAX_RETRY_DELAY_MS = 15_000;
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;
export async function boundedSoapText(response: Response, maximumBytes = MAX_RESPONSE_BYTES): Promise<string> {
  const length = response.headers.get("content-length");
  if (length && /^\d+$/.test(length) && Number(length) > maximumBytes) {
    await response.body?.cancel(); throw new Error("hha_response_size_limit");
  }
  if (!response.body) return "";
  const reader = response.body.getReader(), decoder = new TextDecoder(), chunks: string[] = []; let bytes = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      bytes += value.byteLength;
      if (bytes > maximumBytes) { await reader.cancel(); throw new Error("hha_response_size_limit"); }
      chunks.push(decoder.decode(value, { stream: true }));
    }
    chunks.push(decoder.decode()); return chunks.join("");
  } finally { reader.releaseLock(); }
}
// Reviewed reads only. Unknown operations and mutations must never be blindly
// retried: a timeout can mean the remote change already happened.
const RETRY_SAFE_READS = new Set([
  "GetCollectionStatus", "GetVisitChangesV5", "GetScheduleInfo",
  "GetCaregiverChangesV4", "GetPatientChangesV4", "GetPatientAuthorizationChanges",
  "GetPatientAuthorizationInfo", "GetCaregiverPermanentWeekAvailability",
  "GetCaregiverSpecialAvailability", "GetBillingServiceCodes",
]);

export interface HhaRawResponse {
  operation: string;
  httpStatus: number;
  ok: boolean;
  xml: string;
  retryAfter?: string;
}

export interface HhaCallResponse extends HhaParsedSoapResponse {
  correlationId: string;
  attempts: number;
  durationMs: number;
  retryable: boolean;
  outcome?: "unknown";
}

export interface CollectionStatusReference {
  id: number;
  value?: string;
  active?: string;
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function buildAuthenticationXml(credentials: HhaCredentials): string {
  return [
    "<Authentication>",
    "<AppName>" + escapeXml(credentials.appName) + "</AppName>",
    "<AppSecret>" + escapeXml(credentials.appSecret) + "</AppSecret>",
    "<AppKey>" + escapeXml(credentials.appKey) + "</AppKey>",
    "</Authentication>",
  ].join("");
}

function retryAfterMs(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  if (/^\d+(?:\.\d+)?$/.test(trimmed)) {
    return Math.ceil(Number(trimmed) * 1000);
  }

  const duration = trimmed.match(/^(\d{1,2}):(\d{2}):(\d{2})$/);
  if (duration) {
    const hours = Number(duration[1]);
    const minutes = Number(duration[2]);
    const seconds = Number(duration[3]);
    return ((hours * 60 + minutes) * 60 + seconds) * 1000;
  }

  const date = Date.parse(trimmed);
  if (Number.isFinite(date)) {
    return Math.max(date - Date.now(), 0);
  }

  return undefined;
}

function exponentialBackoffMs(attempt: number): number {
  return Math.min(500 * 2 ** Math.max(attempt - 1, 0), MAX_RETRY_DELAY_MS);
}

function shouldRetry(parsed: HhaParsedSoapResponse): boolean {
  return (
    parsed.retryAfter !== undefined ||
    parsed.httpStatus === 408 ||
    parsed.httpStatus === 429 ||
    parsed.httpStatus >= 500
  );
}

function transportFailure(
  operation: string,
  correlationId: string,
  attempts: number,
  durationMs: number,
): HhaCallResponse {
  const error: HhaNormalizedError = {
    kind: "transport",
    message: "HHA request failed before a valid SOAP response was received.",
  };

  return {
    operation,
    httpStatus: 0,
    transportOk: false,
    ok: false,
    correlationId,
    attempts,
    durationMs,
    retryable: true,
    error,
  };
}

function logCall(response: HhaCallResponse): void {
  logger.info("HHA SOAP request completed", {
    operation: response.operation,
    correlationId: response.correlationId,
    attemptCount: response.attempts,
    durationMs: response.durationMs,
    httpStatus: response.httpStatus,
    applicationStatus: response.status ?? "unknown",
    ok: response.ok,
    retryable: response.retryable,
    errorKind: response.error?.kind ?? null,
    errorId: response.error?.id ?? null,
  });
}

function parseCollectionStatuses(resultXml: string): CollectionStatusReference[] {
  const rows = extractElementBodies(resultXml, "CollectionStatus");
  const parsed: CollectionStatusReference[] = [];

  for (const row of rows) {
    const idText = extractElementText(row, "CollectionStatusID");
    if (!idText || !/^\d+$/.test(idText)) {
      continue;
    }

    const id = Number.parseInt(idText, 10);
    const value = extractElementText(row, "CollectionStatusValue");
    const active = extractElementText(row, "Active");

    parsed.push({
      id,
      ...(value ? { value } : {}),
      ...(active ? { active } : {}),
    });
  }

  return parsed;
}

export interface HhaRequestBudget {
  beforeRequest(): Promise<void>;
  defer(seconds: number): Promise<void>;
}
class BackoffPersistenceError extends Error {}

export class HhaSoapClient {
  constructor(
    private readonly baseUrl: string,
    private readonly credentials: HhaCredentials,
    private readonly budget?: HhaRequestBudget,
  ) {}

  private async persistBackoff(value: string | undefined): Promise<void> {
    const delay = retryAfterMs(value);
    if (delay === undefined || delay <= 0 || !this.budget) return;
    try {
      if (!Number.isFinite(delay)) throw new Error("invalid_vendor_backoff");
      await this.budget.defer(Math.ceil(delay / 1000));
    } catch { throw new BackoffPersistenceError("vendor_backoff_persistence_failed"); }
  }

  buildEnvelope(operation: string, operationBodyXml = ""): string {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(operation)) {
      throw new Error("Invalid HHA operation name");
    }

    return [
      '<?xml version="1.0" encoding="utf-8"?>',
      '<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ',
      'xmlns:xsd="http://www.w3.org/2001/XMLSchema" ',
      'xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">',
      "<soap:Body>",
      "<" + operation + ' xmlns="' + HHA_NAMESPACE + '">',
      buildAuthenticationXml(this.credentials),
      operationBodyXml,
      "</" + operation + ">",
      "</soap:Body>",
      "</soap:Envelope>",
    ].join("");
  }

  private async callRaw(
    operation: string,
    operationBodyXml = "",
  ): Promise<HhaRawResponse> {
    const response = await fetch(this.baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: '"' + HHA_NAMESPACE + "/" + operation + '"',
      },
      body: this.buildEnvelope(operation, operationBodyXml),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    const retryAfter = response.headers.get("retry-after") ?? undefined;
    try { await this.persistBackoff(retryAfter); } catch (error) { await response.body?.cancel(); throw error; }
    const xml = await boundedSoapText(response);

    return {
      operation,
      httpStatus: response.status,
      ok: response.ok,
      xml,
      ...(retryAfter ? { retryAfter } : {}),
    };
  }

  async call(
    operation: string,
    operationBodyXml = "",
    maxAttempts = DEFAULT_MAX_ATTEMPTS,
  ): Promise<HhaCallResponse> {
    if (vendorContractBlocked(operation)) throw new Error("vendor_contract_clarification_required");
    if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > DEFAULT_MAX_ATTEMPTS) {
      throw new Error("invalid_hha_attempt_limit");
    }
    const retrySafe = RETRY_SAFE_READS.has(operation);
    if (!retrySafe) maxAttempts = 1;
    const correlationId = randomUUID();
    const startedAt = Date.now();

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      // A denied budget must never be interpreted as a retryable transport failure.
      try { await this.budget?.beforeRequest(); } catch (error) {
        if (!retrySafe) throw new HhaNotSubmittedError();
        throw error;
      }
      try {
        const raw = await this.callRaw(operation, operationBodyXml);
        const parsed = parseHhaSoapResponse(
          operation,
          raw.httpStatus,
          raw.ok,
          raw.xml,
          raw.retryAfter,
        );
        if (parsed.retryAfter !== raw.retryAfter) await this.persistBackoff(parsed.retryAfter);
        const retryable = retrySafe && shouldRetry(parsed);
        const normalized: HhaCallResponse = {
          ...parsed,
          correlationId,
          attempts: attempt,
          durationMs: Date.now() - startedAt,
          retryable,
          ...(!retrySafe && !parsed.ok ? { outcome: "unknown" as const } : {}),
        };

        logCall(normalized);

        if (normalized.ok || !retryable || attempt >= maxAttempts) {
          return normalized;
        }

        const delay =
          retryAfterMs(normalized.retryAfter) ?? exponentialBackoffMs(attempt);
        // Defer to the next explicitly scheduled run if vendor backoff cannot
        // fit the request budget. Never shorten Retry-After to retry early.
        if (delay > MAX_RETRY_DELAY_MS || Date.now() - startedAt + delay + REQUEST_TIMEOUT_MS > 50_000) {
          return normalized;
        }
        await new Promise((resolve) => setTimeout(resolve, delay));
      } catch (error) {
        const normalized = transportFailure(
          operation,
          correlationId,
          attempt,
          Date.now() - startedAt,
        );
        if (!retrySafe) {
          normalized.retryable = false;
          normalized.outcome = "unknown";
        }

        logger.warn("HHA SOAP transport failure", {
          operation,
          correlationId,
          attempt,
          durationMs: normalized.durationMs,
          errorName: error instanceof Error ? error.name : "unknown",
        });

        if (error instanceof BackoffPersistenceError) normalized.retryable = false;
        if (error instanceof BackoffPersistenceError || attempt >= maxAttempts) {
          return normalized;
        }

        await new Promise((resolve) =>
          setTimeout(resolve, exponentialBackoffMs(attempt)),
        );
      }
    }

    return transportFailure(
      operation,
      correlationId,
      maxAttempts,
      Date.now() - startedAt,
    );
  }

  async getCollectionStatuses(
    status = "Active",
  ): Promise<{
    response: HhaCallResponse;
    statuses: CollectionStatusReference[];
  }> {
    const body = status
      ? "<Status>" + escapeXml(status) + "</Status>"
      : "";
    const response = await this.call("GetCollectionStatus", body);
    const statuses =
      response.ok && response.resultXml
        ? parseCollectionStatuses(response.resultXml)
        : [];

    return { response, statuses };
  }
}
