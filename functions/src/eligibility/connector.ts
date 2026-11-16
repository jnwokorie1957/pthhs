import { randomUUID } from 'node:crypto';
import { identityValid, normalizeEvidence, unavailable, type Evidence, type Identity, type Result } from './domain.js';

export interface Inquiry { identity: Identity; asOf: string; traceId: string }
export interface EligibilityConnector { verify(inquiry: Inquiry): Promise<Result> }
export interface EdiCodec {
  // Bind a licensed, validated 005010X279A1 implementation after TMHP certification.
  encode270(inquiry: Inquiry, submitterId: string, receiverId: string): Promise<string>;
  decode271(payload: string, inquiry: Inquiry): Promise<Evidence>;
}
export interface TmhpConfiguration {
  environment: 'test' | 'production'; approved: boolean; submitterId: string; password: string;
  // Separate from the endpoint: confirm the test ISA08 / CORE ReceiverID with TMHP.
  receiverId: '617591011TIELT' | '617591011TIELP';
}
export const TMHP_ENDPOINTS = {
  test: 'https://services-uat.tmhp.com/corerules/httpsrequest',
  production: 'https://services.tmhp.com/corerules/httpsrequest',
} as const;
export class ConnectorError extends Error {
  constructor(public code: 'credentials_expired' | 'network_failure' | 'invalid_response' | 'delivery_unknown' | 'connection_pending') { super(code); }
}
export interface Transport { exchange(payload: string, config: TmhpConfiguration): Promise<string> }
export class SafeHarborTransport implements Transport {
  constructor(private fetcher: typeof fetch = fetch) {}
  async exchange(payload: string, config: TmhpConfiguration): Promise<string> {
    if (!config.approved || !config.submitterId || !config.password) throw new ConnectorError('connection_pending');
    if (!(config.environment in TMHP_ENDPOINTS) || !['617591011TIELT', '617591011TIELP'].includes(config.receiverId)) throw new ConnectorError('connection_pending');
    if (config.environment === 'production' && config.receiverId !== '617591011TIELP') throw new ConnectorError('connection_pending');
    if (Buffer.byteLength(payload) > 1000000 || !payload.startsWith('ISA')) throw new ConnectorError('invalid_response');
    const form = new FormData(), payloadId = randomUUID();
    for (const [name, value] of Object.entries({PayloadType:'X12_270_Request_005010X279A1', ProcessingMode:'RealTime',
      PayloadID:payloadId, TimeStamp:new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'), SenderID:config.submitterId,
      ReceiverID:config.receiverId, CORERuleVersion:'2.2.0', UserName:config.submitterId, Password:config.password, Payload:payload})) form.set(name, value);
    let response: Response;
    try { response = await this.fetcher(TMHP_ENDPOINTS[config.environment], {method:'POST', body:form, redirect:'error', cache:'no-store', signal:AbortSignal.timeout(25000)}); }
    catch { throw new ConnectorError('delivery_unknown'); } // May have reached TMHP: no automatic resend.
    if (response.status === 401 || response.status === 403) throw new ConnectorError('credentials_expired');
    if (!response.ok) throw new ConnectorError('delivery_unknown');
    // Bound streamed bytes before parsing. Never log request, response, or vendor errors.
    const reader = response.body?.getReader(); if (!reader) throw new ConnectorError('invalid_response');
    const chunks: Uint8Array[] = []; let size = 0;
    try { while (true) { const {done,value} = await reader.read(); if (done) break; size += value.length;
      if (size > 2000000) { await reader.cancel(); throw new ConnectorError('invalid_response'); } chunks.push(value); } }
    catch { throw new ConnectorError('invalid_response'); }
    const contentType = response.headers.get('content-type') || '';
    const boundary = /boundary=(?:"([^"\r\n]+)"|([^;\s]+))/i.exec(contentType);
    if (!/^multipart\//i.test(contentType) || !boundary) throw new ConnectorError('invalid_response');
    const fields = new Map<string,string>();
    for (const part of Buffer.concat(chunks).toString('utf8').split('--'+(boundary[1]||boundary[2]))) {
      const split = part.indexOf('\r\n\r\n'); if (split < 0) continue;
      const name = /(?:^|;)\s*name="([A-Za-z]+)"/im.exec(part.slice(0,split))?.[1];
      if (!name) continue; if (fields.has(name)) throw new ConnectorError('invalid_response');
      fields.set(name,part.slice(split+4).replace(/\r\n$/, ''));
    }
    if (fields.get('PayloadID') !== payloadId || fields.get('ErrorCode') !== 'Success' ||
      fields.get('PayloadType') !== 'X12_271_Response_005010X279A1' ||
      fields.get('SenderID') !== config.receiverId || fields.get('ReceiverID') !== config.submitterId ||
      fields.get('ProcessingMode') !== 'RealTime' || fields.get('CORERuleVersion') !== '2.2.0') throw new ConnectorError('invalid_response');
    const result = fields.get('Payload'); if (!result?.startsWith('ISA')) throw new ConnectorError('invalid_response');
    return result;
  }
}
export class TmhpConnector implements EligibilityConnector {
  constructor(private config: () => Promise<TmhpConfiguration>, private codec: EdiCodec, private transport: Transport = new SafeHarborTransport()) {}
  async verify(inquiry: Inquiry): Promise<Result> {
    const now = new Date();
    if (!identityValid(inquiry.identity)) return unavailable(inquiry.asOf, now.toISOString(), 'invalid_identifier');
    try {
      const config = await this.config(); if (!config.approved) throw new ConnectorError('connection_pending');
      const request = await this.codec.encode270(inquiry, config.submitterId, config.receiverId);
      return normalizeEvidence(await this.codec.decode271(await this.transport.exchange(request, config), inquiry), inquiry.asOf, new Date());
    } catch (error) { return unavailable(inquiry.asOf, new Date().toISOString(), error instanceof ConnectorError ? error.code : 'invalid_response'); }
  }
}
// Deliberately cannot be enabled with a browser setting or environment variable.
// Licensed TR3 validation, approved UAT fixtures and sign-off are still required.
export const CERTIFIED_CODEC_AVAILABLE = false;
export const pendingConnector: EligibilityConnector = {verify: async inquiry => unavailable(inquiry.asOf, new Date().toISOString(), 'connection_pending')};
