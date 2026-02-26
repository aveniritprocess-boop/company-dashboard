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

async function dump() {
    console.log("--- USERS ---");
    const userSnap = await getDocs(collection(db, "users"));
    userSnap.forEach(doc => {
        const data = doc.data();
        console.log(`[USER] UID: ${doc.id}, Email: ${data.email}, Role: ${data.role}`);
    });

    console.log("\n--- TASKS ---");
    const taskSnap = await getDocs(collection(db, "tasks"));
    taskSnap.forEach(doc => {
        const data = doc.data();
        console.log(`[TASK] ID: ${doc.id}, To: ${data.assignedTo}, By: ${data.assignedBy}, Text: ${data.taskText}`);
    });
    process.exit(0);
}

dump();
