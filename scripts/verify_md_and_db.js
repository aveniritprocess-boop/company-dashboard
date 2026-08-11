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

async function inspectMDAndDB() {
    console.log("==========================================");
    console.log("1. SPECIFIC INSPECTION: MD ACCOUNT (DPS SIR)");
    console.log("==========================================");
    
    const mdEmail = "avenirdps@gmail.com";
    let authUser = null;
    try {
        authUser = await auth.getUserByEmail(mdEmail);
        console.log("Firebase Auth User Found:");
        console.log("  UID           :", authUser.uid);
        console.log("  Email         :", authUser.email);
        console.log("  DisplayName   :", authUser.displayName);
        console.log("  Disabled      :", authUser.disabled);
        console.log("  EmailVerified :", authUser.emailVerified);
    } catch (e) {
        console.log("Firebase Auth User NOT found for", mdEmail, ":", e.message);
    }

    if (authUser) {
        const uid = authUser.uid;
        console.log("\nFirestore users/{uid} Lookup (UID:", uid, "):");
        const userDoc = await db.collection("users").doc(uid).get();
        if (userDoc.exists) {
            const data = userDoc.data();
            console.log("  Doc Exists      : TRUE");
            console.log("  Role            :", data.role);
            console.log("  is_active       :", data.is_active);
            console.log("  portal_access   :", data.portal_access);
            console.log("  is_locked       :", data.is_locked);
            console.log("  is_deleted      :", data.is_deleted);
            console.log("  status          :", data.status);
            console.log("  must_change_pass:", data.must_change_password);
        } else {
            console.log("  Doc Exists      : FALSE!");
        }

        console.log("\nFirestore employee_directory/{uid} Lookup (UID:", uid, "):");
        const empDoc = await db.collection("employee_directory").doc(uid).get();
        if (empDoc.exists) {
            const data = empDoc.data();
            console.log("  Emp Doc Exists  : TRUE");
            console.log("  Role            :", data.role);
            console.log("  is_active       :", data.is_active);
            console.log("  portal_access   :", data.portal_access);
            console.log("  status          :", data.status);
            console.log("  is_deleted      :", data.is_deleted);
        } else {
            console.log("  Emp Doc Exists  : FALSE!");
        }
    }

    console.log("\n==========================================");
    console.log("2. ALL TEST ACCOUNTS CHECK");
    console.log("==========================================");

    const testEmails = [
        { label: "CEO", email: "avenir.itprocess@gmail.com" },
        { label: "MD (DPS Sir)", email: "avenirdps@gmail.com" },
        { label: "Rajni Kant", email: "admin.avenir@gmail.com" },
        { label: "Employee (Devraj)", email: "devavenirgroup.2017@gmail.com" },
        { label: "Employee (Jyoti)", email: "mktg@avenirgroup.in" },
        { label: "Admin/Tech (Ravi)", email: "avenirravi@gmail.com" }
    ];

    for (const item of testEmails) {
        console.log(`\n--- [${item.label}] Email: ${item.email} ---`);
        try {
            const u = await auth.getUserByEmail(item.email);
            const userSnap = await db.collection("users").doc(u.uid).get();
            const empSnap = await db.collection("employee_directory").doc(u.uid).get();

            console.log(`Auth UID: ${u.uid} | Disabled: ${u.disabled}`);
            if (userSnap.exists) {
                const ud = userSnap.data();
                console.log(`  'users' doc: role=${ud.role}, active=${ud.is_active}, portal=${ud.portal_access}, locked=${ud.is_locked}, deleted=${ud.is_deleted}`);
            } else {
                console.log(`  'users' doc: MISSING`);
            }
            if (empSnap.exists) {
                const ed = empSnap.data();
                console.log(`  'employee_directory' doc: role=${ed.role}, active=${ed.is_active}, portal=${ed.portal_access}, status=${ed.status}`);
            } else {
                console.log(`  'employee_directory' doc: MISSING`);
            }
        } catch (err) {
            console.log(`  Error querying ${item.email}:`, err.message);
        }
    }

    process.exit(0);
}

inspectMDAndDB().catch(err => {
    console.error(err);
    process.exit(1);
});
