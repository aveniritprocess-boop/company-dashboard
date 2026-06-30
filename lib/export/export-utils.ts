import { logActivityClient } from "../audit-client";

export const EXPORT_LIMITS = {
  pdf: 1000,
  xlsx: 10000,
  csv: 20000,
};

export interface ExportMetadata {
  module: string; // e.g. "employees", "tasks", "attendance"
  format: "csv" | "xlsx" | "pdf";
  recordCount: number;
  appliedFilters: Record<string, unknown> | string;
  correlationId: string;
  performedBy: string;
  performedByName: string;
}

export async function auditExport(metadata: ExportMetadata) {
  try {
    await logActivityClient({
      action: `${metadata.module}_export`,
      performedBy: metadata.performedBy,
      performedByName: metadata.performedByName,
      targetId: "system",
      targetType: "system",
      details: `Exported ${metadata.recordCount} records as ${metadata.format.toUpperCase()}`,
      metadata: { ...metadata },
    });
  } catch (error) {
    console.error("Failed to audit export:", error);
  }
}

export function generateExportFilename(module: string, format: string) {
  const dateStr = new Date().toISOString().split('T')[0];
  return `${module}_${dateStr}.${format}`;
}

export function checkExportLimit(recordCount: number, format: "csv" | "xlsx" | "pdf"): boolean {
  if (recordCount > EXPORT_LIMITS[format]) {
    alert(`This export exceeds the browser limit (${EXPORT_LIMITS[format]} rows for ${format.toUpperCase()}). Please narrow your filters or contact an administrator for a full export.`);
    return false;
  }
  return true;
}
