export {};
const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

async function runHealthCheck() {
  console.log("Checking DR Infrastructure Health...");
  const snap = await db.collection("backups").orderBy("startedAt", "desc").limit(1).get();
  
  if (snap.empty) {
    console.error("CRITICAL: No backups found.");
    process.exit(1);
  }

  const latest = snap.docs[0].data();
  let backupTime;
  if (latest.startedAt.toDate) {
    backupTime = latest.startedAt.toDate();
  } else {
    backupTime = new Date(latest.startedAt);
  }
  
  const hoursSince = (Date.now() - backupTime.getTime()) / (1000 * 60 * 60);

  console.log(`Last backup was ${hoursSince.toFixed(1)} hours ago.`);
  
  if (hoursSince > 48) {
    console.error("WARNING: Last backup is over 48 hours old (RPO violation).");
    process.exit(1);
  }

  console.log("DR Infrastructure is Healthy.");
  process.exit(0);
}

runHealthCheck().catch(console.error);
