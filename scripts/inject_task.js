const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc, serverTimestamp } = require('firebase/firestore');

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

async function injectTask() {
    const employeeUid = "830IzNXeUZSrqKvi"; // From find_uids.js output for test_emp_verification@example.com
    const adminUid = "m9GCit32FOWD"; // From find_uids.js output for admin_test_verification@example.com

    await addDoc(collection(db, "tasks"), {
        taskText: "Manual verification task for employee view",
        assignedTo: employeeUid,
        assignedBy: adminUid,
        status: "pending",
        createdAt: serverTimestamp()
    });

    console.log("Task injected successfully.");
    process.exit(0);
}

injectTask();
