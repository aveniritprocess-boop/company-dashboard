"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { Task, createTask, addTaskHistory, TaskStatus } from "@/lib/tasks";
import { getTeamsForUser } from "@/lib/teams";
import { Team } from "@/lib/roles";
import { AppUserSummary } from "@/lib/users";
import { MentionTextarea, extractMentionedUsers } from "@/components/MentionTextarea";
import { X, Loader2, Plus, Paperclip, Trash2 } from "lucide-react";
import { CreateTaskSchema } from "@/lib/validators/task";

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTaskCreated?: (task: Task) => void;
  users: AppUserSummary[];
}

export function CreateTaskModal({ isOpen, onClose, onTaskCreated, users }: CreateTaskModalProps) {
  const { user } = useAuth();
  const [userTeams, setUserTeams] = useState<Team[]>([]);
  
  // Form State
  const [assignedTo, setAssignedTo] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "critical">("medium");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = useState(new Date().toISOString().split("T")[0]);
  const [status, setStatus] = useState<TaskStatus>("pending");
  const [teamId, setTeamId] = useState("");
  const [attachments, setAttachments] = useState<{ name: string; size: string; url: string; }[]>([]);
  
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Load user teams
  useEffect(() => {
    if (user) {
      getTeamsForUser(user.uid)
        .then(setUserTeams)
        .catch((e) => console.error("Failed to load user teams for tasks", e));
    }
  }, [user]);

  if (!isOpen) return null;

  const handleFileAttach = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    
    const list = Array.from(files).map((file) => ({
      name: file.name,
      size: `${(file.size / 1024).toFixed(1)} KB`,
      url: `https://mockfile.example.com/${encodeURIComponent(file.name)}`
    }));
    setAttachments((prev) => [...prev, ...list]);
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    // Zod validation
    const zodResult = CreateTaskSchema.safeParse({
      taskText: title.trim(),
      description: description.trim(),
      assignedBy: user.uid,
      assignedTo: assignedTo,
      priority,
      status,
      startDate,
      dueDate,
      attachments,
      teamId,
    });
    if (!zodResult.success) {
      setError(zodResult.error.issues[0]?.message || "Validation failed.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const mentionedUserIds = extractMentionedUsers(description, users);
      const newTaskId = await createTask(
        title.trim(),
        description.trim(),
        user.uid,
        assignedTo,
        priority,
        startDate,
        dueDate,
        mentionedUserIds,
        status,
        attachments,
        teamId
      );

      await addTaskHistory(
        newTaskId,
        `Task created via quick command with status: ${status.toUpperCase()} and priority: ${priority.toUpperCase()}`,
        user.uid,
        user.displayName || "User"
      );

      // Reset Form
      setTitle("");
      setDescription("");
      setAssignedTo([]);
      setPriority("medium");
      setStartDate(new Date().toISOString().split("T")[0]);
      setDueDate(new Date().toISOString().split("T")[0]);
      setStatus("pending");
      setTeamId("");
      setAttachments([]);

      if (onTaskCreated) {
        onTaskCreated({
          id: newTaskId,
          taskText: title.trim(),
          title: title.trim(),
          description: description.trim(),
          assignedTo,
          assignedBy: user.uid,
          createdBy: user.uid,
          priority,
          status,
          startDate,
          dueDate,
          attachments,
          teamId,
          createdAt: new Date() as unknown as Task["createdAt"]
        });
      }
      onClose();
    } catch (err: unknown) {
      console.error(err);
      setError("Failed to create task. Please verify permissions.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-xl p-6 max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between mb-5 border-b border-slate-100 dark:border-slate-800 pb-3">
          <h2 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-wider">
            Create Action Task
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-650 dark:hover:text-gray-200 hover:bg-slate-50 dark:hover:bg-slate-850 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 text-xs font-semibold rounded-lg border border-red-200 dark:border-red-900/30">
              {error}
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">
              Task Title <span className="text-rose-500">*</span>
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to be done?"
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900 px-4 py-2.5 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">
              Description / Action Requirements
            </label>
            <MentionTextarea
              value={description}
              onChange={setDescription}
              users={users}
              rows={3}
              placeholder="Elaborate on details... type @ to mention someone"
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900 px-4 py-2.5 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Assignees */}
          <div>
            <label className="block font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">
              Assignee(s) <span className="text-rose-500">*</span>
            </label>
            <select
              multiple
              value={assignedTo}
              onChange={(e) => {
                const options = e.target.options;
                const selected: string[] = [];
                for (let i = 0; i < options.length; i++) {
                  if (options[i].selected) {
                    selected.push(options[i].value);
                  }
                }
                setAssignedTo(selected);
              }}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 h-24"
              required
            >
              <option value={user?.uid}>Self (Assign to Me)</option>
              {users.filter(u => u.uid !== user?.uid).map((emp) => (
                <option key={emp.uid} value={emp.uid}>
                  {emp.name ? `${emp.name} (${emp.email})` : emp.email}
                </option>
              ))}
            </select>
            <span className="text-[9px] text-slate-400 font-semibold block mt-1">
              Hold Ctrl (or Cmd) to select multiple employees.
            </span>
          </div>

          {/* Status, Priority & Team Assignment */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900 px-3 py-2 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer font-bold uppercase"
              >
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="review">In Review</option>
                <option value="completed">Completed</option>
              </select>
            </div>
            <div>
              <label className="block font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as Task["priority"])}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900 px-3 py-2 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer font-bold uppercase"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <div>
              <label className="block font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">
                Team Assignment
              </label>
              <select
                value={teamId}
                onChange={(e) => setTeamId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900 px-3 py-2 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer font-semibold"
              >
                <option value="">No Team Assigned</option>
                {userTeams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900 px-3 py-2 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
              />
            </div>
            <div>
              <label className="block font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">
                Due Date
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900 px-3 py-2 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
              />
            </div>
          </div>

          {/* Attachments Section */}
          <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
            <label className="block font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">
              Task Attachments
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {attachments.map((file, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-100 dark:border-slate-750 text-slate-700 dark:text-slate-300 text-[10px]"
                >
                  <Paperclip className="h-3 w-3 text-slate-400 shrink-0" />
                  <span className="truncate max-w-[120px] font-semibold">{file.name}</span>
                  <span className="text-[9px] text-slate-400">({file.size})</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveAttachment(idx)}
                    className="p-0.5 rounded text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>

            <input
              type="file"
              id="quick-task-file-uploader"
              multiple
              onChange={handleFileAttach}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => document.getElementById("quick-task-file-uploader")?.click()}
              className="flex items-center gap-1.5 px-3.5 py-2 border border-dashed border-slate-200 hover:border-indigo-500 dark:border-slate-800 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-xl text-slate-500 dark:text-slate-400 font-bold uppercase transition"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Attachment File
            </button>
          </div>

          {/* Actions Footer */}
          <div className="flex gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-750 text-white font-bold text-xs uppercase transition-colors disabled:opacity-60"
            >
              {submitting && <Loader2 className="h-3 w-3 animate-spin" />}
              Create Action Item
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
