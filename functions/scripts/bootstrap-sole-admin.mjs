import { applicationDefault, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const projectId = "primetimehomehealthservices";
const app = initializeApp({
  credential: applicationDefault(),
  projectId,
});
const auth = getAuth(app);
const expectedUid = process.env.PRIMETIME_ADMIN_UID?.trim();
const expectedEmail = process.env.PRIMETIME_ADMIN_EMAIL?.trim().toLowerCase();
if (!expectedUid || !expectedEmail) {
  console.error("Set PRIMETIME_ADMIN_UID and PRIMETIME_ADMIN_EMAIL to the approved account before bootstrap.");
  process.exit(1);
}

const users = [];
let pageToken;

do {
  const page = await auth.listUsers(1000, pageToken);
  users.push(...page.users);
  pageToken = page.pageToken;
} while (pageToken);

const existingAdmins = users.filter(
  (user) => user.customClaims?.admin === true,
);

if (existingAdmins.length > 0) {
  console.error("Refusing bootstrap: an admin claim already exists; inspect access manually.");
  process.exit(1);
}

const matches = users.filter(
  (user) => user.uid === expectedUid && user.email?.toLowerCase() === expectedEmail,
);
if (matches.length !== 1) {
  console.error("Refusing bootstrap: approved UID and email do not identify the same user.");
  process.exit(1);
}

const [user] = matches;
if (!user || user.disabled) {
  console.error("Refusing admin bootstrap: approved Firebase Auth user is missing or disabled.");
  process.exit(1);
}

const hasPasswordProvider = user.providerData.some(
  (provider) => provider.providerId === "password",
);

if (!hasPasswordProvider) {
  console.error(
    "Refusing admin bootstrap: sole Firebase Auth user is not an Email/Password user.",
  );
  process.exit(1);
}

await auth.setCustomUserClaims(user.uid, {
  ...(user.customClaims ?? {}),
  admin: true,
  role:
    typeof user.customClaims?.role === "string"
      ? user.customClaims.role
      : "admin",
});

console.log("Primetime admin claim bootstrapped for the explicitly approved Auth user.");
console.log("UID:", user.uid);
