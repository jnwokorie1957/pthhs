import { HhaSoapClient, type HhaCallResponse } from "./client.js";
import { extractElementBody, extractElementText } from "./parser.js";

export interface HhaScheduleInfo {
  id: string;
  patientId?: string;
  caregiverId?: string;
  scheduledStart?: string;
  scheduledEnd?: string;
  lastModifiedDate?: string;
  visitType?: string;
  xml: string;
}

export async function getScheduleInfo(
  client: HhaSoapClient,
  scheduleId: string,
): Promise<{ response: HhaCallResponse; schedule: HhaScheduleInfo | null }> {
  if (!/^\d+$/.test(scheduleId)) {
    throw new Error("HHA schedule ID must be numeric.");
  }

  const response = await client.call(
    "GetScheduleInfo",
    "<ScheduleInfo><ID>" + scheduleId + "</ID></ScheduleInfo>",
  );

  if (!response.ok || !response.resultXml) {
    return { response, schedule: null };
  }

  const xml = extractElementBody(response.resultXml, "ScheduleInfo");
  if (xml === undefined) {
    return { response, schedule: null };
  }

  const id = extractElementText(xml, "ID");
  if (!id) {
    throw new Error("HHA GetScheduleInfo response is missing ScheduleInfo/ID.");
  }

  const patientXml = extractElementBody(xml, "Patient");
  const caregiverXml = extractElementBody(xml, "Caregiver");
  const patientId = patientXml ? extractElementText(patientXml, "ID") : undefined;
  const caregiverId = caregiverXml ? extractElementText(caregiverXml, "ID") : undefined;
  const scheduledStart = extractElementText(xml, "ScheduleStartTime");
  const scheduledEnd = extractElementText(xml, "ScheduleEndTime");
  const lastModifiedDate = extractElementText(xml, "LastModifiedDate");
  const visitType = extractElementText(xml, "VisitType");

  return {
    response,
    schedule: {
      id,
      ...(patientId ? { patientId } : {}),
      ...(caregiverId ? { caregiverId } : {}),
      ...(scheduledStart ? { scheduledStart } : {}),
      ...(scheduledEnd ? { scheduledEnd } : {}),
      ...(lastModifiedDate ? { lastModifiedDate } : {}),
      ...(visitType ? { visitType } : {}),
      xml,
    },
  };
}
