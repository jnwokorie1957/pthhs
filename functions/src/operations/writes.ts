import type { HhaSoapClient } from "../integrations/hhaexchange/client.js";
import { extractElementText } from "../integrations/hhaexchange/parser.js";
import { identifier, WorkflowError } from "./reads.js";

export function rateDecimal(value: unknown): string {
  if (typeof value !== "string" || !/^\d{1,6}(?:\.\d{1,4})?$/.test(value)) throw new WorkflowError("invalid_source_rate_decimal");
  return value;
}
function sourceDate(value: unknown): string {
  if (typeof value !== "string" || !/^\d{4}-\d\d-\d\d$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) throw new WorkflowError("source_rate_date_mapping_required", 409);
  return value + "T00:00:00";
}
export function rateWriteRequest(before: Record<string, string | null>, hourlyRate: string): string {
  const id = identifier(before.CaregiverRateID), from = sourceDate(before.FromDate), to = sourceDate(before.ToDate);
  if (from > to || !["Active", "Inactive"].includes(before.Status ?? "")) throw new WorkflowError("invalid_source_rate_period_or_status", 409);
  const patient = before.PatientID === null ? '<PatientID xsi:nil="true"/>' : `<PatientID>${identifier(before.PatientID)}</PatientID>`;
  const visit = before.VisitRate === null ? '<VisitRate xsi:nil="true"/>' : `<VisitRate>${rateDecimal(before.VisitRate)}</VisitRate>`;
  // Preserve every other required source field. Never fill missing values with zero.
  return `<CaregiverRateInfo><CaregiverRateID>${id}</CaregiverRateID>${patient}<FromDate>${from}</FromDate><ToDate>${to}</ToDate><HourlyRate>${rateDecimal(hourlyRate)}</HourlyRate><DailyRate>${rateDecimal(before.DailyRate)}</DailyRate>${visit}<Status>${before.Status}</Status></CaregiverRateInfo>`;
}
export async function submitRate(client: Pick<HhaSoapClient, "call">, before: Record<string, string | null>, hourlyRate: string): Promise<"acknowledged" | "unknown"> {
  const body = rateWriteRequest(before, hourlyRate);
  const result = await client.call("UpdateCaregiverRate", body, 1);
  return result.ok && result.resultXml && extractElementText(result.resultXml, "CaregiverRateID") === before.CaregiverRateID && extractElementText(result.resultXml, "CaregiverID") === before.CaregiverID ? "acknowledged" : "unknown";
}
export function sameSourceFacts(left: Record<string, string | null>, right: Record<string, string | null>): boolean {
  const canonical = (row: Record<string, string | null>) => JSON.stringify(Object.keys(row).sort().map(key => [key, row[key]]));
  return canonical(left) === canonical(right);
}
export function sameDecimal(left: string | null | undefined, right: string): boolean {
  if (!left || !/^\d+(?:\.\d+)?$/.test(left)) return false;
  const canonical = (value: string) => { const [whole, fractional = ""] = value.split("."); return whole!.replace(/^0+(?=\d)/, "") + "." + fractional.replace(/0+$/, ""); };
  return canonical(left) === canonical(right);
}
