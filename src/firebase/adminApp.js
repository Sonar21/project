import admin from "firebase-admin";
import fs from "fs";

let serviceAccount = null;
try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const p = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (fs.existsSync(p)) {
      serviceAccount = JSON.parse(fs.readFileSync(p, "utf8"));
    }
  }
} catch (e) {
  console.error("Failed to parse Firebase service account:", e);
}

if (!admin.apps.length) {
  if (serviceAccount) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  } else {
    // Try application default credentials (e.g. when GOOGLE_APPLICATION_CREDENTIALS is set)
    admin.initializeApp();
  }
}

export const adminDb = admin.firestore();
export default admin;
