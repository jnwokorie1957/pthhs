import { HhaSoapClient, type HhaCallResponse } from "./client.js";
import {
  extractElementBodies,
  extractElementBody,
  extractElementText,
} from "./parser.js";

export interface HhaRawRecord {
  xml: string;
}

export interface HhaPagedRecords extends HhaCallResponse {
  currentPage: number;
  totalPages: number;
  totalRecords: number;
  records: HhaRawRecord[];
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function positiveInteger(value: number, field: string): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(field + " must be a positive integer.");
  }
  return value;
}

function integer(value: string | undefined, fallback: number): number {
  return value && /^\d+$/.test(value) ? Number.parseInt(value, 10) : fallback;
}

async function pagedChangeCall(
  client: HhaSoapClient,
  operation: "GetCaregiverChangesV4" | "GetPatientChangesV4",
  recordElement: "GetCaregiverChangesV4Info" | "GetPatientChangesV4Info",
  officeId: number,
  modifiedAfter: string,
  pageNumber = 1,
): Promise<HhaPagedRecords> {
  positiveInteger(officeId, "OfficeID");
  positiveInteger(pageNumber, "PageNumber");
  if (!modifiedAfter.trim()) {
    throw new Error(operation + " requires an explicit ModifiedAfter boundary.");
  }

  const body = [
    "<OfficeID>", String(officeId), "</OfficeID>",
    "<ModifiedAfter>", escapeXml(modifiedAfter), "</ModifiedAfter>",
    "<PageNumber>", String(pageNumber), "</PageNumber>",
  ].join("");

  const response = await client.call(operation, body);
  if (!response.ok || !response.resultXml) {
    return {
      ...response,
      currentPage: pageNumber,
      totalPages: pageNumber,
      totalRecords: 0,
      records: [],
    };
  }

  const pagination = extractElementBody(response.resultXml, "Pagination") ?? "";
  const currentPage = integer(extractElementText(pagination, "CurrentPage"), pageNumber);
  const totalPages = integer(extractElementText(pagination, "TotalPages"), currentPage);
  const totalRecords = integer(extractElementText(pagination, "TotalRecords"), 0);

  return {
    ...response,
    currentPage,
    totalPages,
    totalRecords,
    records: extractElementBodies(response.resultXml, recordElement).map((xml) => ({ xml })),
  };
}

export function getCaregiverChangesV4(
  client: HhaSoapClient,
  officeId: number,
  modifiedAfter: string,
  pageNumber = 1,
): Promise<HhaPagedRecords> {
  return pagedChangeCall(
    client,
    "GetCaregiverChangesV4",
    "GetCaregiverChangesV4Info",
    officeId,
    modifiedAfter,
    pageNumber,
  );
}

export function getPatientChangesV4(
  client: HhaSoapClient,
  officeId: number,
  modifiedAfter: string,
  pageNumber = 1,
): Promise<HhaPagedRecords> {
  return pagedChangeCall(
    client,
    "GetPatientChangesV4",
    "GetPatientChangesV4Info",
    officeId,
    modifiedAfter,
    pageNumber,
  );
}

export async function getPatientAuthorizationChanges(
  client: HhaSoapClient,
  officeId: number,
  modifiedAfter: string,
): Promise<{ response: HhaCallResponse; records: HhaRawRecord[] }> {
  positiveInteger(officeId, "OfficeID");
  if (!modifiedAfter.trim()) {
    throw new Error("GetPatientAuthorizationChanges requires ModifiedAfter.");
  }

  const response = await client.call(
    "GetPatientAuthorizationChanges",
    [
      "<OfficeID>", String(officeId), "</OfficeID>",
      "<ModifiedAfter>", escapeXml(modifiedAfter), "</ModifiedAfter>",
    ].join(""),
  );

  return {
    response,
    records:
      response.ok && response.resultXml
        ? extractElementBodies(response.resultXml, "GetPatientAuthorizationChangesInfo").map((xml) => ({ xml }))
        : [],
  };
}

export async function getPatientAuthorizationInfo(
  client: HhaSoapClient,
  patientId: number,
  authorizationId: number,
): Promise<{ response: HhaCallResponse; record: HhaRawRecord | null }> {
  positiveInteger(patientId, "PatientID");
  positiveInteger(authorizationId, "AuthorizationID");

  const response = await client.call(
    "GetPatientAuthorizationInfo",
    "<AuthorizationInfo><PatientID>" +
      String(patientId) +
      "</PatientID><AuthorizationID>" +
      String(authorizationId) +
      "</AuthorizationID></AuthorizationInfo>",
  );

  const xml =
    response.ok && response.resultXml
      ? extractElementBody(response.resultXml, "AuthorizationInfo")
      : undefined;
  return { response, record: xml ? { xml } : null };
}

export async function getCaregiverPermanentWeekAvailability(
  client: HhaSoapClient,
  caregiverId: number,
): Promise<{ response: HhaCallResponse; records: HhaRawRecord[] }> {
  positiveInteger(caregiverId, "CaregiverID");
  const response = await client.call(
    "GetCaregiverPermanentWeekAvailability",
    "<CaregiverID>" + String(caregiverId) + "</CaregiverID>",
  );

  return {
    response,
    records:
      response.ok && response.resultXml
        ? extractElementBodies(response.resultXml, "PermanentWeekAvailabilityInfo").map((xml) => ({ xml }))
        : [],
  };
}

export async function getCaregiverSpecialAvailability(
  client: HhaSoapClient,
  caregiverId: number,
): Promise<{ response: HhaCallResponse; records: HhaRawRecord[] }> {
  positiveInteger(caregiverId, "CaregiverID");
  const response = await client.call(
    "GetCaregiverSpecialAvailability",
    "<CaregiverID>" + String(caregiverId) + "</CaregiverID>",
  );

  return {
    response,
    records:
      response.ok && response.resultXml
        ? extractElementBodies(response.resultXml, "SpecialAvailabilityInfo").map((xml) => ({ xml }))
        : [],
  };
}

export async function getBillingServiceCodes(
  client: HhaSoapClient,
  contractId: number,
): Promise<{ response: HhaCallResponse; records: HhaRawRecord[] }> {
  positiveInteger(contractId, "ContractID");
  const response = await client.call(
    "GetBillingServiceCodes",
    "<BillingServiceCodeInfo><ContractID>" +
      String(contractId) +
      "</ContractID></BillingServiceCodeInfo>",
  );

  return {
    response,
    records:
      response.ok && response.resultXml
        ? extractElementBodies(response.resultXml, "ServiceCode").map((xml) => ({ xml }))
        : [],
  };
}
