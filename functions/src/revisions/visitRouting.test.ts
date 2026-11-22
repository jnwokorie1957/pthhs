import assert from "node:assert/strict";
import test from "node:test";
import { parseFuelPrices, planZipRoute, quickestRoundTrip } from "./visitRouting.js";

const leg = (seconds: number, meters = 100) => ({ seconds, meters });

test("route uses directed traffic times and mileage to break a tie", () => {
  const matrix = [
    [leg(0, 0), leg(10, 150), leg(10, 100)],
    [leg(15, 100), leg(0, 0), leg(5, 150)],
    [leg(10, 150), leg(5, 100), leg(0, 0)],
  ];
  assert.deepEqual(quickestRoundTrip(matrix), { order: [0, 1, 2, 0], meters: 450, seconds: 25 });
  matrix[1]![0] = leg(10, 100);
  assert.deepEqual(quickestRoundTrip(matrix), { order: [0, 2, 1, 0], meters: 300, seconds: 25 });
  assert.deepEqual(quickestRoundTrip(matrix, 1), { order: [0, 1, 2, 0], meters: 450, seconds: 25 });
  assert.equal(quickestRoundTrip([[leg(0, 0), null], [leg(20), leg(0, 0)]]), null);
});

test("shows a dated Houston regular price alongside the Texas regular average", () => {
  const html = "<p>Today's AAA Texas Avg. $3.1045 <i></i></p><p>Price as of 11/22/26</p>" +
    "<h3 data-cost=\"3.1984\">Houston</h3><div><table><tr><td>Current Avg.</td><td>$3.1984</td><td>$3.8697</td></tr></table></div>";
  assert.deepEqual(parseFuelPrices(html), { date: "2026-11-22", houston: 3.1984, texas: 3.1045, source: "https://gasprices.aaa.com/?lv=true&state=TX" });
  assert.equal(parseFuelPrices(html.replace("Houston", "Dallas")), null);
});

test("ZIP route sends only the public office address and ZIPs to Google and estimates fuel", async context => {
  const oldKey = process.env.PRIMETIME_GOOGLE_ROUTES_KEY;
  process.env.PRIMETIME_GOOGLE_ROUTES_KEY = "synthetic-test-key";
  context.after(() => {
    if (oldKey === undefined) delete process.env.PRIMETIME_GOOGLE_ROUTES_KEY;
    else process.env.PRIMETIME_GOOGLE_ROUTES_KEY = oldKey;
  });
  context.mock.method(global, "fetch", async (url: string, options?: RequestInit) => {
    if (url.startsWith("https://gasprices.aaa.com/")) return new Response("", { status: 502 });
    assert.equal(url, "https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix");
    const request = JSON.parse(String(options?.body));
    assert.equal(request.routingPreference, "TRAFFIC_AWARE");
    assert.deepEqual(request.origins.map((item: { waypoint: { address: string } }) => item.waypoint.address),
      ["11602 Burdine St, Houston, TX 77035", "77479, TX, USA"]);
    return Response.json([
      { originIndex: 0, destinationIndex: 1, condition: "ROUTE_EXISTS", distanceMeters: 5000, duration: "600s" },
      { originIndex: 1, destinationIndex: 0, condition: "ROUTE_EXISTS", distanceMeters: 6000, duration: "540s" },
    ]);
  });
  const route = await planZipRoute({ zips: ["77479", "77479"], mpg: 28, regularPrice: 3 });
  assert.deepEqual(route.zips, ["77035", "77479", "77035"]);
  assert.equal(route.minutes, 19);
  assert.equal(route.routing, "google_traffic");
  assert.equal(route.fuelCost?.toFixed(2), "0.73");
  await assert.rejects(planZipRoute({ zips: ["Member Name, 77479"], mpg: 28, regularPrice: 3 }), /invalid_route_zips/);
});
