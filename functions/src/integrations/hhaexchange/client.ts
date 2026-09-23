import { randomUUID } from "node:crypto";
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
    return Math.min(Math.ceil(Number(trimmed) * 1000), MAX_RETRY_DELAY_MS);
  }

  const duration = trimmed.match(/^(\d{1,2}):(\d{2}):(\d{2})$/);
  if (duration) {
    const hours = Number(duration[1]);
    const minutes = Number(duration[2]);
    const seconds = Number(duration[3]);
    return Math.min(((hours * 60 + minutes) * 60 + seconds) * 1000, MAX_RETRY_DELAY_MS);
  }

  const date = Date.parse(trimmed);
  if (Number.isFinite(date)) {
    return Math.min(Math.max(date - Date.now(), 0), MAX_RETRY_DELAY_MS);
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

export class HhaSoapClient {
  constructor(
    private readonly baseUrl: string,
    private readonly credentials: HhaCredentials,
  ) {}

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

    const xml = await response.text();
    const retryAfter = response.headers.get("retry-after") ?? undefined;

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
    const correlationId = randomUUID();
    const startedAt = Date.now();

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const raw = await this.callRaw(operation, operationBodyXml);
        const parsed = parseHhaSoapResponse(
          operation,
          raw.httpStatus,
          raw.ok,
          raw.xml,
          raw.retryAfter,
        );
        const retryable = shouldRetry(parsed);
        const normalized: HhaCallResponse = {
          ...parsed,
          correlationId,
          attempts: attempt,
          durationMs: Date.now() - startedAt,
          retryable,
        };

        logCall(normalized);

        if (normalized.ok || !retryable || attempt >= maxAttempts) {
          return normalized;
        }

        const delay =
          retryAfterMs(normalized.retryAfter) ?? exponentialBackoffMs(attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      } catch (error) {
        const normalized = transportFailure(
          operation,
          correlationId,
          attempt,
          Date.now() - startedAt,
        );

        logger.warn("HHA SOAP transport failure", {
          operation,
          correlationId,
          attempt,
          durationMs: normalized.durationMs,
          errorName: error instanceof Error ? error.name : "unknown",
        });

        if (attempt >= maxAttempts) {
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
