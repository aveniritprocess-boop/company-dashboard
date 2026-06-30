"use client";

import React, { useState, useEffect } from "react";
import { Search, SlidersHorizontal, Filter, X } from "lucide-react";
import { TaskSearchParams, defaultTaskSearchParams } from "@/lib/search/search-types";
import { SearchFilters } from "./SearchFilters";
import { DateRangePicker } from "./DateRangePicker";
import { useDebounce } from "@/lib/utils/hooks";
import { useAuth } from "@/components/AuthProvider";
import { logActivityClient } from "@/lib/audit-client";

interface TaskSearchPanelProps {
  onSearch: (params: TaskSearchParams) => void;
  resultCount?: number;
  totalCount?: number | null;
}

export function TaskSearchPanel({ onSearch, resultCount, totalCount }: TaskSearchPanelProps) {
  const { user } = useAuth();
  const [params, setParams] = useState<TaskSearchParams>(defaultTaskSearchParams);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [activeFiltersCount, setActiveFiltersCount] = useState(0);

  const debouncedQuery = useDebounce(params.query, 300);

  useEffect(() => {
    onSearch({ ...params, query: debouncedQuery });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    debouncedQuery,
    params.status,
    params.priority,
    params.quickFilter,
    params.dueDateFrom,
    params.dueDateTo,
    params.sortBy
  ]);

  useEffect(() => {
    let count = 0;
    if (params.status !== "all") count++;
    if (params.priority !== "all") count++;
    if (params.quickFilter !== "all") count++;
    if (params.dueDateFrom || params.dueDateTo) count++;
    setActiveFiltersCount(count);
  }, [params]);

  const lastLoggedQuery = React.useRef("");
  useEffect(() => {
    if (resultCount !== undefined && resultCount > 0 && params.query && params.query !== lastLoggedQuery.current) {
      lastLoggedQuery.current = params.query;
      if (user) {
        logActivityClient({
          action: "task_search",
          performedBy: user.uid,
          performedByName: user.displayName || "User",
          targetId: "system",
          targetType: "system",
          details: `Searched tasks for "${params.query}"`,
          metadata: { filters: params, resultCount }
        }).catch(console.error);
      }
    }
  }, [resultCount, params, user]);

  const updateParam = (key: keyof TaskSearchParams, value: string) => {
    setParams(prev => ({ ...prev, [key]: value }));
  };

  const clearAll = () => {
    setParams(defaultTaskSearchParams);
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-4">
      {/* Top Row */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
          <input
            type="text"
            value={params.query}
            onChange={(e) => updateParam("query", e.target.value)}
            placeholder="Search tasks by title or description..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        
        <div className="flex items-center gap-2">
          <select
            value={params.sortBy}
            onChange={(e) => updateParam("sortBy", e.target.value)}
            className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="priority">Highest Priority</option>
            <option value="due_date">Due Date</option>
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
            label="Quick Filter"
            value={params.quickFilter}
            onChange={(val) => updateParam("quickFilter", val)}
            options={[
              { label: "All Tasks", value: "all" },
              { label: "Assigned to Me", value: "assigned_to_me" },
              { label: "Assigned by Me", value: "assigned_by_me" },
              { label: "Overdue", value: "overdue" }
            ]}
          />

          <SearchFilters
            label="Status"
            value={params.status}
            onChange={(val) => updateParam("status", val)}
            options={[
              { label: "All", value: "all" },
              { label: "Pending", value: "pending" },
              { label: "In Progress", value: "in_progress" },
              { label: "Review", value: "review" },
              { label: "Completed", value: "completed" }
            ]}
          />

          <SearchFilters
            label="Priority"
            value={params.priority}
            onChange={(val) => updateParam("priority", val)}
            options={[
              { label: "All", value: "all" },
              { label: "Low", value: "low" },
              { label: "Medium", value: "medium" },
              { label: "High", value: "high" },
              { label: "Critical", value: "critical" }
            ]}
          />

          <DateRangePicker
            label="Due Date"
            from={params.dueDateFrom}
            to={params.dueDateTo}
            onChangeFrom={(val) => updateParam("dueDateFrom", val)}
            onChangeTo={(val) => updateParam("dueDateTo", val)}
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
              Showing {resultCount} {totalCount ? `of ${totalCount} ` : ""}tasks
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
