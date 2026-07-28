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
import { MultiSelect } from "@/components/ui/multi-select";
import { Button } from "@/components/ui/button";

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

    if (assignedTo.length === 0) {
      setError("Please select at least one assignee.");
      return;
    }

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

  // Options for MultiSelect Assignees
  const assigneeOptions = [
    ...(user ? [{ label: "Self (Assign to Me)", value: user.uid }] : []),
    ...users.filter(u => u.uid !== user?.uid).map(emp => ({
      label: emp.name ? `${emp.name} (${emp.email})` : emp.email,
      value: emp.uid
    }))
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-background rounded-3xl shadow-2xl w-full max-w-xl p-6 max-h-[90vh] overflow-y-auto border border-border">
        <div className="flex items-center justify-between mb-5 border-b border-border pb-3">
          <h2 className="text-base font-black text-foreground uppercase tracking-wider">
            Create Action Task
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-destructive/10 text-destructive text-xs font-semibold rounded-lg border border-destructive/20">
              {error}
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block font-black text-muted-foreground uppercase tracking-widest mb-1.5">
              Task Title <span className="text-destructive">*</span>
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to be done?"
              className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary font-semibold"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block font-black text-muted-foreground uppercase tracking-widest mb-1.5">
              Description / Action Requirements
            </label>
            <MentionTextarea
              value={description}
              onChange={setDescription}
              users={users}
              rows={3}
              placeholder="Elaborate on details... type @ to mention someone"
              className="rounded-xl border border-border bg-background px-4 py-2.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Assignees (Using shadcn MultiSelect) */}
          <div>
            <label className="block font-black text-muted-foreground uppercase tracking-widest mb-1.5">
              Assignee(s) <span className="text-destructive">*</span>
            </label>
            <MultiSelect
              options={assigneeOptions}
              selected={assignedTo}
              onChange={setAssignedTo}
              placeholder="Select assignees..."
            />
          </div>

          {/* Status, Priority & Team Assignment */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block font-black text-muted-foreground uppercase tracking-widest mb-1.5">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer font-bold uppercase"
              >
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="review">In Review</option>
                <option value="completed">Completed</option>
              </select>
            </div>
            <div>
              <label className="block font-black text-muted-foreground uppercase tracking-widest mb-1.5">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as Task["priority"])}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer font-bold uppercase"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <div>
              <label className="block font-black text-muted-foreground uppercase tracking-widest mb-1.5">
                Team Assignment
              </label>
              <select
                value={teamId}
                onChange={(e) => setTeamId(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer font-semibold"
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
              <label className="block font-black text-muted-foreground uppercase tracking-widest mb-1.5">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary font-semibold"
              />
            </div>
            <div>
              <label className="block font-black text-muted-foreground uppercase tracking-widest mb-1.5">
                Due Date
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary font-semibold"
              />
            </div>
          </div>

          {/* Attachments Section */}
          <div className="border-t border-border pt-3">
            <label className="block font-black text-muted-foreground uppercase tracking-widest mb-1.5">
              Task Attachments
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {attachments.map((file, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 bg-muted px-3 py-1.5 rounded-lg border border-border text-foreground text-[10px]"
                >
                  <Paperclip className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className="truncate max-w-[120px] font-semibold">{file.name}</span>
                  <span className="text-[9px] text-muted-foreground">({file.size})</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveAttachment(idx)}
                    className="p-0.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition"
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
              className="flex items-center gap-1.5 px-3.5 py-2 border border-dashed border-border hover:border-primary text-muted-foreground hover:text-primary rounded-xl font-bold uppercase transition"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Attachment File
            </button>
          </div>

          {/* Actions Footer */}
          <div className="flex gap-3 pt-4 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 px-4 py-5 rounded-xl border-border text-xs font-bold transition-colors disabled:opacity-50"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="flex-1 flex items-center justify-center gap-1.5 px-4 py-5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs uppercase transition-colors disabled:opacity-60"
            >
              {submitting && <Loader2 className="h-3 w-3 animate-spin" />}
              Create Action Item
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
