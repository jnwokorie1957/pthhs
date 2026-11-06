import { getAuth } from "firebase-admin/auth";
import { WorkforceError } from "./policy.js";
interface Request { get(name: string): string | undefined }
// Reuse the same Firebase project and UID; never accept browser role claims.
export async function workforceIdentity(request: Request, auth?: ReturnType<typeof getAuth>): Promise<string> {
  const header = request.get("authorization");
  if (!header?.startsWith("Bearer ") || !header.slice(7).trim()) throw new WorkforceError(401, "sign_in_required");
  try {
    const client=auth??getAuth();
    const token = await client.verifyIdToken(header.slice(7).trim(), true);
    const user = await client.getUser(token.uid);
    if (user.disabled || !user.emailVerified || token.email_verified !== true || user.email !== token.email) throw new Error();
    return user.uid;
  } catch { throw new WorkforceError(401, "verified_identity_required"); }
}
export async function recentWorkforceIdentity(request: Request, auth = getAuth(), now = Date.now()): Promise<string> {
  const uid = await workforceIdentity(request, auth);
  const header = request.get("authorization")!;
  const token = await auth.verifyIdToken(header.slice(7).trim(), true).catch(() => { throw new WorkforceError(401, "verified_identity_required"); });
  if (typeof token.auth_time !== "number" || token.auth_time > now / 1000 + 60 || now / 1000 - token.auth_time > 900) throw new WorkforceError(401, "recent_sign_in_required");
  return uid;
}
