import { createHash } from "node:crypto";
import { getStorage } from "firebase-admin/storage";
import type { FileMetadata } from "@google-cloud/storage";
import { WorkflowError } from "../operations/reads.js";

export const FORM_BUCKET = "primetimehomehealthservices.firebasestorage.app";
export const MAX_FORM_BYTES = 2 * 1024 * 1024;
export type FormKind = "templates" | "submissions";
export type FormRecord = { id: string; kind: FormKind; filename: string; contentType: string; size: number; sha256: string; uploadedAt: string };
type Stored = { record: FormRecord; generation: string };
export interface FormStore {
  create(record: FormRecord, bytes: Buffer, actor: string): Promise<boolean>;
  metadata(kind: FormKind, id: string): Promise<Stored>;
  page(kind: FormKind, cursor?: string): Promise<{ items: FormRecord[]; nextCursor: string | null }>;
  bytes(kind: FormKind, id: string, generation: string): Promise<Buffer>;
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new WorkflowError("invalid_form_request");
  return value as Record<string, unknown>;
}
function keys(value: Record<string, unknown>, allowed: string[]) {
  if (Object.keys(value).some(key => !allowed.includes(key))) throw new WorkflowError("invalid_form_request");
}
export function formKind(value: unknown): FormKind {
  if (value !== "templates" && value !== "submissions") throw new WorkflowError("invalid_form_folder");
  return value;
}
function formId(value: unknown): string {
  if (typeof value !== "string" || !/^[a-f0-9]{64}\.(pdf|png|jpg)$/.test(value)) throw new WorkflowError("invalid_form_id");
  return value;
}
function filename(value: unknown): string {
  if (typeof value !== "string" || value.length > 120 || !/^[A-Za-z0-9][A-Za-z0-9 _().-]*\.(pdf|png|jpe?g)$/i.test(value)) throw new WorkflowError("invalid_form_filename");
  return value;
}
function format(bytes: Buffer): { ext: string; contentType: string } {
  if (bytes.subarray(0, 5).toString("ascii") === "%PDF-" && /%%EOF\s*$/.test(bytes.subarray(-1024).toString("latin1"))) return { ext: "pdf", contentType: "application/pdf" };
  if (bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return { ext: "png", contentType: "image/png" };
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 && bytes.at(-2) === 255 && bytes.at(-1) === 217) return { ext: "jpg", contentType: "image/jpeg" };
  throw new WorkflowError("unsupported_form_content");
}
export async function uploadForm(store: FormStore, value: unknown, actor: string, now = new Date()) {
  const input = object(value); keys(input, ["kind", "filename", "base64"]);
  const kind = formKind(input.kind), name = filename(input.filename), encoded = input.base64;
  if (typeof encoded !== "string" || !encoded.length || encoded.length % 4 !== 0 || encoded.length > Math.ceil(MAX_FORM_BYTES / 3) * 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) throw new WorkflowError("invalid_form_size_or_encoding");
  const bytes = Buffer.from(encoded, "base64");
  if (!bytes.length || bytes.length > MAX_FORM_BYTES || bytes.toString("base64") !== encoded) throw new WorkflowError("invalid_form_size_or_encoding");
  const fileFormat = format(bytes), extension = name.split(".").at(-1)!.toLowerCase().replace("jpeg", "jpg");
  if (extension !== fileFormat.ext) throw new WorkflowError("form_extension_mismatch");
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const record: FormRecord = { id: `${sha256}.${fileFormat.ext}`, kind, filename: name, contentType: fileFormat.contentType, size: bytes.length, sha256, uploadedAt: now.toISOString() };
  const created = await store.create(record, bytes, actor);
  const saved = (await store.metadata(kind, record.id)).record;
  if (saved.sha256 !== sha256 || saved.size !== bytes.length) throw new WorkflowError("form_integrity_error", 503);
  return { ok: true, item: saved, duplicate: !created };
}
export async function listForms(store: FormStore, value: unknown) {
  const input = object(value); keys(input, ["kind", "cursor"]);
  const kind = formKind(input.kind);
  if (input.cursor !== undefined && (typeof input.cursor !== "string" || !/^[\x21-\x7e]{1,4096}$/.test(input.cursor))) throw new WorkflowError("invalid_form_cursor");
  return { ok: true, ...await store.page(kind, input.cursor as string | undefined) };
}
export async function downloadForm(store: FormStore, kindValue: unknown, idValue: unknown) {
  const kind = formKind(kindValue), id = formId(idValue), saved = await store.metadata(kind, id);
  if (saved.record.size < 1 || saved.record.size > MAX_FORM_BYTES) throw new WorkflowError("form_integrity_error", 503);
  const bytes = await store.bytes(kind, id, saved.generation);
  if (bytes.length !== saved.record.size || createHash("sha256").update(bytes).digest("hex") !== saved.record.sha256) throw new WorkflowError("form_integrity_error", 503);
  return { record: saved.record, bytes };
}
function stored(metadata: FileMetadata, kind: FormKind): Stored {
  const id = formId(metadata.name?.split("/").at(-1)), custom = metadata.metadata ?? {};
  const size = Number(metadata.size), name = filename(custom.originalFilename);
  const sha256 = id.split(".")[0]!, contentType = ({ pdf: "application/pdf", png: "image/png", jpg: "image/jpeg" } as Record<string,string>)[id.split(".")[1]!]!;
  if (metadata.name !== `forms/${kind}/${id}` || custom.schema !== "primetime-form-v1" || custom.sha256 !== sha256 || metadata.contentType !== contentType
    || !Number.isSafeInteger(size) || size < 1 || size > MAX_FORM_BYTES || typeof metadata.generation !== "string" || !/^\d+$/.test(metadata.generation)
    || typeof custom.uploadedAt !== "string" || !Number.isFinite(Date.parse(custom.uploadedAt))) throw new WorkflowError("form_integrity_error", 503);
  return { record: { id, kind, filename: name, contentType, size, sha256, uploadedAt: custom.uploadedAt }, generation: metadata.generation };
}
export class FirebaseFormStore implements FormStore {
  private bucket = getStorage().bucket(FORM_BUCKET);
  async create(record: FormRecord, bytes: Buffer, actor: string): Promise<boolean> {
    try {
      await this.bucket.file(`forms/${record.kind}/${record.id}`).save(bytes, { resumable: false, validation: "crc32c", preconditionOpts: { ifGenerationMatch: 0 },
        metadata: { contentType: record.contentType, cacheControl: "private, no-store", contentDisposition: `attachment; filename="${record.filename}"`,
          metadata: { schema: "primetime-form-v1", originalFilename: record.filename, sha256: record.sha256, uploadedAt: record.uploadedAt, uploadedBy: actor } } });
      return true;
    } catch (error) { if ((error as { code?: number }).code === 412) return false; throw error; }
  }
  async metadata(kind: FormKind, id: string) {
    try { const [metadata] = await this.bucket.file(`forms/${kind}/${id}`).getMetadata(); return stored(metadata, kind); }
    catch (error) { if ((error as { code?: number }).code === 404) throw new WorkflowError("form_not_found", 404); throw error; }
  }
  async page(kind: FormKind, cursor?: string) {
    const [files, next] = await this.bucket.getFiles({ prefix: `forms/${kind}/`, maxResults: 20, autoPaginate: false, ...(cursor ? { pageToken: cursor } : {}) });
    const items: FormRecord[] = [];
    for (const file of files) { if (file.name.endsWith("/")) continue; items.push(stored(file.metadata, kind).record); }
    return { items, nextCursor: next?.pageToken ?? null };
  }
  async bytes(kind: FormKind, id: string, generation: string) {
    const [bytes] = await this.bucket.file(`forms/${kind}/${id}`, { generation }).download({ validation: "crc32c" });
    return bytes;
  }
}
