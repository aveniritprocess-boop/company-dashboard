const { initializeApp } = require('firebase/app');
const { getFirestore, doc, updateDoc, getDoc } = require('firebase/firestore');

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

async function verifyCompletion() {
    const taskId = "7d65BfZ3afIkA"; // ID from previous test output
    const taskRef = doc(db, "tasks", taskId);

    await updateDoc(taskRef, {
        status: "completed"
    });

    const snap = await getDoc(taskRef);
    console.log(`Updated Task Status: ${snap.data().status}`);
    process.exit(0);
}

verifyCompletion();
