export type HhaErrorKind =
  | "application"
  | "soap_fault"
  | "protocol"
  | "transport";

export interface HhaNormalizedError {
  kind: HhaErrorKind;
  id?: number;
  code?: string;
  message?: string;
  retryAfter?: string;
  providedPageNumber?: string;
  details?: string;
}

export interface HhaParsedSoapResponse {
  operation: string;
  httpStatus: number;
  transportOk: boolean;
  ok: boolean;
  status?: string;
  retryAfter?: string;
  resultXml?: string;
  error?: HhaNormalizedError;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^$()|[\]\\]/g, "\\$&");
}

function qualifiedName(localName: string): string {
  return "(?:[A-Za-z_][\\w.-]*:)?" + escapeRegExp(localName);
}

function decodeXmlEntities(value: string): string {
  const named: Record<string, string> = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
  };

  return value.replace(
    /&(?:#x([0-9a-f]+)|#([0-9]+)|(amp|lt|gt|quot|apos));/gi,
    (match, hex: string | undefined, decimal: string | undefined, entity: string | undefined) => {
      if (hex) {
        return String.fromCodePoint(Number.parseInt(hex, 16));
      }
      if (decimal) {
        return String.fromCodePoint(Number.parseInt(decimal, 10));
      }
      if (entity) {
        return named[entity.toLowerCase()] ?? match;
      }
      return match;
    },
  );
}

function normalizeText(value: string): string {
  const trimmed = value.trim();
  const cdata = trimmed.match(/^<!\[CDATA\[([\s\S]*)\]\]>$/);
  const unwrapped = cdata?.[1] ?? trimmed;
  return decodeXmlEntities(unwrapped.replace(/<[^>]+>/g, "").trim());
}

function openingTag(xml: string, localName: string): string | undefined {
  const expression = new RegExp("<" + qualifiedName(localName) + "\\b[^>]*>", "i");
  return xml.match(expression)?.[0];
}

function attributeValue(tag: string | undefined, name: string): string | undefined {
  if (!tag) {
    return undefined;
  }

  const expression = new RegExp(
    "\\b" + escapeRegExp(name) + "\\s*=\\s*([\"'])((?:.(?!\\1))*.?)\\1",
    "i",
  );
  const match = tag.match(expression);
  return match?.[2] ? decodeXmlEntities(match[2]) : undefined;
}

export function extractElementBody(
  xml: string,
  localName: string,
): string | undefined {
  const qname = qualifiedName(localName);
  const expression = new RegExp(
    "<" + qname + "\\b[^>]*>([\\s\\S]*?)<\\/" + qname + "\\s*>",
    "i",
  );
  return xml.match(expression)?.[1];
}

export function extractElementBodies(
  xml: string,
  localName: string,
): string[] {
  const qname = qualifiedName(localName);
  const expression = new RegExp(
    "<" + qname + "\\b[^>]*>([\\s\\S]*?)<\\/" + qname + "\\s*>",
    "gi",
  );

  const bodies: string[] = [];
  for (const match of xml.matchAll(expression)) {
    if (typeof match[1] === "string") {
      bodies.push(match[1]);
    }
  }
  return bodies;
}

export function extractElementText(
  xml: string,
  localName: string,
): string | undefined {
  const body = extractElementBody(xml, localName);
  return body === undefined ? undefined : normalizeText(body);
}

function integerValue(value: string | undefined): number | undefined {
  if (value === undefined || !/^-?\d+$/.test(value.trim())) {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}

function protocolFailure(
  operation: string,
  httpStatus: number,
  transportOk: boolean,
  retryAfter?: string,
): HhaParsedSoapResponse {
  return {
    operation,
    httpStatus,
    transportOk,
    ok: false,
    ...(retryAfter ? { retryAfter } : {}),
    error: {
      kind: "protocol",
      message: "HHA SOAP response did not match the expected operation envelope.",
    },
  };
}

export function parseHhaSoapResponse(
  operation: string,
  httpStatus: number,
  transportOk: boolean,
  xml: string,
  httpRetryAfter?: string,
): HhaParsedSoapResponse {
  const bodyXml = extractElementBody(xml, "Body");
  if (bodyXml === undefined) {
    return protocolFailure(operation, httpStatus, transportOk, httpRetryAfter);
  }

  const faultXml = extractElementBody(bodyXml, "Fault");
  if (faultXml !== undefined) {
    const code = extractElementText(faultXml, "faultcode");
    const message = extractElementText(faultXml, "faultstring");
    return {
      operation,
      httpStatus,
      transportOk,
      ok: false,
      ...(httpRetryAfter ? { retryAfter: httpRetryAfter } : {}),
      error: {
        kind: "soap_fault",
        ...(code ? { code } : {}),
        ...(message ? { message } : {}),
        ...(httpRetryAfter ? { retryAfter: httpRetryAfter } : {}),
      },
    };
  }

  const responseXml = extractElementBody(bodyXml, operation + "Response");
  if (responseXml === undefined) {
    return protocolFailure(operation, httpStatus, transportOk, httpRetryAfter);
  }

  const resultXml = extractElementBody(responseXml, operation + "Result");
  if (resultXml === undefined) {
    return protocolFailure(operation, httpStatus, transportOk, httpRetryAfter);
  }

  const resultTag = openingTag(resultXml, "Result");
  const status = attributeValue(resultTag, "Status");
  const errorInfoXml = extractElementBody(resultXml, "ErrorInfo");
  const detailsXml = extractElementBody(resultXml, "Details");

  const errorId = integerValue(
    errorInfoXml === undefined ? undefined : extractElementText(errorInfoXml, "ErrorID"),
  );
  const errorMessage =
    errorInfoXml === undefined ? undefined : extractElementText(errorInfoXml, "ErrorMessage");
  const applicationRetryAfter =
    errorInfoXml === undefined ? undefined : extractElementText(errorInfoXml, "RetryAfter");
  const retryAfter = applicationRetryAfter ?? httpRetryAfter;
  const providedPageNumber =
    detailsXml === undefined ? undefined : extractElementText(detailsXml, "ProvidedPageNumber");
  const details =
    detailsXml === undefined ? undefined : extractElementText(detailsXml, "ErrorDetails");

  const successStatus =
    status === undefined || /^(success|succeeded|ok)$/i.test(status.trim());
  const applicationFailed = !successStatus || errorInfoXml !== undefined;

  return {
    operation,
    httpStatus,
    transportOk,
    ok: transportOk && !applicationFailed,
    ...(status ? { status } : {}),
    ...(retryAfter ? { retryAfter } : {}),
    resultXml,
    ...(applicationFailed
      ? {
          error: {
            kind: "application" as const,
            ...(errorId !== undefined ? { id: errorId } : {}),
            ...(errorMessage ? { message: errorMessage } : {}),
            ...(retryAfter ? { retryAfter } : {}),
            ...(providedPageNumber ? { providedPageNumber } : {}),
            ...(details ? { details } : {}),
          },
        }
      : {}),
  };
}
