import { defineJsonSecret, defineString } from "firebase-functions/params";

export interface HhaCredentials {
  appName: string;
  appSecret: string;
  appKey: string;
}

/**
 * Runtime-only secret stored in Google Cloud Secret Manager.
 * Expected JSON value:
 * {"appName":"...","appSecret":"...","appKey":"..."}
 */
export const hhaCredentials = defineJsonSecret("HHAEXCHANGE_CREDENTIALS");

/**
 * Non-secret configuration. Override only if HHA provisions a different endpoint.
 */
export const hhaBaseUrl = defineString("HHAEXCHANGE_BASE_URL", {
  default: "https://cloud.hhaexchange.com/Integration/ENT/V1.8/ws.asmx",
});

export function getHhaCredentials(): HhaCredentials {
  const value = hhaCredentials.value() as Partial<HhaCredentials>;

  if (!value.appName || !value.appSecret || !value.appKey) {
    throw new Error("HHAEXCHANGE_CREDENTIALS is missing appName, appSecret, or appKey");
  }

  return {
    appName: value.appName,
    appSecret: value.appSecret,
    appKey: value.appKey,
  };
}
