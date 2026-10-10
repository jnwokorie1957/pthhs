import assert from "node:assert/strict";
import test from "node:test";
import type { DecodedIdToken, UserRecord } from "firebase-admin/auth";
import { PrimetimeAuthError, requirePrimetimeAdmin } from "./admin.js";

const email = "jeremynwokorie@gmail.com";
const request = { get: (name: string) => name.toLowerCase() === "authorization" ? "Bearer fixture" : undefined };

function fixture(overrides: Record<string, unknown> = {}, userOverrides: Record<string, unknown> = {}) {
  const token = { uid: "approved-uid", email, email_verified: true, ...overrides } as unknown as DecodedIdToken;
  const user = { uid: token.uid, email, emailVerified: true, disabled: false, ...userOverrides } as unknown as UserRecord;
  const checks: boolean[] = [];
  const lookups: string[] = [];
  const auth = {
    async verifyIdToken(_token: string, revoked: boolean) { checks.push(revoked); return token; },
    async getUser(uid: string) { lookups.push(uid); return user; },
  };
  return { auth, checks, lookups };
}

test("the approved verified mailbox receives admin access without extra workflow authority", async () => {
  const mock = fixture();
  const principal = await requirePrimetimeAdmin(request, mock.auth);
  assert.deepEqual(principal, { uid: "approved-uid", email, roles: ["admin"] });
  assert.deepEqual(mock.checks, [true]);
  assert.deepEqual(mock.lookups, ["approved-uid"]);
});

test("approved mailbox normalization is limited to case and surrounding whitespace", async () => {
  const mock = fixture({ email: " JEREMYNWOKORIE@GMAIL.COM " }, { email: "JEREMYNWOKORIE@GMAIL.COM" });
  assert.deepEqual((await requirePrimetimeAdmin(request, mock.auth)).roles, ["admin"]);
});

for (const [label, token] of [
  ["unverified mailbox", { email_verified: false }],
  ["missing verification", { email_verified: undefined }],
  ["missing email", { email: undefined }],
  ["another mailbox", { email: "someone@gmail.com" }],
  ["plus alias", { email: "jeremynwokorie+admin@gmail.com" }],
  ["dot alias", { email: "jeremy.nwokorie@gmail.com" }],
] as const) {
  test(`email approval rejects ${label}`, async () => {
    const mock = fixture(token);
    await assert.rejects(requirePrimetimeAdmin(request, mock.auth), error => error instanceof PrimetimeAuthError && error.statusCode === 403);
    assert.deepEqual(mock.lookups, []);
  });
}

for (const [label, user] of [
  ["disabled account", { disabled: true }],
  ["changed email", { email: "someone@gmail.com" }],
  ["unverified current account", { emailVerified: false }],
  ["mismatched UID", { uid: "another-uid" }],
] as const) {
  test(`current account check rejects ${label}`, async () => {
    await assert.rejects(requirePrimetimeAdmin(request, fixture({}, user).auth), error => error instanceof PrimetimeAuthError && error.statusCode === 403);
  });
}

test("revoked tokens and failed account lookups remain unauthorized", async () => {
  const mock = fixture();
  await assert.rejects(requirePrimetimeAdmin(request, { ...mock.auth, async verifyIdToken() { throw new Error("revoked"); } }), error => error instanceof PrimetimeAuthError && error.statusCode === 401);
  await assert.rejects(requirePrimetimeAdmin(request, { ...mock.auth, async getUser() { throw new Error("unavailable"); } }), error => error instanceof PrimetimeAuthError && error.statusCode === 401);
});

test("existing administrator claims and explicit reviewer authority are preserved", async () => {
  for (const claims of [{ admin: true }, { role: "admin" }, { roles: ["admin", "collections_reviewer"] }]) {
    const mock = fixture({ email: "existing@pthhs.net", email_verified: false, ...claims });
    const principal = await requirePrimetimeAdmin(request, mock.auth);
    assert.ok(principal.roles.includes("admin"));
    assert.deepEqual(mock.lookups, []);
    if ("roles" in claims) assert.ok(principal.roles.includes("collections_reviewer"));
  }
  const principal = await requirePrimetimeAdmin(request, fixture({ roles: ["scheduling_reviewer"] }).auth);
  assert.deepEqual(principal.roles, ["scheduling_reviewer", "admin"]);
});

test("missing bearer authorization never reaches Firebase", async () => {
  const mock = fixture();
  await assert.rejects(requirePrimetimeAdmin({ get: () => undefined }, mock.auth), error => error instanceof PrimetimeAuthError && error.statusCode === 401);
  assert.deepEqual(mock.checks, []);
});
