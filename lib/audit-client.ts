import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

export type AuditSeverity = "info" | "warning" | "critical";

export interface LogActivityClientParams {
  action: string;
  performedBy: string;
  performedByName: string;
  targetId: string;
  targetType: "user" | "task" | "leave" | "attendance" | "project" | "team" | "settings" | "role" | "system" | "backup";
  details: string;
  severity?: AuditSeverity;
  correlationId?: string;
  metadata?: Record<string, unknown>;
}

// Maps action names to default severity levels
export function getDefaultSeverity(action: string): AuditSeverity {
  const warnings = ["role_change", "employee_updated", "settings_changed"];
  const criticals = ["employee_deleted", "permission_change", "task_deleted", "project_deleted", "team_deleted"];
  
  if (warnings.includes(action)) return "warning";
  if (criticals.includes(action)) return "critical";
  return "info";
}

/**
 * Logs a business action activity to the `audit_logs` collection from the client.
 * Enforces security constraints like setting client IP to null.
 * 
 * Retention Target:
 * - Critical events: 7 years
 * - Security events: 3 years
 * - Operational events: 2 years
 * (Scheduled Cloud Function archives old logs to Cloud Storage)
 */
export async function logActivityClient(params: LogActivityClientParams): Promise<string | null> {
  try {
    const severity = params.severity || getDefaultSeverity(params.action);
    const userAgent = typeof window !== "undefined" ? window.navigator.userAgent : "Unknown";
    
    // Parse browser name from User-Agent safely on client
    let browser = "Other";
    if (userAgent.includes("Firefox")) {
      browser = "Firefox";
    } else if (userAgent.includes("Chrome") && !userAgent.includes("Chromium")) {
      browser = "Chrome";
    } else if (userAgent.includes("Safari") && !userAgent.includes("Chrome")) {
      browser = "Safari";
    } else if (userAgent.includes("Edge")) {
      browser = "Edge";
    }
    
    let device = "Desktop";
    if (/mobi|android|iphone|ipad|ipod/i.test(userAgent)) {
      device = "Mobile/Tablet";
    }

    const correlationId = params.correlationId || (
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
            const r = (Math.random() * 16) | 0;
            const v = c === "x" ? r : (r & 0x3) | 0x8;
            return v.toString(16);
          })
    );

    const docRef = await addDoc(collection(db, "audit_logs"), {
      // New Schema
      action: params.action,
      performedBy: params.performedBy,
      performedByName: params.performedByName,
      targetId: params.targetId,
      targetType: params.targetType,
      severity,
      correlationId,
      source: "client",
      version: 1,
      metadata: params.metadata || {},
      createdAt: serverTimestamp(),
      
      // Backward compatibility fields for UI
      operator_id: params.performedBy,
      operator_name: params.performedByName,
      details: params.details,
      timestamp: serverTimestamp(),
      ip: null, // Do not trust client-supplied IP addresses
      browser,
      device,
      userAgent
    });

    return docRef.id;
  } catch (error) {
    console.error("Failed to log activity from client:", error);
    return null;
  }
}
