const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, query, where } = require('firebase/firestore');

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

async function check() {
    const emails = ["test_emp_verification@example.com", "admin_test_verification@example.com"];
    for (const email of emails) {
        const q = query(collection(db, "users"), where("email", "==", email));
        const snap = await getDocs(q);
        if (!snap.empty) {
            const uid = snap.docs[0].id;
            console.log(`Email: ${email} -> UID: ${uid}`);

            const tq = query(collection(db, "tasks"), where("assignedTo", "==", uid));
            const tsnap = await getDocs(tq);
            console.log(`Tasks assigned TO ${email}: ${tsnap.docs.length}`);
            tsnap.forEach(t => console.log(`  - TaskID: ${t.id}, Text: ${t.data().taskText}`));
        } else {
            console.log(`Email: ${email} -> NOT FOUND`);
        }
    }
    process.exit(0);
}

check();
