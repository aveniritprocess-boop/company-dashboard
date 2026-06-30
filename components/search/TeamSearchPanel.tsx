"use client";

import React, { useState, useEffect } from "react";
import { Search } from "lucide-react";
import { TeamSearchParams, defaultTeamSearchParams } from "@/lib/search/search-types";
import { useDebounce } from "@/lib/utils/hooks";

interface TeamSearchPanelProps {
  onSearch: (params: TeamSearchParams) => void;
}

export function TeamSearchPanel({ onSearch }: TeamSearchPanelProps) {
  const [params, setParams] = useState<TeamSearchParams>(defaultTeamSearchParams);

  const debouncedQuery = useDebounce(params.query, 300);

  useEffect(() => {
    onSearch({ ...params, query: debouncedQuery });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    debouncedQuery,
    params.sortBy
  ]);

  const updateParam = (key: keyof TeamSearchParams, value: string) => {
    setParams(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 mb-6">
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        
        <div className="relative flex-1 w-full max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
          <input
            type="text"
            value={params.query}
            onChange={(e) => updateParam("query", e.target.value)}
            placeholder="Search teams by name..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        
        <div className="flex items-center gap-4">
          <select
            value={params.sortBy}
            onChange={(e) => updateParam("sortBy", e.target.value)}
            className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="alphabetical">Alphabetical</option>
            <option value="newest">Newest First</option>
          </select>
        </div>

      </div>
    </div>
  );
}
