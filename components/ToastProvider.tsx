"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { X, CheckCircle, AlertCircle, Info, Bell } from "lucide-react";

type ToastType = "success" | "error" | "info" | "notification";

interface Toast {
  id: string;
  message: string;
  type: ToastType;
  title?: string;
}

interface ToastContextType {
  addToast: (message: string, type?: ToastType, title?: string) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: ToastType = "info", title?: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type, title }]);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-full max-w-sm pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-4 p-4 rounded-2xl shadow-2xl border bg-white dark:bg-slate-900 animate-in slide-in-from-right-full duration-300 ${
              toast.type === "success" ? "border-emerald-100 dark:border-emerald-900/30" :
              toast.type === "error" ? "border-red-100 dark:border-red-900/30" :
              toast.type === "notification" ? "border-indigo-100 dark:border-indigo-900/30" :
              "border-slate-100 dark:border-slate-800"
            }`}
          >
            <div className={`mt-0.5 rounded-full p-1.5 ${
              toast.type === "success" ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400" :
              toast.type === "error" ? "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400" :
              toast.type === "notification" ? "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400" :
              "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
            }`}>
              {toast.type === "success" ? <CheckCircle className="h-4 w-4" /> :
               toast.type === "error" ? <AlertCircle className="h-4 w-4" /> :
               toast.type === "notification" ? <Bell className="h-4 w-4" /> :
               <Info className="h-4 w-4" />}
            </div>
            
            <div className="flex-1 min-w-0">
              {toast.title && <p className="text-sm font-bold text-slate-900 dark:text-white leading-tight">{toast.title}</p>}
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5 leading-relaxed">{toast.message}</p>
            </div>

            <button
              onClick={() => removeToast(toast.id)}
              className="mt-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within a ToastProvider");
  return context;
};
