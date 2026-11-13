import { createHash } from "node:crypto";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { WorkforceError } from "./policy.js";
import { WorkforceStore } from "./store.js";

function username(value: unknown): string {
  const name = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(name)) {
    throw new WorkforceError(400, "invalid_staff_username");
  }
  return name;
}

async function identityRequest(operation: "sendOobCode" | "signInWithPassword", body: object) {
  const init = await fetch("https://primetimehomehealthservices.firebaseapp.com/__/firebase/init.json", {
    redirect: "error", signal: AbortSignal.timeout(8000),
  });
  if (!init.ok) throw new WorkforceError(503, "staff_auth_unavailable");
  const config = await init.json() as {projectId?: string; apiKey?: string};
  if (config.projectId !== "primetimehomehealthservices" || !config.apiKey) {
    throw new WorkforceError(503, "staff_auth_unavailable");
  }
  return fetch("https://identitytoolkit.googleapis.com/v1/accounts:" + operation + "?key=" + encodeURIComponent(config.apiKey), {
    method: "POST", redirect: "error", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body), signal: AbortSignal.timeout(8000),
  });
}

export class StaffCredentials {
  constructor(private store: WorkforceStore, private db = getFirestore(), private auth = getAuth()) {}
  private credentials(uid: string) {
    return this.db.collection("workforceStaffCredentials").doc(uid);
  }
  private alias(name: string) {
    return this.db.collection("workforceStaffUsernames").doc(name);
  }
  async setupRequired(uid: string) {
    return (await this.credentials(uid).get()).data()?.setupRequired === true;
  }
  private async reserve(kind: string, target: string, ip: string, maximum: number) {
    const now = Date.now(), hour = Math.floor(now / 3_600_000);
    const keyed = (type: string, value: string) => this.db.collection("workforceStaffAuthLimits")
      .doc(kind + "_" + type + "_" + createHash("sha256").update(value).digest("hex"));
    await this.db.runTransaction(async tx => {
      const targetRef = keyed("target", target), ipRef = keyed("ip", ip);
      const [targetLimit, ipLimit] = await Promise.all([tx.get(targetRef), tx.get(ipRef)]);
      const count = (data?: {hour?: number; count?: number}) => data?.hour === hour ? (data.count || 0) : 0;
      const targetCount = count(targetLimit.data()), ipCount = count(ipLimit.data());
      if (targetCount >= maximum || ipCount >= 30) throw new WorkforceError(429, "staff_auth_rate_limit");
      tx.set(targetRef, {hour, count: targetCount + 1});
      tx.set(ipRef, {hour, count: ipCount + 1});
    });
  }
  async sendSetup(email: string, ip: string, origin: string) {
    await this.reserve("setup", email, ip, 3);
    if (!await this.store.canRequestPasswordSetup(email)) return { requested: true };
    const continuation = new URL("/workforce?staffSetup=1", origin);
    if (continuation.origin !== "https://pthhs.net") throw new WorkforceError(503, "portal_origin_unconfigured");
    const result = await identityRequest("sendOobCode", {
      requestType: "EMAIL_SIGNIN", email, continueUrl: continuation.href, canHandleCodeInApp: true,
    });
    if (!result.ok) throw new WorkforceError(503, "staff_auth_unavailable");
    return { requested: true };
  }
  async set(uid: string, password: unknown, name: unknown) {
    if (typeof password !== "string" || password.length < 8 || password.length > 128
      || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)
      || !/[^A-Za-z0-9\s]/.test(password)) {
      throw new WorkforceError(400, "weak_staff_password");
    }
    const alias = name === "" || name === undefined ? "" : username(name);
    await this.store.actor(uid);
    if (alias) {
      const owner = (await this.alias(alias).get()).data()?.uid;
      if (owner && owner !== uid) throw new WorkforceError(409, "staff_username_taken");
    }
    await this.auth.updateUser(uid, {password});
    await this.db.runTransaction(async tx => {
      const ref = this.credentials(uid), old = (await tx.get(ref)).data();
      if (alias) {
        const ref = this.alias(alias), owner = (await tx.get(ref)).data()?.uid;
        if (owner && owner !== uid) throw new WorkforceError(409, "staff_username_taken");
        // A previous alias may remain indexed, but only the current alias can authenticate.
        tx.set(ref, {uid});
      }
      tx.set(ref, {setupRequired:false, username:alias || old?.username || ""});
    });
    return { saved:true };
  }
  async resolve(name: unknown, password: unknown, ip: string) {
    const alias = username(name);
    const denied = new WorkforceError(401, "invalid_staff_credentials");
    if (typeof password !== "string" || !password.length || password.length > 128) throw denied;
    await this.reserve("username", alias, ip, 12);
    const uid = (await this.alias(alias).get()).data()?.uid;
    if (typeof uid !== "string") throw denied;
    const profile = (await this.credentials(uid).get()).data();
    if (profile?.username !== alias || profile.setupRequired) throw denied;
    const user = await this.auth.getUser(uid).catch(() => null);
    if (!user?.email || !user.emailVerified || user.disabled) throw denied;
    await this.store.actor(uid).catch(() => { throw denied; });
    const response = await identityRequest("signInWithPassword", {email:user.email, password, returnSecureToken:true});
    if (!response.ok) throw denied;
    const result = await response.json() as {localId?: string; idToken?: string; mfaPendingCredential?: string};
    if (!(result.localId === uid && result.idToken) && !result.mfaPendingCredential) throw denied;
    // The browser completes sign-in with the Firebase SDK, including any MFA challenge.
    return {email:user.email};
  }
}
