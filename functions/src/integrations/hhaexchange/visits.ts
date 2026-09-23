import {
  extractElementBodies,
  extractElementBody,
  extractElementText,
} from "./parser.js";
import { HhaSoapClient, type HhaCallResponse } from "./client.js";

export interface HhaVisitChangeRecord {
  sourceIdentifier?: string;
  visitId: string;
  lastModifiedDate?: string;
  xml: string;
}

export interface HhaVisitChangesPage {
  response: HhaCallResponse;
  currentPage: number;
  totalPages: number;
  totalRecords: number;
  records: HhaVisitChangeRecord[];
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function integer(value: string | undefined, fallback: number): number {
  if (!value || !/^\d+$/.test(value.trim())) return fallback;
  return Number.parseInt(value, 10);
}

export async function getVisitChangesV5(
  client: HhaSoapClient,
  modifiedAfter: string,
  pageNumber = 1,
): Promise<HhaVisitChangesPage> {
  if (!modifiedAfter.trim()) {
    throw new Error("GetVisitChangesV5 requires an explicit ModifiedAfter safety boundary.");
  }

  const body = [
    "<ModifiedAfter>",
    escapeXml(modifiedAfter),
    "</ModifiedAfter>",
    "<PageNumber>",
    String(pageNumber),
    "</PageNumber>",
  ].join("");

  const response = await client.call("GetVisitChangesV5", body);
  if (!response.ok || !response.resultXml) {
    return {
      response,
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

  const records = extractElementBodies(response.resultXml, "GetVisitChangesV5Info")
    .map((xml): HhaVisitChangeRecord | null => {
      const visitId = extractElementText(xml, "VisitID");
      if (!visitId) return null;
      const lastModifiedDate = extractElementText(xml, "LastModifiedDate");
      return {
        sourceIdentifier: visitId,
        visitId,
        ...(lastModifiedDate ? { lastModifiedDate } : {}),
        xml,
      };
    })
    .filter((record): record is HhaVisitChangeRecord => record !== null);

  return {
    response,
    currentPage,
    totalPages,
    totalRecords,
    records,
  };
}
