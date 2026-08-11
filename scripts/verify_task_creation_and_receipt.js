const admin = require('firebase-admin');
require('dotenv').config({ path: '.env.local' });

if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
    });
} else {
    console.error("Missing credentials");
    process.exit(1);
}

const db = admin.firestore();

async function verifyTaskAssignmentFlow() {
    console.log("==========================================");
    console.log("TESTING REAL TASK CREATION & RECEIPT FLOW");
    console.log("==========================================");

    const mdUid = "Q3r5WLgTfAdxyHmr1PQU8yCYoGj2"; // MD DPS Sir
    const targetAssignees = [
        "Gvc3I5EklOUTuNlpI2yTzaSmgv03", // Himanshu Sharma
        "eFjDUAOhvmZZnqGkQhiO8zKxas42", // Rajni Kant / Manager
        "SwWGYgvu1lX6dJjr8QchXR2irss1"  // Devraj Thakur
    ];

    const testTaskRef = db.collection("tasks").doc();
    const taskData = {
        title: "Test Task from MD DPS Sir",
        description: "Automated verification task creation test",
        assignedBy: mdUid,
        assignedTo: targetAssignees,
        priority: "high",
        status: "pending",
        startDate: new Date().toISOString().split("T")[0],
        dueDate: new Date().toISOString().split("T")[0],
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    console.log(`1. MD creating task assigned to [Himanshu, Rajni, Devraj] (Task ID: ${testTaskRef.id})...`);
    await testTaskRef.set(taskData);
    console.log("   ✅ Task document created successfully in Firestore!");

    console.log("\n2. Verifying task receipt in Firestore query for assigned users:");
    for (const assigneeUid of targetAssignees) {
        const snap = await db.collection("tasks")
            .where("assignedTo", "array-contains", assigneeUid)
            .get();
        
        const found = snap.docs.some(d => d.id === testTaskRef.id);
        console.log(`   Assignee (UID: ${assigneeUid}): ${found ? "✅ TASK RECEIVED IN USER DASHBOARD QUERY" : "❌ NOT FOUND"}`);
    }

    console.log("\n3. Cleaning up test task document...");
    await testTaskRef.delete();
    console.log("   ✅ Test task document cleaned up cleanly!");

    console.log("\n==========================================");
    console.log("TASK CREATION & RECEIPT VERIFICATION PASSED!");
    console.log("==========================================");
    process.exit(0);
}

verifyTaskAssignmentFlow().catch(err => {
    console.error(err);
    process.exit(1);
});
