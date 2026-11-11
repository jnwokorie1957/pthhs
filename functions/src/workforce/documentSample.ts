import {getFirestore} from "firebase-admin/firestore";
import {PDFDocument, StandardFonts, rgb} from "pdf-lib";
import {DocumentAccess, type DocumentPrincipal, type DocumentAccessCheck} from "./documentAccess.js";
import {kmsDocumentCipher, type DocumentCipher} from "./documentEncryption.js";
import {DocumentVerificationMail} from "./verificationMail.js";
import {WorkforceError} from "./policy.js";

const PATH = "/application/documents/verification-sample";
// Only generated, fictional bytes enter this temporary acceptance flow. It
// cannot read applications, caller uploads, HHA records or a supplied file path.
export class DocumentSample {
  constructor(private mail: DocumentVerificationMail, private db = getFirestore(), private cipher: DocumentCipher = kmsDocumentCipher()) {}
  async request(principal: DocumentPrincipal, check: DocumentAccessCheck) {
    await check();
    const pdf = await PDFDocument.create(), font = await pdf.embedFont(StandardFonts.Helvetica), page = pdf.addPage([612, 792]);
    page.drawText("Prime Time Home Health Services", {x: 54, y: 725, size: 20, font, color: rgb(0.04, 0.25, 0.28)});
    page.drawText("Secure document verification", {x: 54, y: 680, size: 16, font});
    page.drawText("SAMPLE DOCUMENT - FICTIONAL DATA", {x: 54, y: 620, size: 14, font});
    page.drawText("Your email code was verified before this document was opened.", {x: 54, y: 580, size: 11, font});
    page.drawText("This sample contains no caregiver identification or personal records.", {x: 54, y: 552, size: 11, font});
    page.drawText("Encrypted with AES-256-GCM; the file key is protected by Cloud KMS.", {x: 54, y: 500, size: 11, font});
    const challenge = await new DocumentAccess(this.db).request(principal, PATH, check);
    const context = "verification-sample/" + principal.uid + "/" + challenge.challengeId;
    const encrypted = await this.cipher.encrypt(Buffer.from(await pdf.save()), context);
    await this.db.collection("workforceDocumentSamples").doc(challenge.challengeId).create({uid: principal.uid, context,
      bytes: encrypted.bytes.toString("base64"), envelope: encrypted.envelope, expiresAt: challenge.expiresAt,
      deleteAfter: new Date(challenge.expiresAt + 3600000)});
    await check();
    return {...challenge, ...await this.mail.send(challenge.challengeId, principal)};
  }
  verify(principal: DocumentPrincipal, id: unknown, code: unknown, check: DocumentAccessCheck) {
    return new DocumentAccess(this.db).verify(principal, id, code, async path => {
      if (path !== PATH) throw new WorkforceError(403, "document_verification_required"); await check();
    });
  }
  async open(principal: DocumentPrincipal, token: unknown, check: DocumentAccessCheck) {
    await new DocumentAccess(this.db).consume(principal, PATH, token, check);
    const id = String(token).split(".")[0]!;
    const sample = (await this.db.collection("workforceDocumentSamples").doc(id).get()).data();
    if (!sample || sample.uid !== principal.uid || sample.expiresAt <= Date.now()
      || sample.context !== "verification-sample/" + principal.uid + "/" + id) throw new WorkforceError(403, "document_verification_required");
    await check();
    const bytes = await this.cipher.decrypt(Buffer.from(sample.bytes, "base64"), sample.envelope, sample.context);
    await check();
    return bytes;
  }
}
