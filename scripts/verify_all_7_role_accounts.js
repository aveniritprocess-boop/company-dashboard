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

const auth = admin.auth();
const db = admin.firestore();

async function inspectAllUsers() {
    console.log("==========================================");
    console.log("FIRESTORE & AUTH USER ACCOUNT VERIFICATION");
    console.log("==========================================");
    
    const snap = await db.collection("users").get();
    const results = [];

    for (const docSnap of snap.docs) {
        const d = docSnap.data();
        let authExists = false;
        let authEmail = null;
        try {
            const userRec = await auth.getUser(docSnap.id);
            authExists = true;
            authEmail = userRec.email;
        } catch (e) {
            if (d.email) {
                try {
                    const userRec = await auth.getUserByEmail(d.email);
                    authExists = true;
                    authEmail = userRec.email;
                } catch (e2) {
                    authExists = false;
                }
            }
        }
        results.push({
            uid: docSnap.id,
            name: d.name || d.displayName || "Unknown",
            email: d.email || authEmail,
            role: d.role,
            is_active: d.is_active ?? true,
            is_locked: d.is_locked ?? false,
            is_deleted: d.is_deleted ?? false,
            portal_access: d.portal_access ?? true,
            authExists
        });
    }

    console.table(results);
    process.exit(0);
}

inspectAllUsers().catch(err => {
    console.error(err);
    process.exit(1);
});
