const { initializeApp } = require('firebase/app');
const { getFirestore, collection, query, where, onSnapshot } = require('firebase/firestore');

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

function subscribe(uid) {
    console.log(`Subscribing to tasks for UID: ${uid}`);
    const q = query(collection(db, "tasks"), where("assignedTo", "==", uid));

    const unsub = onSnapshot(q, (snap) => {
        console.log(`Snapshot received! Count: ${snap.docs.length}`);
        snap.forEach(doc => {
            console.log(`TaskID: ${doc.id}, Text: ${doc.data().taskText}, Status: ${doc.data().status}`);
        });
        // Exit after first snapshot for this test
        process.exit(0);
    }, (err) => {
        console.error("Snapshot error:", err);
        process.exit(1);
    });
}

subscribe("830IzNXeUZSrqKvi"); // test_emp_verification@example.com
