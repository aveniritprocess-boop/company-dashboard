"use client";

import React, { useState, useEffect } from "react";
import { Search } from "lucide-react";
import { ProjectSearchParams, defaultProjectSearchParams } from "@/lib/search/search-types";
import { SearchFilters } from "./SearchFilters";
import { useDebounce } from "@/lib/utils/hooks";
import { useAuth } from "@/components/AuthProvider";
import { logActivityClient } from "@/lib/audit-client";

interface ProjectSearchPanelProps {
  onSearch: (params: ProjectSearchParams) => void;
  resultCount?: number;
}

export function ProjectSearchPanel({ onSearch, resultCount }: ProjectSearchPanelProps) {
  const { user } = useAuth();
  const [params, setParams] = useState<ProjectSearchParams>(defaultProjectSearchParams);

  const debouncedQuery = useDebounce(params.query, 300);

  useEffect(() => {
    onSearch({ ...params, query: debouncedQuery });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    debouncedQuery,
    params.status,
    params.sortBy
  ]);

  const lastLoggedQuery = React.useRef("");
  useEffect(() => {
    if (resultCount !== undefined && resultCount > 0 && params.query && params.query !== lastLoggedQuery.current) {
      lastLoggedQuery.current = params.query;
      if (user) {
        logActivityClient({
          action: "project_search",
          performedBy: user.uid,
          performedByName: user.displayName || "User",
          targetId: "system",
          targetType: "system",
          details: `Searched projects for "${params.query}"`,
          metadata: { filters: params, resultCount }
        }).catch(console.error);
      }
    }
  }, [resultCount, params, user]);

  const updateParam = (key: keyof ProjectSearchParams, value: string) => {
    setParams(prev => ({ ...prev, [key]: value }));
  };


  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-4 mb-6">
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        
        <div className="relative flex-1 w-full max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
          <input
            type="text"
            value={params.query}
            onChange={(e) => updateParam("query", e.target.value)}
            placeholder="Search projects..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        
        <div className="flex items-center gap-4 flex-wrap">
          <SearchFilters
            value={params.status}
            onChange={(val) => updateParam("status", val)}
            options={[
              { label: "All Status", value: "all" },
              { label: "Active", value: "active" },
              { label: "Archived", value: "archived" }
            ]}
          />
          
          <select
            value={params.sortBy}
            onChange={(e) => updateParam("sortBy", e.target.value)}
            className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="newest">Newest First</option>
            <option value="alphabetical">Alphabetical</option>
          </select>
        </div>

      </div>
    </div>
  );
}
