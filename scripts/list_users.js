const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

const firebaseConfig = {
    apiKey: "AIzaSyAnzO0Rfd2B_iL3Nr5kFjTWueJtwo-fv4c",
    authDomain: "company-portal-6ec50.firebaseapp.com",
    projectId: "company-portal-6ec50",
    storageBucket: "company-portal-6ec50.firebasestorage.app",
    messagingSenderId: "532178574171",
    appId: "1:532178574171:web:30db84244a9da95e30187e",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function listUsers() {
    const snap = await getDocs(collection(db, "users"));
    if (snap.empty) {
        console.log("No users found.");
    } else {
        snap.forEach(doc => {
            const data = doc.data();
            console.log(`UID: ${doc.id}, Email: ${data.email}, Name: ${data.name || data.displayName}, Role: ${data.role}`);
        });
    }
    process.exit(0);
}

listUsers();
