const { initializeApp: initializeClient } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');
const { getFirestore } = require('firebase/firestore');
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');

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
    
    console.log(`Attempting to sign in as ${adminEmail}...`);
    const result = await signInWithEmailAndPassword(clientAuth, adminEmail, adminPassword);
    const user = result.user;
    console.log("Sign in successful!");
    
    console.log("Retrieving ID token...");
    const idToken = await user.getIdToken(true);
    console.log("ID token retrieved.");
    
    console.log("Creating dummy CSV file...");
    const csvContent = `Name,Email,Mobile,Role,Department,Designation,Joining Date,Employee Type,Location ID
Bulk One,bulk1_${Date.now()}@avenir.com,+91-9988771111,employee,Engineering,Software Engineer,2025-01-01,permanent,loc_1
Bulk Two,bulk2_${Date.now()}@avenir.com,+91-9988772222,employee,Marketing,Marketing Manager,2025-01-02,permanent,loc_2`;
    fs.writeFileSync('test_bulk.csv', csvContent);
    
    console.log("Sending POST request to bulk-upload API...");
    const formData = new FormData();
    const blob = new Blob([csvContent], { type: 'text/csv' });
    formData.append('file', blob, 'test_bulk.csv');
    
    const response = await fetch("http://localhost:3000/api/admin/bulk-upload", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${idToken}`
        },
        body: formData
    });
    
    console.log(`Response status: ${response.status}`);
    const body = await response.json();
    console.log("Response body:", JSON.stringify(body, null, 2));
    
    if (fs.existsSync('test_bulk.csv')) {
        fs.unlinkSync('test_bulk.csv');
    }
}

runTest().catch(err => {
    console.error("Test execution failed:", err);
    if (fs.existsSync('test_bulk.csv')) {
        fs.unlinkSync('test_bulk.csv');
    }
    process.exit(1);
});
