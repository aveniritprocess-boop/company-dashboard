"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface FilterOption {
  label: string;
  value: string;
}

interface SearchFiltersProps {
  label?: string;
  options: FilterOption[];
  value: string;
  onChange: (val: string) => void;
  className?: string;
}

export function SearchFilters({ label, options, value, onChange, className }: SearchFiltersProps) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {label && <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</span>}
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const isActive = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={cn(
                "px-3 py-1.5 text-sm font-medium rounded-full transition-colors whitespace-nowrap",
                isActive
                  ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300 ring-1 ring-indigo-500/30"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
