const { initializeApp } = require('firebase/app');
const { getFirestore, collection, query, where, getDocs, doc, updateDoc } = require('firebase/firestore');

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

const ROLES_TO_ASSIGN = [
    { email: "himanshusharma34336@gmail.com", role: "admin", name: "Himanshu Sharma" },
    // Add others here once their emails are known, or if they are already signed up.
    // Example:
    // { email: "dps@example.com", role: "ceo", name: "DPS" },
    // { email: "devraj@example.com", role: "manager", name: "Devraj Thakur" },
    // { email: "jyoti@example.com", role: "manager", name: "Jyoti Raghav" },
];

async function assignRoles() {
    for (const entry of ROLES_TO_ASSIGN) {
        const q = query(collection(db, "users"), where("email", "==", entry.email));
        const snap = await getDocs(q);

        if (!snap.empty) {
            const userDoc = snap.docs[0];
            await updateDoc(doc(db, "users", userDoc.id), {
                role: entry.role,
                name: entry.name // Ensure name is correct too
            });
            console.log(`Successfully assigned ${entry.role} role to ${entry.email} (${entry.name})`);
        } else {
            console.log(`User with email ${entry.email} not found. They must sign up first.`);
        }
    }
    process.exit(0);
}

assignRoles();
