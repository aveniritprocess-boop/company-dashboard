"use client";

import React, { useState, useRef, useEffect } from "react";
import { Download, FileText, FileSpreadsheet, FileBox, Loader2 } from "lucide-react";
import { ExportMetadata, auditExport } from "@/lib/export/export-utils";
import { exportToCsv } from "@/lib/export/csv";
import { exportToExcel } from "@/lib/export/excel";
import { exportToPdf } from "@/lib/export/pdf";

interface ExportMenuProps {
  data: Record<string, unknown>[];
  columns: { key: string; header: string }[];
  metadata: Omit<ExportMetadata, "format" | "recordCount">;
  disabled?: boolean;
}

export function ExportMenu({ data, columns, metadata, disabled }: ExportMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState<"csv" | "xlsx" | "pdf" | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const [errorMsg, setErrorMsg] = useState("");

  const handleExport = async (format: "csv" | "xlsx" | "pdf") => {
    if (disabled || data.length === 0) return;
    
    setIsExporting(format);
    setIsOpen(false);
    setErrorMsg("");

    try {
      const fullMeta: ExportMetadata = { ...metadata, format, recordCount: data.length };
      
      if (format === "csv") await exportToCsv(data, columns, metadata.module);
      else if (format === "xlsx") await exportToExcel(data, columns, fullMeta);
      else if (format === "pdf") await exportToPdf(data, columns, fullMeta);
      
      // Audit
      await auditExport(fullMeta);
    } catch (error) {
      console.error(`Failed to export ${format}:`, error);
      setErrorMsg(`An error occurred while generating the ${format.toUpperCase()} file.`);
      setTimeout(() => setErrorMsg(""), 3000);
    } finally {
      setIsExporting(null);
    }
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled || data.length === 0 || isExporting !== null}
        className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-3.5 py-2 rounded-xl font-bold text-xs uppercase transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        <span className="hidden sm:inline">{isExporting ? `Exporting ${isExporting.toUpperCase()}...` : "Export"}</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg overflow-hidden z-50 animate-in fade-in slide-in-from-top-2">
          <button
            onClick={() => handleExport("csv")}
            className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <FileText className="h-4 w-4 text-blue-500" /> Export as CSV
          </button>
          <button
            onClick={() => handleExport("xlsx")}
            className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border-t border-slate-100 dark:border-slate-800/50"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-500" /> Export as Excel
          </button>
          <button
            onClick={() => handleExport("pdf")}
            className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border-t border-slate-100 dark:border-slate-800/50"
          >
            <FileBox className="h-4 w-4 text-rose-500" /> Export as PDF
          </button>
        </div>
      )}
      {errorMsg && (
        <div className="absolute right-0 mt-2 w-64 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-xs z-50 shadow-sm animate-in fade-in">
          {errorMsg}
        </div>
      )}
    </div>
  );
}
