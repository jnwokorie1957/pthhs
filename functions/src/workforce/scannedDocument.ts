import { createHash } from "node:crypto";
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";
import { WorkforceError } from "./policy.js";

export const documentHash = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");

export function scannedSource(encoded: unknown) {
  const source = typeof encoded === "string" && encoded.length <= Math.ceil(8 * 1024 * 1024 / 3) * 4
    ? Buffer.from(encoded, "base64") : Buffer.alloc(0);
  if (!source.length || source.length > 8 * 1024 * 1024 || source.toString("base64") !== encoded) {
    throw new WorkforceError(400, "invalid_document_size");
  }
  return source;
}

export async function scannedPreview(pages: unknown) {
  if (!Array.isArray(pages) || !pages.length || pages.length > 12) throw new WorkforceError(400, "authorization_page_limit");
  if (pages.some(page => typeof page !== "string") || pages.reduce((total, page) => total + page.length, 0) > 12_000_000) {
    throw new WorkforceError(413, "authorization_file_too_large");
  }
  const pdf = await PDFDocument.create();
  for (const encoded of pages) {
    const bytes = Buffer.from(encoded, "base64");
    if (!bytes.length || bytes.toString("base64") !== encoded || bytes.length > 2_000_000) {
      throw new WorkforceError(400, "invalid_page_image");
    }
    let jpg: Buffer;
    try {
      jpg = await sharp(bytes, { limitInputPixels: 12_000_000 }).rotate().flatten({ background: "#fff" }).jpeg({ quality: 85 }).toBuffer();
    } catch {
      throw new WorkforceError(400, "invalid_page_image");
    }
    const image = await pdf.embedJpg(jpg);
    const page = pdf.addPage([image.width, image.height]);
    page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
  }
  return Buffer.from(await pdf.save());
}
