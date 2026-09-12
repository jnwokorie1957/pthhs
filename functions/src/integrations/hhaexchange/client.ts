import type { HhaCredentials } from "./config.js";

const HHA_NAMESPACE = "https://www.hhaexchange.com/apis/hhaws.integration";

export interface HhaRawResponse {
  operation: string;
  httpStatus: number;
  ok: boolean;
  xml: string;
  retryAfter?: string;
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
    `<AppName>${escapeXml(credentials.appName)}</AppName>`,
    `<AppSecret>${escapeXml(credentials.appSecret)}</AppSecret>`,
    `<AppKey>${escapeXml(credentials.appKey)}</AppKey>`,
    "</Authentication>",
  ].join("");
}

export class HhaSoapClient {
  constructor(
    private readonly baseUrl: string,
    private readonly credentials: HhaCredentials,
  ) {}

  buildEnvelope(operation: string, operationBodyXml = ""): string {
    return [
      '<?xml version="1.0" encoding="utf-8"?>',
      '<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ',
      'xmlns:xsd="http://www.w3.org/2001/XMLSchema" ',
      'xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">',
      "<soap:Body>",
      `<${operation} xmlns="${HHA_NAMESPACE}">`,
      buildAuthenticationXml(this.credentials),
      operationBodyXml,
      `</${operation}>`,
      "</soap:Body>",
      "</soap:Envelope>",
    ].join("");
  }

  /**
   * Low-level SOAP transport. Do not call from frontend code.
   * Structured response parsing/error normalization is intentionally the next checkpoint.
   */
  async callRaw(operation: string, operationBodyXml = ""): Promise<HhaRawResponse> {
    const response = await fetch(this.baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: `"${HHA_NAMESPACE}/${operation}"`,
      },
      body: this.buildEnvelope(operation, operationBodyXml),
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
}
