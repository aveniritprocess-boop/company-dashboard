import { logActivityClient } from "@/lib/audit-client";

export interface VerifyResult {
  success: boolean;
  simulated: true;
}

/**
 * SIMULATION MODE — no real backup verification is implemented. This never
 * inspects Cloud Storage; it only sleeps and logs a clearly-labeled
 * simulated audit entry. Not currently wired up to any UI action.
 */
export async function verifyBackup(backupId: string, operatorId: string, operatorName: string): Promise<VerifyResult> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Backup verification is not implemented — this feature is simulated only and is disabled in production to prevent a false sense of disaster-recovery coverage.");
  }

  await logActivityClient({
    action: "backup_verify_simulated",
    performedBy: operatorId,
    performedByName: operatorName,
    targetId: backupId,
    targetType: "backup",
    details: `SIMULATED verification of backup ${backupId}. No real integrity check was performed — this feature is not implemented.`,
    severity: "info"
  });

  await new Promise(r => setTimeout(r, 1500));

  return { success: true, simulated: true };
}
