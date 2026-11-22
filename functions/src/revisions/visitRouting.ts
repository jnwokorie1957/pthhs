import { GoogleAuth } from "google-auth-library";
import { WorkflowError } from "../operations/reads.js";
import { strictObject } from "./policy.js";
import { chicagoDate } from "../workforce/dates.js";
import { visitZipPoint } from "./visitArea.js";

const OFFICE_ZIP = "77035";
const OFFICE_ADDRESS = "11602 Burdine St, Houston, TX 77035";
const AAA_TEXAS = "https://gasprices.aaa.com/?lv=true&state=TX";
type Leg = { meters: number; seconds: number };
type Route = Leg & { order: number[] };

export function quickestRoundTrip(matrix: (Leg | null)[][], first = 0): Route | null {
  const size = matrix.length;
  const best = new Map<number, Route>();
  const full = (1 << size) - 1;
  const better = (candidate: Route, prior?: Route) => !prior || candidate.seconds < prior.seconds ||
    (candidate.seconds === prior.seconds && candidate.meters < prior.meters);
  const add = (route: Route, index: number, leg: Leg): Route =>
    ({ order: [...route.order, index], meters: route.meters + leg.meters, seconds: route.seconds + leg.seconds });
  best.set(size, { order: [0], meters: 0, seconds: 0 });
  let roundTrip: Route | undefined;
  for (let mask = 1; mask <= full; mask += 2) {
    for (let last = 0; last < size; last++) {
      const route = best.get(mask * size + last);
      if (!route) continue;
      if (mask === full) {
        const leg = matrix[last]?.[0];
        if (leg) {
          const candidate = add(route, 0, leg);
          if (better(candidate, roundTrip)) roundTrip = candidate;
        }
        continue;
      }
      for (let next = 1; next < size; next++) {
        const leg = matrix[last]?.[next];
        if (!leg || (mask === 1 && first && next !== first) || (mask & (1 << next))) continue;
        const key = (mask | (1 << next)) * size + next;
        const candidate = add(route, next, leg);
        if (better(candidate, best.get(key))) best.set(key, candidate);
      }
    }
  }
  return roundTrip ?? null;
}

export function parseFuelPrices(html: string) {
  const date = /Price as of\s+(\d{1,2})\/(\d{1,2})\/(\d{2})/.exec(html);
  const houston = /<h3[^>]*>\s*Houston\s*<\/h3>([\s\S]*?)<\/table>/i.exec(html)?.[1];
  const regular = houston && />\s*Current Avg\.\s*<\/td>\s*<td>\s*\$([\d.]+)\s*<\/td>/i.exec(houston)?.[1];
  const texas = /Today's AAA Texas Avg\.\s*\$([\d.]+)\s*</i.exec(html)?.[1];
  if (!date || !regular || !texas) return null;
  const houstonPrice = Number(regular), texasPrice = Number(texas);
  if (![houstonPrice, texasPrice].every(price => Number.isFinite(price) && price > 0 && price < 30)) return null;
  return { date: "20" + date[3] + "-" + date[1]!.padStart(2, "0") + "-" + date[2]!.padStart(2, "0"), houston: houstonPrice, texas: texasPrice, source: AAA_TEXAS };
}

let cachedPrices: { fetchedAt: number; prices: NonNullable<ReturnType<typeof parseFuelPrices>> } | undefined;
async function fuelPrices(now: Date) {
  if (cachedPrices && now.getTime() - cachedPrices.fetchedAt < 30 * 60 * 1000) return cachedPrices.prices;
  try {
    const response = await fetch(AAA_TEXAS, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return null;
    const prices = parseFuelPrices(await response.text());
    if (!prices) return null;
    const age = Date.parse(chicagoDate(now)) - Date.parse(prices.date);
    if (!Number.isFinite(age) || age < 0 || age > 2 * 86400000) return null;
    cachedPrices = { fetchedAt: now.getTime(), prices };
    return prices;
  } catch { return null; }
}

const googleAuth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
async function mapsHeaders(): Promise<Record<string, string> | null> {
  const key = process.env.PRIMETIME_GOOGLE_ROUTES_KEY;
  if (key) return { "X-Goog-Api-Key": key };
  if (!process.env.K_SERVICE && !process.env.GOOGLE_APPLICATION_CREDENTIALS) return null;
  const token = await googleAuth.getAccessToken();
  return token ? { Authorization: "Bearer " + token, "X-Goog-User-Project": "primetimehomehealthservices" } : null;
}

async function googleMatrix(zips: string[], credentials: Record<string, string>): Promise<(Leg | null)[][]> {
  const waypoints = zips.map(zip => ({ waypoint: { address: zip === OFFICE_ZIP ? OFFICE_ADDRESS : zip + ", TX, USA" } }));
  const response = await fetch("https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix", {
    method: "POST", redirect: "error", signal: AbortSignal.timeout(12_000),
    headers: { ...credentials, "Content-Type": "application/json",
      "X-Goog-FieldMask": "originIndex,destinationIndex,status,condition,distanceMeters,duration" },
    body: JSON.stringify({ origins: waypoints, destinations: waypoints, travelMode: "DRIVE", routingPreference: "TRAFFIC_AWARE" }),
  });
  if (!response.ok) throw new Error("route_matrix_unavailable");
  const elements = await response.json() as { originIndex?: number; destinationIndex?: number; status?: { code?: number };
    condition?: string; distanceMeters?: number; duration?: string }[];
  if (!Array.isArray(elements)) throw new Error("route_matrix_unavailable");
  const matrix = zips.map((_, from) => zips.map((_, to): Leg | null => from === to ? { meters: 0, seconds: 0 } : null));
  for (const element of elements) {
    const row = matrix[element.originIndex ?? 0], destination = element.destinationIndex ?? 0;
    if (!row || !Number.isInteger(destination) || destination < 0 || destination >= zips.length || element.status?.code ||
      element.condition !== "ROUTE_EXISTS" || !Number.isSafeInteger(element.distanceMeters) || element.distanceMeters! < 0 ||
      !/^\d+(?:\.\d+)?s$/.test(element.duration ?? "")) continue;
    row[destination] = { meters: element.distanceMeters!, seconds: Number(element.duration!.slice(0, -1)) };
  }
  return matrix;
}

function geographicOrder(zips: string[], first: number) {
  const points = zips.map(visitZipPoint);
  if (points.some(point => !point)) return [...zips, OFFICE_ZIP];
  const result = quickestRoundTrip(points.map(from => points.map(to => {
    const north = to![0] - from![0], east = (to![1] - from![1]) * Math.cos((to![0] + from![0]) * Math.PI / 360);
    // For the fallback only, minimize straight-line distance between representative ZIP points.
    return { meters: Math.hypot(north, east) * 111_195, seconds: 0 };
  })), first);
  return result ? result.order.map(index => zips[index]!) : [...zips, OFFICE_ZIP];
}

export async function planZipRoute(value: unknown, now = new Date()) {
  const input = strictObject(value, ["zips", "mpg", "regularPrice", "admissionZip"], ["zips", "mpg", "regularPrice"]);
  if (!Array.isArray(input.zips) || !input.zips.length || input.zips.length > 9 ||
    input.zips.some(zip => typeof zip !== "string" || !/^77[0-8]\d{2}$/.test(zip))) throw new WorkflowError("invalid_route_zips");
  if (typeof input.mpg !== "number" || !Number.isFinite(input.mpg) || input.mpg < 5 || input.mpg > 100 ||
    (input.regularPrice !== null && (typeof input.regularPrice !== "number" || !Number.isFinite(input.regularPrice) ||
      input.regularPrice <= 0 || input.regularPrice > 30))) throw new WorkflowError("invalid_route_fuel_input");
  if (input.admissionZip && (typeof input.admissionZip !== "string" || !input.zips.includes(input.admissionZip))) throw new WorkflowError("invalid_route_zips");
  const zips = [...new Set<string>([OFFICE_ZIP, ...(input.admissionZip ? [String(input.admissionZip)] : []), ...input.zips])];
  const first = input.admissionZip ? zips.indexOf(String(input.admissionZip)) : 0;
  const prices = fuelPrices(now);
  let route: Route | null = null, routing = zips.length === 1 ? "single_zip" : "google_unconfigured";
  try {
    const credentials = zips.length === 1 ? null : await mapsHeaders();
    if (credentials) {
      route = quickestRoundTrip(await googleMatrix(zips, credentials), first);
      routing = route ? "google_traffic" : "google_unavailable";
    }
  } catch { routing = "google_unavailable"; }
  const currentPrices = await prices, regularPrice = input.regularPrice ?? currentPrices?.houston ?? null;
  const miles = route ? route.meters / 1609.344 : null;
  const gallons = miles === null ? null : miles / input.mpg;
  return { routing, officeZip: OFFICE_ZIP, zips: route ? route.order.map(index => zips[index]!) : geographicOrder(zips, first),
    miles, minutes: route ? route.seconds / 60 : null, gallons, fuelCost: gallons !== null && regularPrice !== null ? gallons * regularPrice : null,
    mpg: input.mpg, admissionZip: input.admissionZip ?? null, regularPrice, prices: currentPrices };
}
