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

async function checkDuplicates() {
    const snap = await getDocs(collection(db, "users"));
    const nameMap = {};
    snap.forEach(doc => {
        const data = doc.data();
        const name = data.name || data.displayName || "Unknown";
        if (!nameMap[name]) nameMap[name] = [];
        nameMap[name].push({ uid: doc.id, email: data.email });
    });

    for (const name in nameMap) {
        if (nameMap[name].length > 1) {
            console.log(`DUPLICATE NAME: ${name}`);
            nameMap[name].forEach(u => console.log(`  - UID: ${u.uid}, Email: ${u.email}`));
        }
    }
    process.exit(0);
}

checkDuplicates();
