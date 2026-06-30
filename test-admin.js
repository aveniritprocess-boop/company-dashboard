const admin = require('firebase-admin');
require('dotenv').config({ path: '.env.local' });

async function test() {
  try {
    const privateKey = process.env.FIREBASE_PRIVATE_KEY
      ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
      : undefined;

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: privateKey,
      }),
    });
    
    // Actually make a request to verify credentials
    await admin.firestore().collection('users').limit(1).get();
    console.log("SUCCESS: Firebase Admin SDK is fully authenticated!");
  } catch (error) {
    console.error("FAIL: Firebase Admin SDK failed to authenticate:", error);
  }
}
test();
