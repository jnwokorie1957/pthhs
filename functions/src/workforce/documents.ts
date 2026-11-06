import sharp from "sharp";
import { WorkforceError } from "./policy.js";
export const DOCUMENT_KINDS = ["identity", "social_security", "employment_authorization", "i9", "w4"] as const;
export type DocumentKind = typeof DOCUMENT_KINDS[number];
export const MAX_DOCUMENT_BYTES = 8 * 1024 * 1024;
export interface PrivateDocument {
  id: string; uid: string; kind: DocumentKind; state: "upload_pending" | "pending_review" | "pending_security_review" | "upload_failed";
  createdAt: string; size: number; sha256: string | null; generation: string | null;
  extension?: "jpg" | "pdf"; contentType?: "image/jpeg" | "application/pdf";
}
export const requiredDocumentKinds: readonly DocumentKind[] = ["identity", "social_security"];
export function missingRequiredDocuments(documents: Pick<PrivateDocument, "kind" | "state">[], exception?: { approved: boolean; kinds: DocumentKind[] }) {
  return requiredDocumentKinds.filter(kind => !documents.some(doc => doc.kind === kind && ["pending_review", "pending_security_review"].includes(doc.state))
    && !(exception?.approved === true && exception.kinds.includes(kind)));
}
export function documentKind(value: unknown): DocumentKind {
  // Historical categories remain readable; new uploads are identity documents.
  // Tax/employment forms use their dedicated structured completion endpoints.
  if (!requiredDocumentKinds.includes(value as DocumentKind)) throw new WorkforceError(400, "invalid_document_kind");
  return value as DocumentKind;
}
// Decode and re-encode raster images. Never store originals, embedded metadata,
// active formats, filenames, arbitrary PDFs or client-provided MIME claims.
export async function sanitizeDocument(encoded: unknown): Promise<Buffer> {
  if (typeof encoded !== "string" || !encoded.length || encoded.length % 4 !== 0 || encoded.length > Math.ceil(MAX_DOCUMENT_BYTES / 3) * 4
    || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) throw new WorkforceError(400, "invalid_document_size");
  const bytes = Buffer.from(encoded, "base64");
  if (!bytes.length || bytes.length > MAX_DOCUMENT_BYTES || bytes.toString("base64") !== encoded) throw new WorkforceError(400, "invalid_document_size");
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const png = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (!jpeg && !png) throw new WorkforceError(400, "document_image_required");
  try {
    const image = sharp(bytes, { limitInputPixels: 24_000_000, failOn: "warning", animated: false });
    const metadata = await image.metadata();
    if (!metadata.width || !metadata.height || metadata.width < 100 || metadata.height < 100 || (metadata.pages ?? 1) !== 1) throw Error();
    return await image.rotate().resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 90 }).toBuffer();
  } catch { throw new WorkforceError(400, "unreadable_document_image"); }
}
export async function prepareDocument(encoded: unknown): Promise<{ bytes: Buffer; extension: "jpg" | "pdf"; contentType: "image/jpeg" | "application/pdf"; state: "pending_review" | "pending_security_review" }> {
  if (typeof encoded !== "string" || !encoded.length || encoded.length % 4 !== 0 || encoded.length > Math.ceil(MAX_DOCUMENT_BYTES / 3) * 4
    || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) throw new WorkforceError(400, "invalid_document_size");
  const bytes = Buffer.from(encoded, "base64");
  if (!bytes.length || bytes.length > MAX_DOCUMENT_BYTES || bytes.toString("base64") !== encoded) throw new WorkforceError(400, "invalid_document_size");
  if (/^%PDF-(?:1\.[0-7]|2\.0)/.test(bytes.subarray(0, 8).toString("ascii"))) {
    if (!/%%EOF\s*$/.test(bytes.subarray(-1024).toString("latin1"))) throw new WorkforceError(400, "invalid_pdf");
    // Receive opaque, bounded PDF bytes without parsing/decompressing active
    // content in the web function. Preserve signatures/fields. Quarantine until
    // a trusted security scanner/reviewer supplies a separate clean verdict.
    return { bytes, extension: "pdf", contentType: "application/pdf", state: "pending_security_review" };
  }
  return { bytes: await sanitizeDocument(encoded), extension: "jpg", contentType: "image/jpeg", state: "pending_review" };
}
export function documentSummary(document: PrivateDocument) {
  return { id: document.id, kind: document.kind, state: document.state, createdAt: document.createdAt, size: document.size, contentType: document.contentType ?? "image/jpeg" };
}
