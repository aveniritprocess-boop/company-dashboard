import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { v1 } from "@google-cloud/firestore";

admin.initializeApp();

const client = new v1.FirestoreAdminClient();

// Daily automated backup at 00:00 UTC
export const scheduledFirestoreExport = functions.pubsub
  .schedule("0 0 * * *")
  .timeZone("UTC")
  .onRun(async (context) => {
    const projectId = process.env.GCP_PROJECT || process.env.GCLOUD_PROJECT;
    if (!projectId) {
      console.error("Missing Project ID");
      return null;
    }

    const databaseName = client.databasePath(projectId, "(default)");
    const bucketName = `gs://${projectId}-firestore-backups`;
    
    const timestamp = new Date().toISOString();
    const outputUriPrefix = `${bucketName}/auto_${timestamp}`;
    
    try {
      const [operation] = await client.exportDocuments({
        name: databaseName,
        outputUriPrefix: outputUriPrefix,
        // Leave collectionIds empty to export all collections
        collectionIds: [],
      });
      
      console.log(`Backup started successfully. Operation Name: ${operation.name}`);
      
      // Log to the "backups" collection for the UI
      await admin.firestore().collection("backups").add({
        startedAt: admin.firestore.FieldValue.serverTimestamp(),
        completedAt: null,
        status: "in_progress",
        sizeBytes: 0,
        durationMs: 0,
        initiatedBy: "scheduled",
        operatorId: "system",
        operatorName: "Cloud Scheduler",
        operationName: operation.name,
        outputUriPrefix: outputUriPrefix
      });
      
      return operation;
    } catch (err) {
      console.error("Backup failed", err);
      throw err;
    }
  });

// HTTP triggered backup (for manual triggers from the Admin Dashboard)
export const triggerManualBackup = functions.https.onCall(async (data, context) => {
  // 1. Authenticate user and verify admin role
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be authenticated");
  }
  
  const callerUid = context.auth.uid;
  const userDoc = await admin.firestore().collection("users").doc(callerUid).get();
  const userData = userDoc.data();
  if (!userData || (userData.role !== "Admin" && userData.role !== "CEO")) {
    throw new functions.https.HttpsError("permission-denied", "User must be an Admin");
  }

  const projectId = process.env.GCP_PROJECT || process.env.GCLOUD_PROJECT;
  if (!projectId) {
    throw new functions.https.HttpsError("internal", "Missing Project ID");
  }

  const databaseName = client.databasePath(projectId, "(default)");
  const bucketName = `gs://${projectId}-firestore-backups`;
  
  const timestamp = new Date().toISOString();
  const outputUriPrefix = `${bucketName}/manual_${timestamp}`;
  
  try {
    const [operation] = await client.exportDocuments({
      name: databaseName,
      outputUriPrefix: outputUriPrefix,
      collectionIds: [],
    });
    
    // Log to "backups" collection
    await admin.firestore().collection("backups").add({
      startedAt: admin.firestore.FieldValue.serverTimestamp(),
      completedAt: null,
      status: "in_progress",
      sizeBytes: 0,
      durationMs: 0,
      initiatedBy: "manual",
      operatorId: callerUid,
      operatorName: userData.name || userData.email || "Unknown",
      operationName: operation.name,
      outputUriPrefix: outputUriPrefix
    });

    // Also write to audit log
    await admin.firestore().collection("audit_logs").add({
      action: "backup_started",
      performedBy: callerUid,
      performedByName: userData.name || "Unknown",
      targetId: "system",
      targetType: "backup",
      details: "Initiated manual Firestore backup via Cloud Function.",
      severity: "info",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
    
    return { success: true, operationName: operation.name, outputUriPrefix };
  } catch (err: any) {
    console.error("Manual Backup failed", err);
    throw new functions.https.HttpsError("internal", err.message || "Failed to trigger backup");
  }
});
