import { collection, getDocs, query, orderBy, limit } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { getFunctions, httpsCallable } from "firebase/functions";

export type BackupStatus = "completed" | "failed" | "in_progress";

export interface BackupRecord {
  id?: string;
  startedAt: unknown;
  completedAt: unknown;
  status: BackupStatus;
  sizeBytes: number;
  durationMs: number;
  initiatedBy: "manual" | "scheduled";
  operatorId: string;
  operatorName: string;
}

export async function getBackupHistory(limitCount = 10): Promise<BackupRecord[]> {
  const coll = collection(db, "backups");
  const q = query(coll, orderBy("startedAt", "desc"), limit(limitCount));
  const snap = await getDocs(q);
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as BackupRecord));
}

export async function triggerBackup(operatorId: string, operatorName: string): Promise<string> {
  // operatorId and operatorName are reserved for future audit enrichment
  void operatorId;
  void operatorName;
  const functions = getFunctions(auth.app);
  const trigger = httpsCallable<Record<string, never>, { operationName?: string }>(functions, "triggerManualBackup");
  
  try {
    const result = await trigger({});
    return result.data.operationName || "started";
  } catch (error: unknown) {
    const err = error as Error;
    console.error("Failed to trigger backup", err);
    throw new Error(err.message || "Failed to trigger backup");
  }
}
