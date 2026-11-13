import {createHash, timingSafeEqual} from "node:crypto";
import {getFirestore} from "firebase-admin/firestore";
import {WorkforceError} from "./policy.js";
import type {DocumentPrincipal} from "./documentAccess.js";

const AUDIENCE = "api://AzureADTokenExchange";
const SENDER = "jnwokorie@pthhs.net";
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
export interface VerificationMessage {to: string; code: string}
export interface VerificationTransport {prepare(): Promise<(message: VerificationMessage) => Promise<void>>}
type Fetch = typeof fetch;

// The Google runtime proves its identity to Entra. No mailbox password,
// refresh token or application client secret is stored by the portal.
export class GraphVerificationTransport implements VerificationTransport {
  constructor(private tenant: string, private client: string, protected request: Fetch = fetch,
    private assertion = async () => {
      const response = await request("http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity?audience=" + encodeURIComponent(AUDIENCE),
        {headers: {"Metadata-Flavor": "Google"}, signal: AbortSignal.timeout(8000), redirect: "error"});
      if (!response.ok) throw Error("mail_identity_unavailable");
      const token = await response.text();
      if (token.length > 16000 || token.split(".").length !== 3) throw Error("mail_identity_unavailable");
      return token;
    }) {}
  protected async prepareToken() {
    if (!UUID.test(this.tenant) || !UUID.test(this.client)) throw Error("mail_configuration_unavailable");
    const response = await this.request(`https://login.microsoftonline.com/${this.tenant}/oauth2/v2.0/token`, {
      method: "POST", headers: {"Content-Type": "application/x-www-form-urlencoded"}, redirect: "error", signal: AbortSignal.timeout(12000),
      body: new URLSearchParams({client_id: this.client, scope: "https://graph.microsoft.com/.default", grant_type: "client_credentials",
        client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer", client_assertion: await this.assertion()})
    });
    if (!response.ok) throw Error("mail_identity_unavailable");
    const value = await response.json() as {access_token?: string; token_type?: string};
    if (!value.access_token || value.token_type?.toLowerCase() !== "bearer") throw Error("mail_identity_unavailable");
    return value.access_token;
  }
  async prepare() {
    const token = await this.prepareToken();
    return async (message: VerificationMessage) => {
      if (!/^\d{6}$/.test(message.code) || message.to.length > 254 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(message.to)) throw Error("invalid_verification_mail");
      const sent = await this.request("https://graph.microsoft.com/v1.0/users/" + encodeURIComponent(SENDER) + "/sendMail", {
        method: "POST", redirect: "error", signal: AbortSignal.timeout(15000),
        headers: {Authorization: "Bearer " + token, "Content-Type": "application/json"},
        body: JSON.stringify({message: {subject: "Your Primetime document verification code",
          body: {contentType: "Text", content: `Your verification code is ${message.code}. It expires in 5 minutes and can only be used for the document request you started. Do not share this code.\n\nPrime Time Home Health Services`},
          toRecipients: [{emailAddress: {address: message.to}}]}, saveToSentItems: false})
      });
      // 202 means Microsoft accepted dispatch. It does not prove inbox delivery.
      if (sent.status !== 202) throw Error("mail_dispatch_rejected");
    };
  }
}

export class DocumentVerificationMail {
  constructor(private transport: VerificationTransport, private db = getFirestore(), private now = () => Date.now()) {}
  async send(id: string, principal: DocumentPrincipal) {
    if (!UUID.test(id)) throw new WorkforceError(400, "invalid_document_request");
    let dispatch: Awaited<ReturnType<VerificationTransport["prepare"]>>;
    try { dispatch = await this.transport.prepare(); }
    catch { throw new WorkforceError(503, "document_verification_delivery_failed"); }
    const ref = this.db.collection("workforceIdentityMail").doc("verify-" + id);
    const challengeRef = this.db.collection("workforceDocumentChallenges").doc(id);
    const message = await this.db.runTransaction(async tx => {
      const mail = (await tx.get(ref)).data(), challenge = (await tx.get(challengeRef)).data();
      const code = typeof mail?.message?.text === "string" ? mail.message.text.match(/^Your verification code is (\d{6})\./)?.[1] : undefined;
      if (!mail || mail.kind !== "document_verification" || mail.challengeId !== id || mail.deliveryStatus !== "queued" || !code
        || !challenge || challenge.uid !== principal.uid || challenge.email !== principal.email || challenge.authTime !== principal.authTime
        || challenge.verified || challenge.consumed || challenge.expiresAt <= this.now() + 15000
        || !Array.isArray(mail.to) || mail.to.length !== 1 || mail.to[0] !== principal.email
        || typeof challenge.salt !== "string" || typeof challenge.codeHash !== "string" || !/^[a-f0-9]{64}$/.test(challenge.codeHash)
        || !timingSafeEqual(Buffer.from(challenge.codeHash, "hex"), createHash("sha256").update(challenge.salt + code).digest())) {
        throw new WorkforceError(403, "document_verification_required");
      }
      // Atomically claim before network dispatch and erase the plaintext code.
      // A crash/timeout is never automatically retried: ask for a new code.
      tx.update(ref, {deliveryStatus: "sending", message: null, attemptedAt: new Date(this.now())});
      return {to: principal.email, code};
    });
    try { await dispatch(message); }
    catch {
      await ref.update({deliveryStatus: "unconfirmed", message: null}).catch(() => undefined);
      throw new WorkforceError(503, "document_verification_delivery_failed");
    }
    await ref.update({deliveryStatus: "accepted", message: null, acceptedAt: new Date(this.now())});
    return {delivery: "accepted" as const};
  }
}
