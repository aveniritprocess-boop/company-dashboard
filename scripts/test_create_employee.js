const { initializeApp: initializeClient } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } = require('firebase/auth');
const { getFirestore, doc, setDoc } = require('firebase/firestore');
require('dotenv').config({ path: '.env.local' });

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const clientApp = initializeClient(firebaseConfig);
const clientAuth = getAuth(clientApp);
const clientDb = getFirestore(clientApp);

async function runTest() {
    const adminEmail = "test_admin@avenir.com";
    const adminPassword = "Password123!";
    
    let user;
    try {
        console.log(`Attempting to sign in as ${adminEmail}...`);
        const result = await signInWithEmailAndPassword(clientAuth, adminEmail, adminPassword);
        user = result.user;
        console.log("Sign in successful!");
    } catch (err) {
        if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
            console.log(`User not found. Registering new account for ${adminEmail}...`);
            const result = await createUserWithEmailAndPassword(clientAuth, adminEmail, adminPassword);
            user = result.user;
            console.log("Registration successful!");
        } else {
            throw err;
        }
    }
    
    console.log(`Elevating role of ${adminEmail} to admin in Firestore...`);
    await setDoc(doc(clientDb, "users", user.uid), {
        uid: user.uid,
        name: "Test Admin",
        email: adminEmail,
        role: "admin",
        is_active: true,
        portal_access: true,
        is_locked: false,
        is_deleted: false,
        created_at: new Date(),
        updated_at: new Date()
    }, { merge: true });
    console.log("Role elevated successfully!");
    
    console.log("Retrieving ID token...");
    const idToken = await user.getIdToken(true);
    console.log("ID token retrieved.");
    
    console.log("Sending POST request to create-employee API...");
    const newEmployeeEmail = `test_emp_${Date.now()}@avenir.com`;
    const payload = {
        email: newEmployeeEmail,
        password: "TempPassword123!",
        name: "Test Employee",
        mobile: "+1 555-9999",
        role: "employee",
        reporting_manager_id: user.uid,
        department: "Engineering",
        location: "Singapore",
        location_id: "loc_3",
        employee_id: "EMP-" + Math.floor(1000 + Math.random() * 9000),
        is_active: true,
        portal_access: true,
        is_locked: false,
        designation: "Software Engineer",
        joining_date: "2025-06-10",
        employee_type: "permanent",
        address: "123 Singapore Way",
        emergency_contact: {
            name: "Emergency Contact",
            relationship: "Spouse",
            mobile: "+1 555-8888"
        },
        profile_photo: "",
        gender: "male",
        status: "active"
    };
    
    const response = await fetch("http://localhost:3000/api/admin/create-employee", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${idToken}`
        },
        body: JSON.stringify(payload)
    });
    
    console.log(`Response status: ${response.status}`);
    const body = await response.json();
    console.log("Response body:", body);
}

runTest().catch(err => {
    console.error("Test execution failed:", err);
    process.exit(1);
});
