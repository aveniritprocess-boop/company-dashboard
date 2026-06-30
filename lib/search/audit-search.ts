import { collection, query, where, orderBy, getDocs, limit, startAfter, QueryDocumentSnapshot, Query, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { AuditSearchParams, SearchPage } from "./search-types";
import { AuditSearchSchema } from "@/lib/validators/search";
import { AuditSeverity } from "@/lib/audit-client";

export interface AuditLogEntry {
  id: string;
  action: string;
  performedBy: string;
  performedByName?: string;
  targetId?: string;
  targetType?: string;
  details?: string;
  severity?: AuditSeverity;
  source?: string;
  createdAt?: Timestamp;
  timestamp?: Timestamp;
  [key: string]: any; // eslint-disable-line @typescript-eslint/no-explicit-any
}


const AUDIT_COL = "audit_logs";

export function buildAuditQuery(params: AuditSearchParams): Query {
  const coll = collection(db, AUDIT_COL);
  let q = query(coll);

  if (params.severity !== "all") {
    q = query(q, where("severity", "==", params.severity));
  }

  if (params.action !== "all") {
    q = query(q, where("action", "==", params.action));
  }

  if (params.performedBy !== "all") {
    q = query(q, where("performedBy", "==", params.performedBy));
  }

  // Date filters (using createdAt only, standardized)
  if (params.datePreset !== "all") {
    const now = new Date();
    const cutoff = new Date();
    
    if (params.datePreset === "today") {
      cutoff.setHours(0, 0, 0, 0);
      q = query(q, where("createdAt", ">=", cutoff));
    } else if (params.datePreset === "7d") {
      cutoff.setDate(now.getDate() - 7);
      q = query(q, where("createdAt", ">=", cutoff));
    } else if (params.datePreset === "30d") {
      cutoff.setDate(now.getDate() - 30);
      q = query(q, where("createdAt", ">=", cutoff));
    } else if (params.datePreset === "custom") {
      if (params.dateFrom) {
        q = query(q, where("createdAt", ">=", new Date(params.dateFrom)));
      }
      if (params.dateTo) {
        const toDate = new Date(params.dateTo);
        toDate.setHours(23, 59, 59, 999);
        q = query(q, where("createdAt", "<=", toDate));
      }
    }
  }

  // Default ordering
  q = query(q, orderBy("createdAt", "desc"));

  return q;
}

function applyClientSideFilters(logs: AuditLogEntry[], params: AuditSearchParams): AuditLogEntry[] {
  let filtered = logs;

  if (params.query) {
    const q = params.query.toLowerCase();
    filtered = filtered.filter(log => 
      (log.action?.toLowerCase() || "").includes(q) ||
      (log.performedByName?.toLowerCase() || "").includes(q) ||
      (JSON.stringify(log.details || {})).toLowerCase().includes(q)
    );
  }

  return filtered;
}

export async function searchAuditLogs(
  params: AuditSearchParams,
  pageSize: number = 25,
  lastDoc: QueryDocumentSnapshot | null = null
): Promise<SearchPage<AuditLogEntry>> {
  
  const parsedParams = AuditSearchSchema.parse(params) as AuditSearchParams;
  
  let q = buildAuditQuery(parsedParams);
  
  const fetchLimit = params.query ? 100 : pageSize;
  q = query(q, limit(fetchLimit));
  
  if (lastDoc) {
    q = query(q, startAfter(lastDoc));
  }

  const snap = await getDocs(q);
  
  const rawLogs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AuditLogEntry));
  const filteredLogs = applyClientSideFilters(rawLogs, parsedParams);
  
  const finalLogs = filteredLogs.slice(0, pageSize);
  
  let newLastDoc = null;
  let hasMore = false;
  
  if (finalLogs.length > 0) {
    const lastLogId = finalLogs[finalLogs.length - 1].id;
    const lastLogDoc = snap.docs.find(d => d.id === lastLogId);
    newLastDoc = lastLogDoc || null;
    
    hasMore = snap.docs.length === fetchLimit || filteredLogs.length > pageSize;
  }

  return {
    items: finalLogs,
    lastDoc: newLastDoc,
    hasMore
  };
}
