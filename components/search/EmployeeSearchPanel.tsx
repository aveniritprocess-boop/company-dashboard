"use client";

import React, { useState, useEffect } from "react";
import { Search, SlidersHorizontal, Filter, X } from "lucide-react";
import { EmployeeSearchParams, defaultEmployeeSearchParams } from "@/lib/search/search-types";
import { SearchFilters } from "./SearchFilters";
import { DateRangePicker } from "./DateRangePicker";
import { useDebounce } from "@/lib/utils/hooks";
import { useAuth } from "@/components/AuthProvider";
import { logActivityClient } from "@/lib/audit-client";

interface EmployeeSearchPanelProps {
  onSearch: (params: EmployeeSearchParams) => void;
  resultCount?: number;
  totalCount?: number | null;
}

export function EmployeeSearchPanel({ onSearch, resultCount, totalCount }: EmployeeSearchPanelProps) {
  const { user } = useAuth();
  const [params, setParams] = useState<EmployeeSearchParams>(defaultEmployeeSearchParams);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [activeFiltersCount, setActiveFiltersCount] = useState(0);

  const debouncedQuery = useDebounce(params.query, 300);

  // Trigger search when debounced query or any exact filter changes
  useEffect(() => {
    // We only pass the updated query here to avoid stale closures, 
    // but the rest of params are already up-to-date in state
    onSearch({ ...params, query: debouncedQuery });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    debouncedQuery, 
    params.role, 
    params.status, 
    params.employeeType, 
    params.department, 
    params.portalAccess, 
    params.joiningDateFrom, 
    params.joiningDateTo, 
    params.sortBy
  ]);

  // Update active filter count badge
  useEffect(() => {
    let count = 0;
    if (params.role !== "all") count++;
    if (params.status !== "all") count++;
    if (params.employeeType !== "all") count++;
    if (params.department !== "all") count++;
    if (params.portalAccess !== "all") count++;
    if (params.joiningDateFrom || params.joiningDateTo) count++;
    setActiveFiltersCount(count);
  }, [params]);

  // Log search activity when results return for a new query
  const lastLoggedQuery = React.useRef("");
  useEffect(() => {
    if (resultCount !== undefined && resultCount > 0 && params.query && params.query !== lastLoggedQuery.current) {
      lastLoggedQuery.current = params.query;
      if (user) {
        logActivityClient({
          action: "employee_search",
          performedBy: user.uid,
          performedByName: user.displayName || "User",
          targetId: "system",
          targetType: "system",
          details: `Searched employees for "${params.query}"`,
          metadata: { filters: params, resultCount }
        }).catch(console.error);
      }
    }
  }, [resultCount, params, user]);

  const updateParam = (key: keyof EmployeeSearchParams, value: string) => {
    setParams(prev => ({ ...prev, [key]: value }));
  };

  const clearAll = () => {
    setParams(defaultEmployeeSearchParams);
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-4">
      {/* Top Row: Search & Quick Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
          <input
            type="text"
            value={params.query}
            onChange={(e) => updateParam("query", e.target.value)}
            placeholder="Search by name, email, ID, mobile, or designation..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        
        <div className="flex items-center gap-2">
          <select
            value={params.sortBy}
            onChange={(e) => updateParam("sortBy", e.target.value)}
            className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="name_asc">Name (A-Z)</option>
            <option value="name_desc">Name (Z-A)</option>
            <option value="joining_asc">Oldest Joiners</option>
            <option value="joining_desc">Recent Joiners</option>
            <option value="recently_added">Recently Added</option>
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
            label="Role"
            value={params.role}
            onChange={(val) => updateParam("role", val)}
            options={[
              { label: "All", value: "all" },
              { label: "Employee", value: "employee" },
              { label: "Manager", value: "manager" },
              { label: "HR", value: "hr" },
              { label: "Admin", value: "admin" }
            ]}
          />

          <SearchFilters
            label="Status"
            value={params.status}
            onChange={(val) => updateParam("status", val)}
            options={[
              { label: "All", value: "all" },
              { label: "Active", value: "active" },
              { label: "Inactive", value: "inactive" },
              { label: "Locked", value: "locked" },
              { label: "Archived", value: "archived" }
            ]}
          />

          <SearchFilters
            label="Employee Type"
            value={params.employeeType}
            onChange={(val) => updateParam("employeeType", val)}
            options={[
              { label: "All", value: "all" },
              { label: "Permanent", value: "permanent" },
              { label: "Contract", value: "contract" },
              { label: "Intern", value: "intern" },
              { label: "Part Time", value: "part_time" }
            ]}
          />

          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Department</span>
            <input
              type="text"
              value={params.department !== "all" ? params.department : ""}
              onChange={(e) => updateParam("department", e.target.value || "all")}
              placeholder="e.g. Engineering"
              className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <SearchFilters
            label="Portal Access"
            value={params.portalAccess}
            onChange={(val) => updateParam("portalAccess", val)}
            options={[
              { label: "All", value: "all" },
              { label: "Enabled", value: "enabled" },
              { label: "Disabled", value: "disabled" }
            ]}
          />

          <DateRangePicker
            label="Joining Date"
            from={params.joiningDateFrom}
            to={params.joiningDateTo}
            onChangeFrom={(val) => updateParam("joiningDateFrom", val)}
            onChangeTo={(val) => updateParam("joiningDateTo", val)}
          />

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
              Showing {resultCount} {totalCount ? `of ${totalCount} ` : ""}employees
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
