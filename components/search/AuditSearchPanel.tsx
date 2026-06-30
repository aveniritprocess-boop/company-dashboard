"use client";

import React, { useState, useEffect } from "react";
import { Search, SlidersHorizontal, Filter, X } from "lucide-react";
import { AuditSearchParams, defaultAuditSearchParams } from "@/lib/search/search-types";
import { SearchFilters } from "./SearchFilters";
import { DateRangePicker } from "./DateRangePicker";
import { useDebounce } from "@/lib/utils/hooks";
import { useAuth } from "@/components/AuthProvider";
import { logActivityClient } from "@/lib/audit-client";

interface AuditSearchPanelProps {
  onSearch: (params: AuditSearchParams) => void;
  resultCount?: number;
}

const AUDIT_ACTIONS = [
  "login", "logout", "task_created", "task_updated", "task_deleted", 
  "task_status_changed", "employee_created", "employee_updated", 
  "employee_deleted", "employee_restored", "permission_changed",
  "project_created", "team_created", "attendance_clock_in", 
  "attendance_clock_out", "password_reset", "monitoring_viewed"
];

export function AuditSearchPanel({ onSearch, resultCount }: AuditSearchPanelProps) {
  const { user } = useAuth();
  const [params, setParams] = useState<AuditSearchParams>(defaultAuditSearchParams);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [activeFiltersCount, setActiveFiltersCount] = useState(0);

  const debouncedQuery = useDebounce(params.query, 300);

  useEffect(() => {
    onSearch({ ...params, query: debouncedQuery });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    debouncedQuery,
    params.severity,
    params.action,
    params.performedBy,
    params.datePreset,
    params.dateFrom,
    params.dateTo
  ]);

  useEffect(() => {
    let count = 0;
    if (params.severity !== "all") count++;
    if (params.action !== "all") count++;
    if (params.performedBy !== "all") count++;
    if (params.datePreset !== "all") count++;
    setActiveFiltersCount(count);
  }, [params]);

  const lastLoggedQuery = React.useRef("");
  useEffect(() => {
    if (resultCount !== undefined && resultCount > 0 && params.query && params.query !== lastLoggedQuery.current) {
      lastLoggedQuery.current = params.query;
      if (user) {
        logActivityClient({
          action: "audit_search",
          performedBy: user.uid,
          performedByName: user.displayName || "User",
          targetId: "system",
          targetType: "system",
          details: `Searched audit logs for "${params.query}"`,
          metadata: { filters: params, resultCount }
        }).catch(console.error);
      }
    }
  }, [resultCount, params, user]);

  const updateParam = (key: keyof AuditSearchParams, value: string) => {
    setParams(prev => ({ ...prev, [key]: value }));
  };

  const clearAll = () => {
    setParams(defaultAuditSearchParams);
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-4 mb-6">
      {/* Top Row */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
          <input
            type="text"
            value={params.query}
            onChange={(e) => updateParam("query", e.target.value)}
            placeholder="Search by action, details, or user name..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        
        <div className="flex items-center gap-2">
          <select
            value={params.datePreset}
            onChange={(e) => updateParam("datePreset", e.target.value)}
            className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="custom">Custom Range</option>
          </select>

          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="relative flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-medium transition-colors"
          >
            <SlidersHorizontal className="h-4 w-4" />
            <span className="hidden sm:inline">Filters</span>
            {activeFiltersCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-500 text-[10px] font-bold text-white">
                {activeFiltersCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Advanced Filters Drawer */}
      {showAdvanced && (
        <div className="pt-4 border-t border-slate-200 dark:border-slate-800 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in slide-in-from-top-2 fade-in duration-200">
          
          <SearchFilters
            label="Severity"
            value={params.severity}
            onChange={(val) => updateParam("severity", val)}
            options={[
              { label: "All", value: "all" },
              { label: "Info", value: "info" },
              { label: "Warning", value: "warning" },
              { label: "Critical", value: "critical" }
            ]}
          />

          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Action Type</span>
            <select
              value={params.action}
              onChange={(e) => updateParam("action", e.target.value)}
              className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Actions</option>
              {AUDIT_ACTIONS.map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>

          {params.datePreset === "custom" && (
            <DateRangePicker
              label="Date Range"
              from={params.dateFrom}
              to={params.dateTo}
              onChangeFrom={(val) => updateParam("dateFrom", val)}
              onChangeTo={(val) => updateParam("dateTo", val)}
            />
          )}

          {activeFiltersCount > 0 && (
            <div className="lg:col-span-3 flex justify-end">
              <button
                onClick={clearAll}
                className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-300 font-medium px-3 py-1.5"
              >
                <X className="h-4 w-4" />
                Clear All Filters
              </button>
            </div>
          )}
        </div>
      )}

      {/* Results Meta */}
      {resultCount !== undefined && (
        <div className="flex items-center justify-between text-xs font-medium text-slate-500 pt-2 border-t border-slate-100 dark:border-slate-800/50">
          <div className="flex items-center gap-1.5">
            <Filter className="h-3.5 w-3.5" />
            <span>
              Showing {resultCount} logs
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
