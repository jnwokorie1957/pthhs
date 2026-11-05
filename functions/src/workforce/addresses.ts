import { getApp } from "firebase-admin/app";
import { WorkforceError } from "./policy.js";
export interface Address { street: string; city: string; state: string; zip: string }
interface Component { types?: string[]; longText?: string; shortText?: string }
export function addressComponents(input: unknown): Address {
  if (!Array.isArray(input)) throw new WorkforceError(422, "address_incomplete");
  const components = input as Component[];
  const value = (type: string, short = false) => {
    const item = components.find(c => Array.isArray(c.types) && c.types.includes(type));
    const text = short ? item?.shortText : item?.longText;
    return typeof text === "string" ? text : "";
  };
  const number = value("street_number"), route = value("route");
  const address = { street: [number, route].filter(Boolean).join(" "), city: value("locality") || value("postal_town") || value("sublocality_level_1"), state: value("administrative_area_level_1", true), zip: value("postal_code") };
  if (!number || !route || !address.city || !/^[A-Z]{2}$/.test(address.state) || !/^\d{5}$/.test(address.zip) || value("country", true) !== "US") throw new WorkforceError(422, "address_incomplete");
  return address;
}
export function addressRequest(input: unknown, details: boolean) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new WorkforceError(400, "invalid_address_request");
  const body = input as Record<string, unknown>, key = details ? "placeId" : "input";
  if (Object.keys(body).some(k => ![key, "sessionToken"].includes(k)) || typeof body[key] !== "string" || typeof body.sessionToken !== "string"
    || !/^[a-f0-9-]{36}$/i.test(body.sessionToken) || (details ? !/^[A-Za-z0-9_-]{1,256}$/.test(body[key] as string) : (body[key] as string).trim().length < 4 || (body[key] as string).length > 180)) throw new WorkforceError(400, "invalid_address_request");
  return { value: body[key] as string, sessionToken: body.sessionToken };
}
export class GoogleAddressLookup {
  constructor(private token: () => Promise<string> = async () => {
    const credential = getApp().options.credential;
    if (!credential) throw new WorkforceError(503, "address_lookup_unavailable");
    return (await credential.getAccessToken()).access_token;
  }, private request: typeof fetch = fetch) {}
  async lookup(input: unknown, details: boolean) {
    const parsed = addressRequest(input, details), authorization = "Bearer " + await this.token();
    // The host/project are fixed. Never accept a URL, credentials, person name,
    // SSN, uploaded data or whole application as an upstream request.
    const url = details ? `https://places.googleapis.com/v1/places/${encodeURIComponent(parsed.value)}?sessionToken=${encodeURIComponent(parsed.sessionToken)}` : "https://places.googleapis.com/v1/places:autocomplete";
    const response = await this.request(url, {
      method: details ? "GET" : "POST", signal: AbortSignal.timeout(6000),
      headers: { Authorization: authorization, "X-Goog-User-Project": "primetimehomehealthservices", "Content-Type": "application/json",
        "X-Goog-FieldMask": details ? "addressComponents" : "suggestions.placePrediction.placeId,suggestions.placePrediction.text.text" },
      ...(details ? {} : { body: JSON.stringify({ input: parsed.value, sessionToken: parsed.sessionToken, includedRegionCodes: ["us"], languageCode: "en" }) })
    });
    if (!response.ok) throw new WorkforceError(503, "address_lookup_unavailable");
    const body = await response.json() as { addressComponents?: unknown; suggestions?: { placePrediction?: { placeId?: unknown; text?: { text?: unknown } } }[] };
    if (details) return { address: addressComponents(body.addressComponents), provider: "Google Maps" };
    return { items: (Array.isArray(body.suggestions) ? body.suggestions : []).slice(0, 5).flatMap(s => {
      const p = s.placePrediction;
      return typeof p?.placeId === "string" && /^[A-Za-z0-9_-]{1,256}$/.test(p.placeId) && typeof p.text?.text === "string"
        ? [{ id: p.placeId, label: p.text.text.slice(0, 250) }] : [];
    }), provider: "Google Maps" };
  }
}
