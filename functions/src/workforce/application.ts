import { WorkforceError } from "./policy.js";
// Generic versioned draft framework. Packet-specific intake, private document
// routes and release controls live in packet.ts, intake.ts and http.ts.
export interface Packet {
  version: string; approved: boolean;
  fields: { id: string; label: string; required: boolean; maxLength: number }[];
}
export interface Application {
  id: string; uid: string; packetVersion: string; revision: number;
  state: "draft" | "submitted"; answers: Record<string, string>;
  submittedAt: string | null;
}
export function saveApplication(uid: string, previous: Application | null, revision: number, packet: Packet, answers: Record<string, string>, employment: "applicant" | "active"): Application {
  if (!packet.approved || !packet.fields.length) throw new WorkforceError(409, "approved_packet_required");
  if (employment === "active") throw new WorkforceError(409, "active_employee_application_not_required");
  if (previous && previous.uid !== uid) throw new WorkforceError(403, "application_forbidden");
  if (previous?.state === "submitted") throw new WorkforceError(409, "application_already_submitted");
  if (revision !== (previous?.revision ?? 0)) throw new WorkforceError(409, "revision_conflict");
  if (previous && previous.packetVersion !== packet.version) throw new WorkforceError(409, "packet_migration_review_required");
  if (!answers || typeof answers !== "object" || Array.isArray(answers)) throw new WorkforceError(400, "invalid_answers");
  for (const [id, value] of Object.entries(answers)) {
    const field = packet.fields.find(f => f.id === id);
    if (!field || typeof value !== "string" || value.length > field.maxLength) throw new WorkforceError(400, "invalid_answers");
  }
  return { id: previous?.id ?? uid, uid, packetVersion: packet.version, revision: revision + 1, state: "draft", answers: { ...answers }, submittedAt: null };
}
export function submitApplication(uid: string, previous: Application, packet: Packet, now: string): Application {
  if (previous.uid !== uid) throw new WorkforceError(403, "application_forbidden");
  if (!packet.approved || packet.version !== previous.packetVersion) throw new WorkforceError(409, "approved_packet_required");
  if (previous.state !== "draft") throw new WorkforceError(409, "application_already_submitted");
  if (packet.fields.some(f => f.required && !previous.answers[f.id]?.trim())) throw new WorkforceError(400, "application_incomplete");
  return { ...previous, answers: { ...previous.answers }, state: "submitted", revision: previous.revision + 1, submittedAt: now };
}
