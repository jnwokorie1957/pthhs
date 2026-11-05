import { createHash } from "node:crypto";
import { saveApplication, submitApplication, type Application } from "./application.js";
import { intakePacket, PACKET_SHA256, PACKET_VERSION } from "./packet.js";
import { WorkforceError } from "./policy.js";
import { readings } from "./readings.js";
import { chicagoDate } from "./dates.js";

export interface Intake extends Application {
  office: string; sourceSha256: string; updatedAt: string;
  signature: { name: string; signedAt: string; uid: string; document: string; documentRevision: string; sourceSha256: string; answersSha256: string; electronicConsent: true } | null;
  roleAcknowledgment?: { uid: string; name: string; readAt: string; revision: string; contentSha256: string; sourcePages: number[]; questionsForHR: boolean };
  policyAcknowledgments?: { page: number; sourcePages: number[]; read: true; response: string|null; sourceSha256: string; uid: string; signedAt: string }[];
}
export function intakeAnswers(input: unknown): Record<string, string> {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new WorkforceError(400, "invalid_answers");
  const result: Record<string, string> = {};
  for (const [id, value] of Object.entries(input)) {
    const field = intakePacket.fields.find(f => f.id === id);
    if (!field || typeof value !== "string" || value.length > field.maxLength || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value)) throw new WorkforceError(400, "invalid_answers");
    const answer = value.trim();
    if (answer && (field.type === "choice" && !field.options.includes(answer)
      || field.type === "ssn" && !/^\d{3}-?\d{2}-?\d{4}$/.test(answer)
      || field.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(answer)
      || field.type === "date" && (!/^\d{4}-\d{2}-\d{2}$/.test(answer) || Number.isNaN(Date.parse(answer)) || new Date(answer).toISOString().slice(0, 10) !== answer))) throw new WorkforceError(400, "invalid_answers");
    result[id] = answer;
  }
  return result;
}
export function saveIntake(uid: string, previous: Intake | null, revision: number, answers: unknown, office: string, activeEmployee: boolean, now: string): Intake {
  const clean = intakeAnswers(answers);
  if (!previous && !clean.applicationDate) clean.applicationDate = chicagoDate(now);
  const next = saveApplication(uid, previous, revision, { ...intakePacket, approved: true }, clean, activeEmployee ? "active" : "applicant");
  return { ...next, office: previous?.office ?? office, sourceSha256: PACKET_SHA256, updatedAt: now, signature: null };
}
export function submitIntake(uid: string, previous: Intake, revision: number, signature: unknown, now: string): Intake {
  if (revision !== previous.revision) throw new WorkforceError(409, "revision_conflict");
  if (previous.packetVersion !== PACKET_VERSION || previous.sourceSha256 !== PACKET_SHA256) throw new WorkforceError(409, "packet_migration_review_required");
  const input = signature as { name?: unknown; electronicConsent?: unknown; documentRead?: unknown };
  if (!input || typeof input.name !== "string" || input.name.length > 250 || input.electronicConsent !== true || input.documentRead !== true
    || input.name.trim().replace(/\s+/g, " ").toLowerCase() !== [previous.answers.firstName, previous.answers.lastName].filter(Boolean).join(" ").trim().replace(/\s+/g, " ").toLowerCase()) throw new WorkforceError(400, "signature_required");
  if (previous.answers.conviction === "Yes" && !previous.answers.convictionDetails?.trim()) throw new WorkforceError(400, "application_incomplete");
  const next = submitApplication(uid, previous, { ...intakePacket, approved: true }, now);
  const sorted = Object.fromEntries(Object.entries(next.answers).sort(([a], [b]) => a.localeCompare(b)));
  return { ...previous, ...next, updatedAt: now, policyAcknowledgments: readings.map(reading => ({
    page: reading.page, sourcePages: reading.sourcePages, read: true, response: previous.answers[`terms_page_${reading.page}`] || null, sourceSha256: PACKET_SHA256, uid, signedAt: now
  })), roleAcknowledgment: {
    uid, name: input.name.trim(), readAt: now, revision: intakePacket.jobDescription.revision,
    contentSha256: intakePacket.jobDescriptionSha256, sourcePages: intakePacket.jobDescription.sourcePages, questionsForHR: !!previous.answers.jobDescriptionQuestions?.trim()
  }, signature: {
    name: input.name.trim(), signedAt: now, uid, document: intakePacket.referenceRelease.id,
    documentRevision: intakePacket.referenceRelease.revision, sourceSha256: PACKET_SHA256,
    answersSha256: createHash("sha256").update(JSON.stringify(sorted)).digest("hex"), electronicConsent: true
  } };
}
