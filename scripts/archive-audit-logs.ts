import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
        ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
        : undefined;

    const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "company-portal-6ec50";

    if (serviceAccount || (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY)) {
        admin.initializeApp({
            credential: serviceAccount
                ? admin.credential.cert(serviceAccount)
                : admin.credential.cert({
                    projectId: projectId,
                    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
                }),
        });
    } else {
        console.warn(`Firebase Admin SDK: Fallback initialization with projectId "${projectId}"`);
        admin.initializeApp({ projectId });
    }
}

const db = admin.firestore();

// ─── Dry-Run Flag ─────────────────────────────────────────────────────────
const isDryRun = process.argv.includes('--dry-run');
if (isDryRun) {
    console.log('⚠️  DRY RUN MODE ENABLED — No data will be modified.');
}

async function runArchive() {
    console.log("--------------------------------------------------");
    console.log("Starting Audit Log Retention & Archiving Routine");
    console.log("--------------------------------------------------");

    // 1. Calculate the 12-month cutoff date
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
    const cutoffTimestamp = admin.firestore.Timestamp.fromDate(twelveMonthsAgo);

    console.log(`Cutoff date set to: ${twelveMonthsAgo.toISOString()}`);
    console.log(`Archiving non-critical logs created BEFORE this date.`);

    let totalArchived = 0;
    let totalDeleted = 0;
    const archivedLogs: any[] = [];
    const BATCH_SIZE = 250;
    let hasMore = true;
    let lastDoc: admin.firestore.QueryDocumentSnapshot | null = null;

    // 2. Paginate/fetch logs in batches to prevent memory and firestore threshold limits
    while (hasMore) {
        let query = db.collection('audit_logs')
            .where('createdAt', '<', cutoffTimestamp)
            .orderBy('createdAt', 'asc')
            .limit(BATCH_SIZE);

        if (lastDoc) {
            query = query.startAfter(lastDoc);
        }

        const snapshot = await query.get();

        if (snapshot.empty) {
            hasMore = false;
            break;
        }

        console.log(`Fetched ${snapshot.size} candidate records for inspection...`);
        
        const batch = db.batch();
        let batchDeleteCount = 0;

        for (const doc of snapshot.docs) {
            const data = doc.data();
            
            // Check if log is critical; skip archiving/deleting if so
            if (data.severity === 'critical') {
                continue;
            }

            // Extract serializable data
            const logEntry = {
                id: doc.id,
                ...data,
                createdAt: data.createdAt ? (data.createdAt as admin.firestore.Timestamp).toDate().toISOString() : null,
                timestamp: data.timestamp ? (data.timestamp as admin.firestore.Timestamp).toDate().toISOString() : null,
            };

            archivedLogs.push(logEntry);
            totalArchived++;

            // Queue deletion (skipped in dry-run)
            if (!isDryRun) {
                batch.delete(doc.ref);
                batchDeleteCount++;
            } else {
                batchDeleteCount++; // count still tracked for reporting
            }
        }

        // Commit deletions for this batch
        if (batchDeleteCount > 0) {
            if (!isDryRun) {
                await batch.commit();
                totalDeleted += batchDeleteCount;
                console.log(`Successfully archived and purged ${batchDeleteCount} logs in this batch.`);
            } else {
                totalDeleted += batchDeleteCount;
                console.log(`[DRY RUN] Would delete ${batchDeleteCount} logs in this batch.`);
            }
        } else {
            console.log('No non-critical logs to delete in this batch.');
        }

        // Keep cursor page position
        lastDoc = snapshot.docs[snapshot.docs.length - 1];
        
        // If snapshot size is less than batch size, we've reached the end
        if (snapshot.size < BATCH_SIZE) {
            hasMore = false;
        }
    }

    console.log("--------------------------------------------------");
    console.log(`Retention scan complete.`);
    console.log(`Total logs archived: ${totalArchived}`);
    console.log(`Total logs deleted from Firestore: ${totalDeleted}`);

    // 3. Write archived logs to a local JSON file if any logs were archived
    if (archivedLogs.length > 0) {
        if (isDryRun) {
            console.log('--------------------------------------------------');
            console.log('[DRY RUN] Summary:');
            console.log(`[DRY RUN] Logs found:          ${totalArchived}`);
            console.log(`[DRY RUN] Will archive/delete: ${totalDeleted} (non-critical, older than 12 months)`);
            console.log(`[DRY RUN] Will keep:           ${totalArchived - totalDeleted} critical logs`);
            console.log('[DRY RUN] No data was modified. Re-run without --dry-run to execute.');
        } else {
            const archivesDir = path.join(process.cwd(), 'archives');
            if (!fs.existsSync(archivesDir)) {
                fs.mkdirSync(archivesDir);
            }

            const timestampStr = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `audit_logs_archive_${timestampStr}.json`;
            const filePath = path.join(archivesDir, filename);

            fs.writeFileSync(filePath, JSON.stringify(archivedLogs, null, 2), 'utf-8');
            console.log(`Archive file successfully written to: ${filePath}`);
        }
    } else {
        console.log('No logs were archived, skipping file write.');
    }
    console.log("--------------------------------------------------");
}

runArchive()
    .then(() => {
        console.log("Routine finished successfully.");
        process.exit(0);
    })
    .catch((err) => {
        console.error("Routine failed with error:", err);
        process.exit(1);
    });
