const admin = require('firebase-admin');
require('dotenv').config({ path: '.env.local' });

if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
    });
} else {
    console.error("Missing credentials");
    process.exit(1);
}

const db = admin.firestore();

async function inspectRoles() {
    console.log("=== FIRESTORE 'users' COLLECTION ===");
    const snap = await db.collection("users").get();
    snap.forEach(doc => {
        const d = doc.data();
        console.log(`UID: ${doc.id} | Email: ${d.email} | Role: ${d.role} | Name: ${d.name || d.displayName}`);
    });
    process.exit(0);
}

inspectRoles().catch(err => {
    console.error(err);
    process.exit(1);
});
