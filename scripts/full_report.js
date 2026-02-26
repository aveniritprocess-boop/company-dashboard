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

async function listAll() {
    const snap = await getDocs(collection(db, "users"));
    console.log(`TOTAL_USERS: ${snap.docs.length}`);
    snap.forEach(doc => {
        const data = doc.data();
        console.log(`USER_ENTRY|UID:${doc.id}|Email:${data.email}|Name:${data.name || data.displayName}`);
    });

    const tsnap = await getDocs(collection(db, "tasks"));
    console.log(`TOTAL_TASKS: ${tsnap.docs.length}`);
    tsnap.forEach(doc => {
        const data = doc.data();
        console.log(`TASK_ENTRY|ID:${doc.id}|To:${data.assignedTo}|By:${data.assignedBy}|Text:${data.taskText}`);
    });
    process.exit(0);
}

listAll();
