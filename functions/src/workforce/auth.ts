import { getAuth } from "firebase-admin/auth";
import { WorkforceError } from "./policy.js";
interface Request { get(name: string): string | undefined }
// Reuse the same Firebase project and UID; never accept browser role claims.
export async function workforceIdentity(request: Request, auth = getAuth()): Promise<string> {
  const header = request.get("authorization");
  if (!header?.startsWith("Bearer ") || !header.slice(7).trim()) throw new WorkforceError(401, "sign_in_required");
  try {
    const token = await auth.verifyIdToken(header.slice(7).trim(), true);
    const user = await auth.getUser(token.uid);
    if (user.disabled || !user.emailVerified || token.email_verified !== true || user.email !== token.email) throw new Error();
    return user.uid;
  } catch { throw new WorkforceError(401, "verified_identity_required"); }
}
