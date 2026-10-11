import { getApp } from "firebase-admin/app";
import { WorkflowError } from "../operations/reads.js";
import { NotificationOutbox, TwilioRestAdapter, validatedTwilioCallback, type NotificationContext, type NotificationOutboxRecord, type TwilioConfig } from "./notifications.js";

export interface SmsFactoryConfig {
  projectId: string; allowedOfficeId: string; callbackUrl: string;
  capabilityApproved?: boolean; configurationApproved?: boolean; sendApproved?: boolean;
  sourceApproved?: boolean; policyApproved?: boolean;
  timeoutMs?: number;
}
export interface SmsDependencies {
  request?: typeof fetch;
  getAccessToken?: () => Promise<{ access_token: string; expires_in: number }>;
}
export interface SmsCallbackRequest { method: string; query: unknown; rawForm: string; signature: string; contentType: string; }
interface Credentials { accountSid: string; authToken: string; from?: string; messagingServiceSid?: string; }
function authorized(config: SmsFactoryConfig, context: NotificationContext): boolean {
  return config.capabilityApproved === true && config.configurationApproved === true && config.sendApproved === true && config.sourceApproved === true && config.policyApproved === true &&
    context.dataApproved && context.mode === "live" && context.officeId === config.allowedOfficeId && context.roles.some(role => ["owner", "admin", "office_supervisor", "supervisor", "worker", "service"].includes(role));
}
function validateConfig(config: SmsFactoryConfig): { callback: URL; timeout: number } {
  if (!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(config.projectId) || !/^[A-Za-z0-9_-]{1,128}$/.test(config.allowedOfficeId)) throw new WorkflowError("invalid_sms_server_configuration", 503);
  let callback: URL;
  try { callback = new URL(config.callbackUrl); } catch { throw new WorkflowError("invalid_sms_server_configuration", 503); }
  if (callback.protocol !== "https:" || callback.username || callback.password || callback.hash || callback.search || callback.toString() !== config.callbackUrl) throw new WorkflowError("invalid_sms_server_configuration", 503);
  const timeout = config.timeoutMs ?? 10_000;
  if (!Number.isInteger(timeout) || timeout < 1_000 || timeout > 30_000) throw new WorkflowError("invalid_sms_server_configuration", 503);
  return { callback, timeout };
}
function parseCredentials(data: unknown): Credentials {
  if (typeof data !== "string" || data.length > 16_384 || !/^[A-Za-z0-9+/]+={0,2}$/.test(data) || data.length % 4 !== 0) throw new Error("invalid_secret_payload");
  const bytes = Buffer.from(data, "base64");
  if (bytes.toString("base64") !== data || !bytes.length || bytes.length > 8_192) throw new Error("invalid_secret_payload");
  const value: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid_secret_payload");
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some(key => !["accountSid", "authToken", "from", "messagingServiceSid"].includes(key)) || typeof input.accountSid !== "string" || typeof input.authToken !== "string" ||
    (input.from !== undefined && typeof input.from !== "string") || (input.messagingServiceSid !== undefined && typeof input.messagingServiceSid !== "string")) throw new Error("invalid_secret_payload");
  return { accountSid: input.accountSid, authToken: input.authToken, ...(typeof input.from === "string" ? { from: input.from } : {}), ...(typeof input.messagingServiceSid === "string" ? { messagingServiceSid: input.messagingServiceSid } : {}) };
}
async function credentials(config: SmsFactoryConfig, deps: SmsDependencies): Promise<Credentials> {
  const { timeout } = validateConfig(config), controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<never>((_resolve, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error("sms_credentials_timeout")); }, timeout); });
  try {
    const credential = deps.getAccessToken ?? (() => {
      const appCredential = getApp().options.credential;
      if (!appCredential) throw new Error("sms_application_credential_missing");
      return appCredential.getAccessToken();
    });
    // Fixed server resource; no request-supplied project, secret name, URL or version is accepted.
    // https://cloud.google.com/secret-manager/docs/reference/rest/v1/projects.secrets.versions/access
    const operation = async () => {
      const token = await credential();
      if (!token.access_token || /[\r\n]/.test(token.access_token) || token.access_token.length > 16_384 || !Number.isFinite(token.expires_in) || token.expires_in <= 0) throw new Error("sms_application_credential_invalid");
      const response = await (deps.request ?? fetch)(`https://secretmanager.googleapis.com/v1/projects/${config.projectId}/secrets/primetime-sms-credentials/versions/latest:access`, {
        method: "GET", redirect: "error", signal: controller.signal, headers: { Authorization: "Bearer " + token.access_token, Accept: "application/json" },
      });
      if (!response.ok) throw new Error("sms_credentials_unavailable");
      const text = await response.text();
      if (text.length > 24_000) throw new Error("sms_credentials_invalid");
      const body = JSON.parse(text) as { payload?: { data?: unknown } };
      const result = parseCredentials(body.payload?.data);
      // Validate provider account/sender/token shape without dispatching any request.
      new TwilioRestAdapter(result, deps.request ?? fetch);
      return result;
    };
    return await Promise.race([operation(), expired]);
  } catch { throw new WorkflowError("sms_credentials_unavailable", 503); }
  finally { if (timer) clearTimeout(timer); }
}
/** Returns null before credential or network access when any server release gate is closed. */
export async function createSmsAdapter(config: SmsFactoryConfig, context: NotificationContext, deps: SmsDependencies = {}): Promise<TwilioRestAdapter | null> {
  if (!authorized(config, context)) return null;
  const { callback, timeout } = validateConfig(config), secret = await credentials(config, deps);
  // Recheck mutable deployment/session gates after the asynchronous secret lookup.
  if (!authorized(config, context)) return null;
  callback.searchParams.set("officeId", config.allowedOfficeId);
  const twilio: TwilioConfig = { ...secret, statusCallbackUrl: callback.toString(), timeoutMs: timeout };
  try { return new TwilioRestAdapter(twilio, deps.request ?? fetch); }
  catch { throw new WorkflowError("sms_credentials_invalid", 503); }
}
export function canonicalSmsCallbackUrl(config: SmsFactoryConfig, query: unknown): { externalUrl: string; officeId: string; outboxId: string; attemptId: string } {
  const { callback } = validateConfig(config);
  if (!query || typeof query !== "object" || Array.isArray(query) || ![Object.prototype, null].includes(Object.getPrototypeOf(query) as object | null)) throw new WorkflowError("invalid_sms_callback_query");
  const values = query as Record<string, unknown>, keys = Object.keys(values);
  if (keys.length !== 3 || keys.some(key => !["officeId", "outboxId", "attemptId"].includes(key)) || typeof values.officeId !== "string" || typeof values.outboxId !== "string" || typeof values.attemptId !== "string" ||
    !/^[a-f0-9]{64}$/.test(values.outboxId) || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(values.attemptId)) throw new WorkflowError("invalid_sms_callback_query");
  if (values.officeId !== config.allowedOfficeId) throw new WorkflowError("sms_callback_office_scope_mismatch", 403);
  callback.searchParams.set("officeId", values.officeId); callback.searchParams.set("outboxId", values.outboxId); callback.searchParams.set("attemptId", values.attemptId);
  return { externalUrl: callback.toString(), officeId: values.officeId, outboxId: values.outboxId, attemptId: values.attemptId };
}
/** The route supplies server context/config and raw form bytes. Host and forwarded headers are never used. */
export async function handleSmsCallback(config: SmsFactoryConfig, input: SmsCallbackRequest, outbox: Pick<NotificationOutbox, "get" | "applyCallback">, context: NotificationContext, deps: SmsDependencies = {}): Promise<NotificationOutboxRecord> {
  if (input.method !== "POST") throw new WorkflowError("sms_callback_method_not_allowed", 405);
  if (!authorized(config, context)) throw new WorkflowError("sms_callback_capability_not_approved", 423);
  if (typeof input.rawForm !== "string" || input.rawForm.length > 32_000 || typeof input.signature !== "string" || !/^[A-Za-z0-9+/]{27}=$/.test(input.signature) || input.contentType.split(";")[0]?.trim().toLowerCase() !== "application/x-www-form-urlencoded") throw new WorkflowError("invalid_notification_callback_signature", 403);
  const scope = canonicalSmsCallbackUrl(config, input.query);
  // Fetch the target only in the server-configured office, before accessing credentials.
  const record = await outbox.get(scope.outboxId, context);
  if (record.officeId !== scope.officeId || record.attemptId !== scope.attemptId) throw new WorkflowError("sms_callback_attempt_mismatch", 409);
  const secret = await credentials(config, deps);
  if (!authorized(config, context)) throw new WorkflowError("sms_callback_capability_not_approved", 423);
  const result = validatedTwilioCallback({ authToken: secret.authToken, accountSid: secret.accountSid, externalUrl: scope.externalUrl, rawForm: input.rawForm, signature: input.signature, contentType: input.contentType });
  return outbox.applyCallback(scope.outboxId, scope.attemptId, result, context);
}
