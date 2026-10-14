import { createHash } from "node:crypto";
import { WorkflowError, identifier } from "../operations/reads.js";
import { evidenceIsFresh, normalizedInstant, sameEvidenceScope, validEvidenceScope, type EvidenceScope, type NormalizedInstant, type NormalizedVisitEvidence } from "./evidence.js";

/** Provisioned with the protected source contract after receipt semantics are
 * reviewed. This is never accepted from dashboard policy or HTTP input. */
export interface VerificationReceiptAcceptance {
  accepted: boolean;
  version: string;
  sourceVersion: string;
  reviewReference: string;
  receiptMeansVerified: boolean;
  timestampEncoding: "explicit_offset";
}
export interface VerificationReceiptContext {
  scope: EvidenceScope;
  visitId: string;
  now: string;
  acceptance: VerificationReceiptAcceptance | null;
}
export interface VisitVerificationReceipt {
  state: "ready" | "unknown";
  /** HHA receipt state only; never a complete compliance or green decision. */
  verification: "verified" | "unknown";
  scope: EvidenceScope;
  visitId: string;
  receipt: { verifiedBy: string | null; verifiedDate: string | null; verifiedTime: string | null; supervisorName: string | null; notes: string | null };
  verifiedAt: NormalizedInstant | null;
  reasons: readonly string[];
  sourceRevision: string | null;
  acceptanceVersion: string | null;
}
const FIELDS = { verifiedBy: "Verification/VerifiedBy", verifiedDate: "Verification/VerifiedDate", verifiedTime: "Verification/VerifiedTime", supervisorName: "Verification/SupervisorName", notes: "Verification/Notes" } as const;
const PROFILE_KEYS = ["accepted", "version", "sourceVersion", "reviewReference", "receiptMeansVerified", "timestampEncoding"];

export function validVerificationReceiptAcceptance(value: unknown, sourceVersion?: string): value is VerificationReceiptAcceptance {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return Object.keys(item).length === PROFILE_KEYS.length && Object.keys(item).every(key => PROFILE_KEYS.includes(key))
    && typeof item.accepted === "boolean" && typeof item.receiptMeansVerified === "boolean"
    && (item.accepted !== true || item.receiptMeansVerified === true)
    && [item.version, item.sourceVersion].every(version => typeof version === "string" && /^[A-Za-z0-9_.:-]{1,80}$/.test(version))
    && (sourceVersion === undefined || item.sourceVersion === sourceVersion)
    && typeof item.reviewReference === "string" && !!item.reviewReference.trim() && item.reviewReference.length <= 500 && !/[\x00-\x1f\x7f]/.test(item.reviewReference)
    && item.timestampEncoding === "explicit_offset";
}

/** Captured ENT1.8 WSDL: GetVisitInfoDetailsV2/V3.Verification references the
 * Verification type (VerifiedBy/Notes/VerifiedDate/VerifiedTime/SupervisorName).
 * No boolean state or absence semantics are present. Aggregation is a separate
 * object and is deliberately unused. VerifiedTime remains a raw string: this
 * adapter never combines it with a date using an undocumented time convention. */
export function adaptVerificationReceipt(evidence: NormalizedVisitEvidence, context: VerificationReceiptContext): VisitVerificationReceipt {
  validEvidenceScope(context.scope); identifier(context.visitId);
  const nowMs = normalizedInstant(context.now).epochMs;
  if (!sameEvidenceScope(evidence.scope, context.scope) || evidence.visitId !== context.visitId) throw new WorkflowError("verification_receipt_scope_mismatch", 403);
  const receipt = Object.fromEntries(Object.entries(FIELDS).map(([key, field]) => [key, evidence.raw?.[field] ?? null])) as VisitVerificationReceipt["receipt"];
  const base = { scope: Object.freeze({ ...context.scope }), visitId: context.visitId, receipt: Object.freeze(receipt), verifiedAt: null,
    sourceRevision: evidence.provenance?.sourceRevision ?? null, acceptanceVersion: context.acceptance?.version ?? null };
  const unknown = (reason: string): VisitVerificationReceipt => ({ ...base, state: "unknown", verification: "unknown", reasons: [reason] });
  if (!context.acceptance) return unknown("verification_receipt_acceptance_pending");
  if (!validVerificationReceiptAcceptance(context.acceptance)) return unknown("verification_receipt_acceptance_invalid");
  if (!context.acceptance.accepted || !context.acceptance.receiptMeansVerified) return unknown("verification_receipt_acceptance_pending");
  if (evidence.state !== "ready" || !evidence.raw || !evidence.provenance || evidence.provenance.source !== "hhaexchange"
    || !["GetVisitInfoV2", "GetVisitInfoV3"].includes(evidence.provenance.operation)) return unknown("verification_visit_evidence_not_ready");
  if (evidence.provenance.acceptanceVersion !== context.acceptance.sourceVersion) return unknown("verification_source_acceptance_changed");
  const hash = createHash("sha256").update(JSON.stringify(Object.entries(evidence.raw).sort(([left], [right]) => left.localeCompare(right)))).digest("hex");
  if (evidence.raw.ID !== context.visitId || hash !== evidence.provenance.sourceRevision) return unknown("verification_source_revision_mismatch");
  try {
    if (!evidence.provenance.maxAgeSeconds || !evidenceIsFresh(evidence.provenance.fetchedAt, context.now, evidence.provenance.maxAgeSeconds)) return unknown("verification_visit_evidence_stale");
  } catch { return unknown("verification_visit_evidence_stale"); }
  if (Object.values(FIELDS).some(field => !Object.hasOwn(evidence.raw!, field))) return unknown("verification_receipt_projection_incomplete");
  if (!receipt.verifiedBy?.trim() || !receipt.verifiedDate?.trim()) return unknown("verification_receipt_absent_or_incomplete");
  if (receipt.verifiedBy.length > 128 || /[\x00-\x1f\x7f]/.test(receipt.verifiedBy)) return unknown("verification_receipt_identity_invalid");
  let verifiedAt: NormalizedInstant;
  try { verifiedAt = normalizedInstant(receipt.verifiedDate, "verification_receipt_timestamp_unusable"); }
  catch { return unknown("verification_receipt_timestamp_unusable"); }
  if (Number(receipt.verifiedDate.slice(0, 4)) < 1900) return unknown("verification_receipt_timestamp_unusable");
  if (verifiedAt.epochMs > nowMs || verifiedAt.epochMs > normalizedInstant(evidence.provenance.fetchedAt).epochMs) return unknown("verification_receipt_timestamp_future");
  const ends = [evidence.times.actualEnd, evidence.times.evvEnd].filter((value): value is NormalizedInstant => value !== null);
  if (!ends.length) return unknown("verification_visit_completion_unavailable");
  if (ends.some(end => verifiedAt.epochMs < end.epochMs)) return unknown("verification_receipt_precedes_recorded_end");
  return { ...base, state: "ready", verification: "verified", verifiedAt, reasons: [] };
}
