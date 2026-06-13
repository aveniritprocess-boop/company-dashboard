const admin = require('firebase-admin');
require('dotenv').config({ path: '.env.local' });

const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
    : undefined;

if (serviceAccount || (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY)) {
    admin.initializeApp({
        credential: serviceAccount
            ? admin.credential.cert(serviceAccount)
            : admin.credential.cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
            }),
    });
} else {
    console.error("Firebase Admin SDK not initialized: Missing credentials in environment variables.");
    process.exit(1);
}

const auth = admin.auth();
const db = admin.firestore();

async function makeCeo(email) {
    let uid;
    let userRecord;
    try {
        userRecord = await auth.getUserByEmail(email);
        uid = userRecord.uid;
        console.log(`User found in Auth with UID: ${uid}`);
    } catch (error) {
        if (error.code === 'auth/user-not-found') {
            console.log(`User not found in Auth. Creating user with email ${email}...`);
            userRecord = await auth.createUser({
                email: email,
                emailVerified: true,
                displayName: "CEO",
            });
            uid = userRecord.uid;
            console.log(`Created user in Auth with UID: ${uid}`);
        } else {
            console.error("Error fetching user from Auth:", error);
            process.exit(1);
        }
    }

    const userRef = db.collection("users").doc(uid);
    const docSnap = await userRef.get();

    if (docSnap.exists) {
        await userRef.update({
            role: "ceo",
            is_active: true,
            email: email
        });
        console.log(`Updated existing user document in Firestore to ceo.`);
    } else {
        await userRef.set({
            name: userRecord.displayName || "CEO",
            email: email,
            role: "ceo",
            is_active: true,
            created_at: admin.firestore.FieldValue.serverTimestamp(),
            updated_at: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`Created new user document in Firestore for ceo.`);
    }
    
    console.log("Successfully made the user CEO.");
    process.exit(0);
}

makeCeo("avenir.itprocess@gmail.com");
