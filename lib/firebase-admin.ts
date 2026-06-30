import * as admin from 'firebase-admin';

if (!admin.apps.length) {
    const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;
    const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "company-portal-6ec50";

    const isEmulator = process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST;

    if (serviceAccountKey) {
        try {
            const serviceAccount = JSON.parse(serviceAccountKey);
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
                projectId: projectId
            });
        } catch (e) {
            console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY:", e);
            admin.initializeApp({ projectId });
        }
    } else if (clientEmail && privateKey) {
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: projectId,
                clientEmail: clientEmail,
                privateKey: privateKey.replace(/\\n/g, '\n'),
            }),
            projectId: projectId
        });
    } else {
        if (isEmulator) {
            admin.initializeApp({ projectId });
        } else {
            console.warn(`Firebase Admin SDK: Fallback initialization with projectId "${projectId}" due to missing service account credentials.`);
            admin.initializeApp({ projectId });
        }
    }
}

export const adminAuth = admin.auth();
export const adminDb = admin.firestore();
