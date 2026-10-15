import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth, type DecodedIdToken, type UserRecord } from "firebase-admin/auth";

if (getApps().length === 0) {
  initializeApp();
}

interface HeaderRequest {
  get(name: string): string | undefined;
}

// Application access approved by the owner. Firebase must prove mailbox/phone
// ownership; submitted input or a browser-side check cannot grant access.
export const APPROVED_ADMIN_EMAILS: readonly string[] = Object.freeze([
  "jeremynwokorie@gmail.com",
]);
export const APPROVED_ADMIN_PHONES: readonly string[] = Object.freeze(["+18324030094"]);

export function normalizeUsPhone(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 40 || !/^\+?[\d\s().-]+$/.test(value.trim())) return null;
  const digits = value.replace(/\D/g, "");
  const national = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  return /^[2-9]\d{2}[2-9]\d{6}$/.test(national) ? "+1" + national : null;
}
function approvedPhone(value: unknown): boolean {
  const phone = normalizeUsPhone(value);
  return phone !== null && APPROVED_ADMIN_PHONES.includes(phone);
}

interface AdminAuth {
  verifyIdToken(token: string, checkRevoked: boolean): Promise<DecodedIdToken>;
  getUser(uid: string): Promise<Pick<UserRecord, "uid" | "email" | "emailVerified" | "phoneNumber" | "disabled">>;
}

function approvedEmail(email: unknown): boolean {
  return typeof email === "string" && APPROVED_ADMIN_EMAILS.includes(email.trim().toLowerCase());
}

export interface PrimetimePrincipal {
  uid: string;
  roles: string[];
  email?: string;
  phoneNumber?: string;
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
  auth: AdminAuth = getAuth(),
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
    decoded = await auth.verifyIdToken(idToken, true);
  } catch {
    throw new PrimetimeAuthError(401, "unauthorized");
  }

  const roles = claimRoles(decoded);
  const emailApproved = decoded.email_verified === true && approvedEmail(decoded.email);
  // Firebase phone_number is an SDK-verified identity, never request input.
  const phoneApproved = approvedPhone(decoded.phone_number);
  if (!roles.includes("admin") && (emailApproved || phoneApproved)) {
    // Recheck the current account so an old token cannot retain this identity
    // grant after the account is disabled or its approved email/phone changes.
    let user: Awaited<ReturnType<AdminAuth["getUser"]>>;
    try {
      user = await auth.getUser(decoded.uid);
    } catch {
      throw new PrimetimeAuthError(401, "unauthorized");
    }
    if (user.uid === decoded.uid && !user.disabled && (
      emailApproved && user.emailVerified === true && approvedEmail(user.email)
      || phoneApproved && approvedPhone(user.phoneNumber)
    )) {
      roles.push("admin");
    }
  }
  if (!roles.includes("admin")) {
    throw new PrimetimeAuthError(403, "forbidden");
  }

  return {
    uid: decoded.uid,
    roles,
    ...(typeof decoded.email === "string" ? { email: decoded.email } : {}),
    ...(phoneApproved ? { phoneNumber: normalizeUsPhone(decoded.phone_number)! } : {}),
  };
}
