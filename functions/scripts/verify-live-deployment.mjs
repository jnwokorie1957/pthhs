import { applicationDefault, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const projectId = "primetimehomehealthservices";
const baseUrl = "https://primetimehomehealthservices.web.app";

const app = initializeApp({
  credential: applicationDefault(),
  projectId,
});
const auth = getAuth(app);

async function adminUser() {
  const admins = [];
  let pageToken;

  do {
    const page = await auth.listUsers(1000, pageToken);
    admins.push(
      ...page.users.filter(
        (user) => !user.disabled && user.customClaims?.admin === true,
      ),
    );
    pageToken = page.pageToken;
  } while (pageToken);

  if (admins.length === 0) {
    return null;
  }

  return admins[0];
}

async function firebaseIdToken(user) {
  const configResponse = await fetch(baseUrl + "/__/firebase/init.json", {
    cache: "no-store",
  });
  if (!configResponse.ok) {
    throw new Error(
      "Firebase Hosting init config unavailable: HTTP " + configResponse.status,
    );
  }

  const config = await configResponse.json();
  if (!config.apiKey) {
    throw new Error("Firebase Hosting init config did not include apiKey.");
  }

  const customToken = await auth.createCustomToken(user.uid);
  const exchange = await fetch(
    "https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=" +
      encodeURIComponent(config.apiKey),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: customToken,
        returnSecureToken: true,
      }),
    },
  );

  const payload = await exchange.json();
  if (!exchange.ok || !payload.idToken) {
    throw new Error(
      "Could not exchange deployment verification token: HTTP " +
        exchange.status,
    );
  }

  return payload.idToken;
}

async function protectedGet(path, idToken) {
  let lastResponse;

  for (let attempt = 1; attempt <= 6; attempt += 1) {
    lastResponse = await fetch(baseUrl + path, {
      headers: { Authorization: "Bearer " + idToken },
      cache: "no-store",
    });

    if (lastResponse.status !== 404 && lastResponse.status !== 503) {
      return lastResponse;
    }

    if (attempt < 6) {
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }

  return lastResponse;
}

const user = await adminUser();
if (!user) {
  console.log(
    "No permanent Primetime admin is visible in the live Firebase project; skipping authenticated live/HHA verification.",
  );
  process.exit(0);
}
const idToken = await firebaseIdToken(user);

const sessionResponse = await protectedGet("/primetime/api/session", idToken);
const session = await sessionResponse.json().catch(() => ({}));

if (
  !sessionResponse.ok ||
  session?.ok !== true ||
  !Array.isArray(session?.roles) ||
  !session.roles.includes("admin")
) {
  throw new Error(
    "Protected Primetime session verification failed: HTTP " +
      sessionResponse.status,
  );
}

console.log("Protected Primetime session route verified.");

const healthResponse = await protectedGet("/primetime/api/hha/health", idToken);
const health = await healthResponse.json().catch(() => ({}));

if (!healthResponse.ok || health?.ok !== true) {
  console.error("HHA health verification failed.", {
    httpStatus: healthResponse.status,
    hhaConnection: health?.hhaConnection ?? "unknown",
    operation: health?.operation ?? "unknown",
    applicationStatus: health?.applicationStatus ?? "unknown",
    errorKind: health?.errorKind ?? "unknown",
    errorId: health?.errorId ?? null,
    correlationId: health?.correlationId ?? null,
  });
  process.exit(1);
}

console.log("HHA read-only connectivity verified.", {
  operation: health.operation,
  hhaConnection: health.hhaConnection,
  referenceCount: health.referenceCount,
  correlationId: health.correlationId,
});
