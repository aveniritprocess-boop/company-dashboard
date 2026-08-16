import { logActivityClient } from "@/lib/audit-client";

export interface RestorePreview {
  backupId: string;
  collections: string[];
  estimatedDocs: number;
  estimatedSize: string;
  simulated: true;
}

export interface DryRunResult {
  conflicts: number;
  overwrites: number;
  newDocs: number;
  passed: boolean;
  simulated: true;
}

export interface RestoreResult {
  success: boolean;
  simulated: true;
}

export async function previewBackup(backupId: string): Promise<RestorePreview> {
  // SIMULATION MODE
  // In a real environment, this would list the GCP Bucket contents and parse metadata
  await new Promise(r => setTimeout(r, 1000));

  return {
    backupId,
    collections: ["users", "tasks", "attendance", "audit_logs", "projects", "teams", "leaves", "notifications"],
    estimatedDocs: Math.floor(Math.random() * 5000) + 1000,
    estimatedSize: `${(Math.random() * 10 + 5).toFixed(1)} MB`,
    simulated: true,
  };
}

export async function runRestoreDryRun(backupId: string, collections: string[]): Promise<DryRunResult> {
  // SIMULATION MODE
  console.log(`Simulating dry run for ${backupId} over ${collections.length} collections`);
  await new Promise(r => setTimeout(r, 2000));

  return {
    conflicts: Math.floor(Math.random() * 5),
    overwrites: Math.floor(Math.random() * 100) + 50,
    newDocs: Math.floor(Math.random() * 20),
    passed: true,
    simulated: true,
  };
}

/**
 * SIMULATION MODE — no real backup restoration is implemented. This never
 * touches Firestore or GCS; it only sleeps and logs a clearly-labeled
 * simulated audit entry. Blocked entirely in production so a real incident
 * can never be met with a false "restore completed" result.
 */
export async function executeRestore(backupId: string, collections: string[], operatorId: string, operatorName: string): Promise<RestoreResult> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Restore is not implemented — this feature is simulated only and is disabled in production to prevent a false sense of disaster-recovery coverage.");
  }

  await logActivityClient({
    action: "restore_simulated_started",
    performedBy: operatorId,
    performedByName: operatorName,
    targetId: backupId,
    targetType: "backup",
    details: `SIMULATED restore started for backup ${backupId} (collections: ${collections.join(", ")}). No real data was read or written — this feature is not implemented.`,
    severity: "critical"
  });

  await new Promise(r => setTimeout(r, 4000));

  await logActivityClient({
    action: "restore_simulated_completed",
    performedBy: operatorId,
    performedByName: operatorName,
    targetId: backupId,
    targetType: "backup",
    details: `SIMULATED restore finished for ${collections.length} collections. No real data was modified — this feature is not implemented.`,
    severity: "critical"
  });

  return { success: true, simulated: true };
}
