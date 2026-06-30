"use client";

import { useState } from "react";
import { useAuth } from "../AuthProvider";
import { createTeamWithIndex } from "@/lib/teams";
import { Plus, X } from "lucide-react";
import { CreateTeamSchema } from "@/lib/validators/team";
import type { ZodIssue } from "zod";

export function CreateTeamDialog({ onTeamCreated }: { onTeamCreated: () => void }) {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [nameError, setNameError] = useState("");
  const [submitError, setSubmitError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNameError("");
    setSubmitError("");

    // Zod validation
    const zodResult = CreateTeamSchema.safeParse({
      name: name.trim(),
      ownerUid: user?.uid || "",
      ownerEmail: user?.email || "",
    });
    if (!zodResult.success) {
      const nameErr = zodResult.error.issues.find((e: ZodIssue) => String(e.path[0]) === 'name');
      const otherErr = zodResult.error.issues.find((e: ZodIssue) => String(e.path[0]) !== 'name');
      if (nameErr) setNameError(nameErr.message);
      else if (otherErr) setSubmitError(otherErr.message);
      return;
    }
    if (!user) {
      setSubmitError("Authentication error. Please re-login.");
      return;
    }

    setLoading(true);
    try {
      await createTeamWithIndex(name.trim(), user.uid, user.email || "");
      setName("");
      setIsOpen(false);
      onTeamCreated();
    } catch (error) {
      console.error("Failed to create team", error);
      setSubmitError("Failed to create team. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition"
      >
        <Plus className="h-4 w-4" />
        New Team
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-lg bg-white dark:bg-gray-800 p-6 shadow-xl">
        <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Create New Team</h3>
            <button onClick={() => setIsOpen(false)} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                <X className="h-5 w-5" />
            </button>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {submitError && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-450 text-xs font-semibold rounded-lg border border-red-100 dark:border-red-900/30">
              {submitError}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Team Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:text-sm"
              placeholder="e.g. Engineering"
            />
            {nameError && (
              <p className="mt-1 text-xs text-red-500 font-semibold">{nameError}</p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition"
            >
              {loading ? "Creating..." : "Create Team"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
