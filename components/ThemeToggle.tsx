"use client";

import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="flex bg-gray-100 dark:bg-neutral-900 rounded-full p-1 border border-gray-200 dark:border-neutral-800 w-fit">
        <div className="p-2 rounded-full text-gray-400">
          <Sun className="h-4 w-4" />
        </div>
        <div className="p-2 rounded-full text-gray-400">
          <Moon className="h-4 w-4" />
        </div>
        <div className="p-2 rounded-full text-gray-400">
          <Monitor className="h-4 w-4" />
        </div>
      </div>
    );
  }

  const isLight = resolvedTheme === "light";
  const isDark = resolvedTheme === "dark";
  const isSystem = theme === "system";

  return (
    <div className="flex bg-gray-100 dark:bg-neutral-900 rounded-full p-1 border border-gray-200 dark:border-neutral-800 w-fit">
      <button
        onClick={() => setTheme("light")}
        className={`p-2 rounded-full transition-all ${
          isLight && !isSystem
            ? "bg-white dark:bg-neutral-800 text-yellow-500 shadow-sm"
            : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
        }`}
        aria-label="Light mode"
      >
        <Sun className="h-4 w-4" />
      </button>

      <button
        onClick={() => setTheme("dark")}
        className={`p-2 rounded-full transition-all ${
          isDark && !isSystem
            ? "bg-white dark:bg-neutral-800 text-blue-500 shadow-sm"
            : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
        }`}
        aria-label="Dark mode"
      >
        <Moon className="h-4 w-4" />
      </button>

      <button
        onClick={() => setTheme("system")}
        className={`p-2 rounded-full transition-all ${
          isSystem
            ? "bg-white dark:bg-neutral-800 text-green-500 shadow-sm"
            : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
        }`}
        aria-label="System mode"
      >
        <Monitor className="h-4 w-4" />
      </button>
    </div>
  );
}
