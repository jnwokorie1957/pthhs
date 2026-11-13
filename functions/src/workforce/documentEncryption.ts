import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { GoogleAuth } from "google-auth-library";
import { WorkforceError } from "./policy.js";

export interface DocumentEnvelope {
  version: 1;
  keyName: string;
  wrappedKey: string;
  iv: string;
  tag: string;
}
export interface DocumentCipher {
  encrypt(bytes: Buffer, context: string): Promise<{bytes: Buffer; envelope: DocumentEnvelope}>;
  decrypt(bytes: Buffer, envelope: DocumentEnvelope, context: string): Promise<Buffer>;
}
export interface KeyWrapper {
  wrap(key: Buffer, context: Buffer): Promise<Buffer>;
  unwrap(key: Buffer, context: Buffer): Promise<Buffer>;
}

// The per-file AES key exists only in memory. KMS wraps it before storage.
export class EnvelopeDocumentCipher implements DocumentCipher {
  constructor(private keyName: string, private keys: KeyWrapper) {}
  async encrypt(bytes: Buffer, context: string) {
    const key = randomBytes(32), iv = randomBytes(12), aad = Buffer.from(context);
    try {
      const cipher = createCipheriv("aes-256-gcm", key, iv);
      cipher.setAAD(aad);
      const encrypted = Buffer.concat([cipher.update(bytes), cipher.final()]);
      const wrapped = await this.keys.wrap(key, aad);
      return {bytes: encrypted, envelope: {version: 1 as const, keyName: this.keyName,
        wrappedKey: wrapped.toString("base64"), iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64")}};
    } finally { key.fill(0); }
  }
  async decrypt(bytes: Buffer, envelope: DocumentEnvelope, context: string) {
    if (envelope.version !== 1 || envelope.keyName !== this.keyName) throw new WorkforceError(503, "document_key_unavailable");
    const aad = Buffer.from(context);
    const key = await this.keys.unwrap(Buffer.from(envelope.wrappedKey, "base64"), aad);
    try {
      if (key.length !== 32 || Buffer.from(envelope.iv, "base64").length !== 12 || Buffer.from(envelope.tag, "base64").length !== 16) throw Error();
      const cipher = createDecipheriv("aes-256-gcm", key, Buffer.from(envelope.iv, "base64"));
      cipher.setAAD(aad);
      cipher.setAuthTag(Buffer.from(envelope.tag, "base64"));
      return Buffer.concat([cipher.update(bytes), cipher.final()]);
    } catch { throw new WorkforceError(503, "document_integrity_error"); }
    finally { key.fill(0); }
  }
}

export function kmsDocumentCipher(): DocumentCipher {
  const name = process.env.WORKFORCE_DOCUMENT_KMS_KEY || "";
  // Pin the project and region. A file cannot redirect the service to another key.
  if (!/^projects\/primetimehomehealthservices\/locations\/us-central1\/keyRings\/[a-zA-Z0-9_-]+\/cryptoKeys\/[a-zA-Z0-9_-]+$/.test(name)) {
    throw new WorkforceError(503, "document_key_unavailable");
  }
  const auth = new GoogleAuth({scopes: ["https://www.googleapis.com/auth/cloudkms"]});
  const call = async (action: "encrypt" | "decrypt", value: Buffer, context: Buffer) => {
    try {
      const client = await auth.getClient();
      const response = await client.request<Record<string, string>>({
        url: `https://cloudkms.googleapis.com/v1/${name}:${action}`, method: "POST", timeout: 10000,
        headers: {"x-goog-user-project": "primetimehomehealthservices"},
        data: {[action === "encrypt" ? "plaintext" : "ciphertext"]: value.toString("base64"), additionalAuthenticatedData: context.toString("base64")}
      });
      const result = response.data[action === "encrypt" ? "ciphertext" : "plaintext"];
      if (!result) throw Error();
      return Buffer.from(result, "base64");
    } catch { throw new WorkforceError(503, "document_key_unavailable"); }
  };
  return new EnvelopeDocumentCipher(name, {wrap: (key, aad) => call("encrypt", key, aad), unwrap: (key, aad) => call("decrypt", key, aad)});
}
