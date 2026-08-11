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

async function checkAllRoles() {
    const rolesToCheck = [
        { roleName: "CEO", email: "avenir.itprocess@gmail.com" },
        { roleName: "MD", email: "avenirdps@gmail.com" },
        { roleName: "Admin", email: "himanshusharma34336@gmail.com" },
        { roleName: "Manager", email: "admin.avenir@gmail.com" },
        { roleName: "Team Lead", email: "sneha.singh@example.com" },
        { roleName: "HR", email: "priya.verma@example.com" },
        { roleName: "Employee", email: "devavenirgroup.2017@gmail.com" },
    ];

    for (const r of rolesToCheck) {
        try {
            const userRec = await auth.getUserByEmail(r.email);
            const userDoc = await db.collection("users").doc(userRec.uid).get();
            const docData = userDoc.data();
            console.log(`[${r.roleName}] Email: ${r.email} | Auth UID: ${userRec.uid} | Firestore Role: ${docData?.role}`);
        } catch (e) {
            console.log(`[${r.roleName}] Email: ${r.email} | ERROR: ${e.message}`);
        }
    }
    process.exit(0);
}

checkAllRoles();
