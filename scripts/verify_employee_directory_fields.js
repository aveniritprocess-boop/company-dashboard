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

const FORBIDDEN_SENSITIVE_FIELDS = [
    'salary',
    'mobile',
    'phone',
    'address',
    'emergency_contact',
    'twoFactorSecret',
    'must_change_password',
    'bank_details',
    'aadhar',
    'pan'
];

async function verifyEmpDirFields() {
    console.log("=== CHECKING EMPLOYEE DIRECTORY SENSITIVE FIELD EXPOSURE ===");
    const snap = await db.collection("employee_directory").get();
    let hasSensitiveExposure = false;

    snap.forEach(doc => {
        const data = doc.data();
        const keys = Object.keys(data);
        const exposed = keys.filter(k => FORBIDDEN_SENSITIVE_FIELDS.includes(k));
        if (exposed.length > 0) {
            console.error(`❌ SENSITIVE DATA EXPOSED in employee_directory/${doc.id}:`, exposed);
            hasSensitiveExposure = true;
        } else {
            console.log(`✅ employee_directory/${doc.id} contains safe fields only:`, keys.join(', '));
        }
    });

    if (hasSensitiveExposure) {
        console.error("\nResult: ❌ FAILED - Sensitive data exposed in employee_directory");
        process.exit(1);
    } else {
        console.log("\nResult: ✅ PASSED - No sensitive fields present in employee_directory!");
        process.exit(0);
    }
}

verifyEmpDirFields().catch(err => {
    console.error(err);
    process.exit(1);
});
