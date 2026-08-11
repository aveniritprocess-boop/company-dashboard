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

// Business mapping specified by client
const EXPECTED_BUSINESS_ROLES = {
    "devavenirgroup.2017@gmail.com": "Manager", // Devraj
    "avenir.rishi@gmail.com": "Manager",       // Rishi
    "mktg@avenirgroup.in": "AGM",               // Jyoti Mam
    "avenirjjm@gmail.com": "HR",                // Rupam Mam
    "avenirravi@gmail.com": "Admin",            // Ravi
    "avenir.itprocess@gmail.com": "CEO",        // Himanshu (CEO)
    "avenirdps@gmail.com": "MD",                // Dinesh Pratap Singh (MD)
    "himanshusharma34336@gmail.com": "Admin",   // Himanshu (Admin)
};

async function runFullAudit() {
    console.log("==================================================");
    console.log("FETCHING ALL AUTH USERS & FIRESTORE DOCUMENTS...");
    console.log("==================================================");

    // 1. Fetch all Firebase Auth Users
    const authUsers = [];
    let nextPageToken;
    do {
        const listUsersResult = await auth.listUsers(1000, nextPageToken);
        listUsersResult.users.forEach((userRecord) => {
            authUsers.push(userRecord);
        });
        nextPageToken = listUsersResult.pageToken;
    } while (nextPageToken);

    console.log(`Total Firebase Auth Users Found: ${authUsers.length}`);

    // 2. Fetch all Firestore /users Documents
    const firestoreUsersSnap = await db.collection("users").get();
    console.log(`Total Firestore User Documents Found: ${firestoreUsersSnap.docs.length}`);

    const firestoreMap = new Map();
    firestoreUsersSnap.docs.forEach((doc) => {
        firestoreMap.set(doc.id, doc.data());
    });

    const auditResults = [];

    // 3. Process 1-to-1 matching for all Auth Users
    let idx = 1;
    for (const authUser of authUsers) {
        const uid = authUser.uid;
        const email = authUser.email || "No Email";
        const docData = firestoreMap.get(uid);

        const personName = docData?.name || docData?.displayName || authUser.displayName || email.split("@")[0];
        const actualRole = docData?.role || "NOT_STORED";
        const expectedRole = EXPECTED_BUSINESS_ROLES[email] || (actualRole !== "NOT_STORED" ? actualRole : "Employee");

        const isActive = docData?.is_active ?? true;
        const isLocked = docData?.is_locked ?? false;
        const isDeleted = docData?.is_deleted ?? false;
        const portalAccess = docData?.portal_access ?? true;

        // Task Creation & Assignment Rules check:
        // Universal Task Creation is enabled for active portal users: isUserActive()
        const canCreateTask = (isActive && !isLocked && !isDeleted && portalAccess) ? "YES" : "NO";
        const canAssignTask = (isActive && !isLocked && !isDeleted && portalAccess) ? "YES" : "NO";

        const isMismatch = expectedRole.toLowerCase() !== actualRole.toLowerCase() && actualRole !== "NOT_STORED";

        auditResults.push({
            index: idx++,
            person: personName,
            email: email,
            uid: uid,
            actualRole: actualRole,
            expectedRole: expectedRole,
            roleMismatch: isMismatch ? "⚠️ MISMATCH" : "OK",
            active: isActive ? "YES" : "NO",
            locked: isLocked ? "YES" : "NO",
            deleted: isDeleted ? "YES" : "NO",
            portalAccess: portalAccess ? "YES" : "NO",
            createTask: canCreateTask,
            assignTask: canAssignTask,
            disabledInAuth: authUser.disabled ? "YES" : "NO"
        });
    }

    // Print Results
    console.log("\n==================================================");
    console.log("LIVE USER ACCOUNT & ROLE DIRECTORY");
    console.log("==================================================");
    console.log(JSON.stringify(auditResults, null, 2));

    process.exit(0);
}

runFullAudit().catch(err => {
    console.error("Audit error:", err);
    process.exit(1);
});
