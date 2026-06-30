import { randomUUID } from "crypto";
import { adminDb } from "@/lib/firebase-admin";
import * as admin from "firebase-admin";

export type AuditSeverity = "info" | "warning" | "critical";

export interface LogActivityServerParams {
  action: string;
  performedBy: string;
  performedByName: string;
  targetId: string;
  targetType: "user" | "task" | "leave" | "attendance" | "project" | "team" | "settings" | "role" | "system" | "backup";
  details: string;
  severity?: AuditSeverity;
  correlationId?: string;
  metadata?: {
    before?: Record<string, unknown> | null;
    after?: Record<string, unknown> | null;
    [key: string]: unknown;
  };
  ip?: string | null;
  browser?: string | null;
  device?: string | null;
  userAgent?: string | null;
}

// Maps action names to default severity levels on server
export function getDefaultSeverityServer(action: string): AuditSeverity {
  const warnings = ["role_change", "employee_updated", "settings_changed"];
  const criticals = ["employee_deleted", "permission_change", "task_deleted", "project_deleted", "team_deleted"];
  
  if (warnings.includes(action)) return "warning";
  if (criticals.includes(action)) return "critical";
  return "info";
}

/**
 * Logs a business action activity to the `audit_logs` collection from the server.
 * Uses Admin SDK to bypass security rules and write server timestamps.
 * 
 * Retention Target:
 * - Critical events: 7 years
 * - Security events: 3 years
 * - Operational events: 2 years
 * (Scheduled Cloud Function archives old logs to Cloud Storage)
 */
export async function logActivityServer(params: LogActivityServerParams): Promise<string | null> {
  try {
    const severity = params.severity || getDefaultSeverityServer(params.action);
    const now = admin.firestore.FieldValue.serverTimestamp();
    const correlationId = params.correlationId || randomUUID();

    const docRef = await adminDb.collection("audit_logs").add({
      // New Schema
      action: params.action,
      performedBy: params.performedBy,
      performedByName: params.performedByName,
      targetId: params.targetId,
      targetType: params.targetType,
      severity,
      correlationId,
      source: "server",
      version: 1,
      metadata: params.metadata || {},
      createdAt: now,
      
      // Backward compatibility fields for UI
      operator_id: params.performedBy,
      operator_name: params.performedByName,
      details: params.details,
      timestamp: now,
      ip: params.ip || "127.0.0.1",
      browser: params.browser || "Chrome",
      device: params.device || "Desktop",
      userAgent: params.userAgent || ""
    });

    return docRef.id;
  } catch (error) {
    console.error("Failed to log activity from server:", error);
    return null;
  }
}
