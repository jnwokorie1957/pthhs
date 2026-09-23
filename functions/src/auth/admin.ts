import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth, type DecodedIdToken } from "firebase-admin/auth";

if (getApps().length === 0) {
  initializeApp();
}

interface HeaderRequest {
  get(name: string): string | undefined;
}

export interface PrimetimePrincipal {
  uid: string;
  roles: string[];
  email?: string;
}

export class PrimetimeAuthError extends Error {
  constructor(
    public readonly statusCode: 401 | 403,
    public readonly code: "unauthorized" | "forbidden",
  ) {
    super(code);
    this.name = "PrimetimeAuthError";
  }
}

function claimRoles(token: DecodedIdToken): string[] {
  const roles = new Set<string>();

  if (token.admin === true) {
    roles.add("admin");
  }

  if (typeof token.role === "string" && token.role.trim()) {
    roles.add(token.role.trim());
  }

  if (Array.isArray(token.roles)) {
    for (const role of token.roles) {
      if (typeof role === "string" && role.trim()) {
        roles.add(role.trim());
      }
    }
  }

  return [...roles];
}

export async function requirePrimetimeAdmin(
  request: HeaderRequest,
): Promise<PrimetimePrincipal> {
  const authorization = request.get("authorization") ?? request.get("Authorization");

  if (!authorization?.startsWith("Bearer ")) {
    throw new PrimetimeAuthError(401, "unauthorized");
  }

  const idToken = authorization.slice("Bearer ".length).trim();
  if (!idToken) {
    throw new PrimetimeAuthError(401, "unauthorized");
  }

  let decoded: DecodedIdToken;
  try {
    decoded = await getAuth().verifyIdToken(idToken, true);
  } catch {
    throw new PrimetimeAuthError(401, "unauthorized");
  }

  const roles = claimRoles(decoded);
  if (!roles.includes("admin")) {
    throw new PrimetimeAuthError(403, "forbidden");
  }

  return {
    uid: decoded.uid,
    roles,
    ...(typeof decoded.email === "string" ? { email: decoded.email } : {}),
  };
}
