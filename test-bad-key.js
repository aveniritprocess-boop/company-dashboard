const admin = require('firebase-admin');

async function test() {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: "company-portal-6ec50",
        clientEmail: "firebase-adminsdk-fbsvc@company-portal-6ec50.iam.gserviceaccount.com",
        privateKey: "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDD5WR85Q8B0VN9INVALIDKEY123\n-----END PRIVATE KEY-----\n",
      }),
    });
    await admin.firestore().collection('users').limit(1).get();
  } catch (error) {
    console.error("FAIL:", error.message);
  }
}
test();
