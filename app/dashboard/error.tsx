"use client";

import { useEffect } from "react";
import { AlertCircle, RotateCcw } from "lucide-react";
import Link from "next/link";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard error caught by boundary:", error);
  }, [error]);

  return (
    <div className="flex h-[80vh] w-full flex-col items-center justify-center bg-gray-50 p-6 text-center">
      <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-red-100">
        <AlertCircle className="h-12 w-12 text-red-600" />
      </div>
      <h2 className="mb-2 text-2xl font-bold text-gray-900">
        Something went wrong!
      </h2>
      <p className="mb-8 max-w-md text-gray-500">
        We encountered an unexpected error while loading this page. 
        {error.message && (
            <span className="block mt-2 font-mono text-sm text-red-500 bg-red-50 p-2 rounded">
                {error.message}
            </span>
        )}
      </p>
      <div className="flex space-x-4">
        <button
          onClick={() => reset()}
          className="flex items-center space-x-2 rounded-lg bg-blue-600 px-6 py-3 font-medium text-white transition-colors hover:bg-blue-700"
        >
          <RotateCcw className="h-5 w-5" />
          <span>Try again</span>
        </button>
        <Link
          href="/dashboard"
          className="flex items-center space-x-2 rounded-lg border border-gray-300 bg-white px-6 py-3 font-medium text-gray-700 transition-colors hover:bg-gray-50"
        >
          <span>Return to Dashboard</span>
        </Link>
      </div>
    </div>
  );
}
