import test from "node:test";
import assert from "node:assert/strict";
import { GoogleAddressLookup, addressComponents, addressRequest } from "./addresses.js";
const sessionToken = "11111111-1111-4111-8111-111111111111";
const components = [
  { types: ["street_number"], longText: "100" }, { types: ["route"], longText: "Synthetic Street" },
  { types: ["locality"], longText: "Synthetic City" }, { types: ["administrative_area_level_1"], shortText: "TX" },
  { types: ["postal_code"], longText: "77000" }, { types: ["country"], shortText: "US" },
  { types: ["subpremise"], longText: "Do not overwrite the applicant's unit" }
];
test("address selection fills street/city/state/ZIP while preserving separate unit entry", () => {
  assert.deepEqual(addressComponents(components), { street: "100 Synthetic Street", city: "Synthetic City", state: "TX", zip: "77000" });
  assert.throws(() => addressComponents(components.filter(c => !c.types.includes("street_number"))), /address_incomplete/);
  assert.throws(() => addressComponents([...components.filter(c => !c.types.includes("country")), { types: ["country"], shortText: "CA" }]), /address_incomplete/);
});
test("lookup rejects personal fields, arbitrary URLs and malformed session/place identifiers", () => {
  for (const payload of [{ input: "100 Test", sessionToken, ssn: "000-00-0000" }, { input: "100 Test", sessionToken, name: "Synthetic" }, { input: "a", sessionToken }, { input: "100 Test", sessionToken: "bad" }]) assert.throws(() => addressRequest(payload, false));
  assert.throws(() => addressRequest({ placeId: "https://example.invalid", sessionToken }, true));
});
test("Google proxy uses existing server OAuth, fixed project/host and narrow address-only fields", async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const request = (async (url: string | URL | Request, init: RequestInit) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify(calls.length === 1 ? { suggestions: [{ placePrediction: { placeId: "synthetic-place", text: { text: "100 Synthetic Street" } } }] } : { addressComponents: components }), { status: 200 });
  }) as typeof fetch;
  const lookup = new GoogleAddressLookup(async () => "synthetic-oauth-token", request);
  const suggested = await lookup.lookup({ input: "100 Synthetic", sessionToken }, false);
  assert.deepEqual(suggested, { items: [{ id: "synthetic-place", label: "100 Synthetic Street" }], provider: "Google Maps" });
  await lookup.lookup({ placeId: "synthetic-place", sessionToken }, true);
  assert.equal(calls[0]!.url, "https://places.googleapis.com/v1/places:autocomplete");
  const body = JSON.parse(calls[0]!.init.body as string);
  assert.deepEqual(Object.keys(body).sort(), ["input", "sessionToken", "includedRegionCodes", "languageCode"].sort());
  assert.equal((calls[0]!.init.headers as Record<string, string>).Authorization, "Bearer synthetic-oauth-token");
  assert.equal((calls[1]!.init.headers as Record<string, string>)["X-Goog-FieldMask"], "addressComponents");
  assert.ok(!JSON.stringify(calls).includes("apiKey"));
});
test("provider failure is reported without exposing Google error bodies or credentials", async () => {
  const lookup = new GoogleAddressLookup(async () => "synthetic-token", (async () => new Response("private provider details", { status: 403 })) as typeof fetch);
  await assert.rejects(lookup.lookup({ input: "100 Synthetic", sessionToken }, false), /address_lookup_unavailable/);
});
