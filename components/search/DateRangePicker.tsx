"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

interface DateRangePickerProps {
  label?: string;
  from: string;
  to: string;
  onChangeFrom: (val: string) => void;
  onChangeTo: (val: string) => void;
  className?: string;
}

export function DateRangePicker({ label, from, to, onChangeFrom, onChangeTo, className }: DateRangePickerProps) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {label && <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</span>}
      <div className="flex items-center gap-2">
        <div className="relative">
          <input
            type="date"
            value={from}
            onChange={(e) => onChangeFrom(e.target.value)}
            className="pl-3 pr-8 py-1.5 text-sm rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="From"
          />
          {from && (
            <button
              onClick={() => onChangeFrom("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <span className="text-slate-400 text-sm">to</span>
        <div className="relative">
          <input
            type="date"
            value={to}
            onChange={(e) => onChangeTo(e.target.value)}
            className="pl-3 pr-8 py-1.5 text-sm rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="To"
          />
          {to && (
            <button
              onClick={() => onChangeTo("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
