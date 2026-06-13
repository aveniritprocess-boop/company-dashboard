"use client";

import { useEffect, useState, useRef } from "react";
import {
  Task,
  TaskComment,
  subscribeToTaskComments,
  addTaskComment,
} from "@/lib/tasks";
import { AppUserSummary } from "@/lib/users";
import {
  X,
  Send,
  Loader2,
  MessageSquare,
  Pencil,
  Trash2,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { MentionTextarea, extractMentionedUsers } from "@/components/MentionTextarea";
import {
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

interface TaskCommentPanelProps {
  task: Task;
  onClose: () => void;
  currentUserId: string;
  currentUserName: string;
  currentUserRole?: string;
  users: AppUserSummary[];
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getAvatarColor(name: string) {
  const colors = [
    "bg-violet-500", "bg-indigo-500", "bg-blue-500", "bg-cyan-500",
    "bg-emerald-500", "bg-amber-500", "bg-orange-500", "bg-rose-500",
  ];
  let sum = 0;
  for (let i = 0; i < name.length; i++) sum += name.charCodeAt(i);
  return colors[sum % colors.length];
}

function renderCommentText(text: string, users: AppUserSummary[]) {
  const parts = text.split(/(@\w+)/g);
  return parts.map((part, i) => {
    if (part.startsWith("@")) {
      const mentionName = part.slice(1).toLowerCase();
      const matched = users.find(
        (u) =>
          (u.name && u.name.replace(/\s+/g, "").toLowerCase() === mentionName) ||
          (u.email && u.email.split("@")[0].toLowerCase() === mentionName)
      );
      if (matched) {
        return (
          <span key={i} className="font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-1 rounded">
            {part}
          </span>
        );
      }
    }
    return <span key={i}>{part}</span>;
  });
}

export function TaskCommentPanel({
  task,
  onClose,
  currentUserId,
  currentUserName,
  currentUserRole,
  users,
}: TaskCommentPanelProps) {
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsub = subscribeToTaskComments(task.id, (data) => {
      setComments(data);
      setLoading(false);
    });
    return () => unsub();
  }, [task.id]);

  // Auto-scroll to bottom on new comments
  useEffect(() => {
    if (!loading) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [comments, loading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || submitting) return;
    setSubmitting(true);
    try {
      const mentioned = extractMentionedUsers(newComment, users);
      await addTaskComment(
        task.id,
        newComment.trim(),
        currentUserId,
        currentUserName,
        task.taskText || task.title,
        task.assignedBy,
        task.assignedTo,
        mentioned
      );
      setNewComment("");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSave = async (commentId: string) => {
    if (!editText.trim()) return;
    const ref = doc(db, "tasks", task.id, "comments", commentId);
    await updateDoc(ref, { comment: editText.trim(), updatedAt: serverTimestamp() });
    setEditingId(null);
    setEditText("");
  };

  const handleDelete = async (commentId: string) => {
    const ref = doc(db, "tasks", task.id, "comments", commentId);
    await deleteDoc(ref);
    setDeletingId(null);
  };

  const isAdminOrCEO = currentUserRole === "admin" || currentUserRole === "ceo";

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md flex flex-col bg-white dark:bg-slate-900 shadow-2xl border-l border-slate-200 dark:border-slate-800 animate-slide-in-right">

        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-indigo-600 to-violet-600 text-white flex-shrink-0">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 opacity-80" />
              <span className="text-xs font-semibold uppercase tracking-widest opacity-80">Comments</span>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <h2 className="font-bold text-base leading-tight line-clamp-2">
            {task.taskText || task.title}
          </h2>
          <div className="flex gap-2 mt-2">
            <span className="text-[10px] font-bold px-2 py-0.5 bg-white/20 rounded-full uppercase">
              {task.status.replace("_", " ")}
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 bg-white/20 rounded-full uppercase">
              {task.priority} priority
            </span>
          </div>
        </div>

        {/* Comments List */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
            </div>
          ) : comments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="h-16 w-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                <MessageSquare className="h-8 w-8 text-slate-400" />
              </div>
              <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">No comments yet</p>
              <p className="text-xs text-slate-400 mt-1">Be the first to comment on this task</p>
            </div>
          ) : (
            comments.map((c) => {
              const isMine = c.commentedBy === currentUserId;
              const canDelete = isMine || isAdminOrCEO;
              const name = c.commentedByName || "User";
              const time = c.createdAt?.toDate ? c.createdAt.toDate() : new Date();
              const isEditing = editingId === c.id;
              const isDeleting = deletingId === c.id;

              return (
                <div key={c.id} className={`flex gap-3 group ${isMine ? "flex-row-reverse" : ""}`}>
                  {/* Avatar */}
                  <div className={`h-8 w-8 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold ${getAvatarColor(name)}`}>
                    {getInitials(name)}
                  </div>

                  {/* Bubble */}
                  <div className={`flex-1 min-w-0 ${isMine ? "items-end" : "items-start"} flex flex-col gap-1`}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-bold text-slate-800 dark:text-slate-200 ${isMine ? "order-2" : ""}`}>
                        {isMine ? "You" : name}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {time.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>

                    {isDeleting ? (
                      <div className={`rounded-2xl px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 max-w-[90%]`}>
                        <p className="text-xs text-red-700 dark:text-red-400 mb-2 font-medium">Delete this comment?</p>
                        <div className="flex gap-2">
                          <button onClick={() => handleDelete(c.id)} className="flex items-center gap-1 px-2.5 py-1 bg-red-600 text-white text-xs rounded-lg font-semibold hover:bg-red-700 transition-colors">
                            <Trash2 className="h-3 w-3" /> Delete
                          </button>
                          <button onClick={() => setDeletingId(null)} className="flex items-center gap-1 px-2.5 py-1 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs rounded-lg font-semibold transition-colors">
                            <XCircle className="h-3 w-3" /> Cancel
                          </button>
                        </div>
                      </div>
                    ) : isEditing ? (
                      <div className="w-full max-w-[90%]">
                        <textarea
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          rows={2}
                          className="w-full text-sm rounded-xl border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-slate-800 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                        />
                        <div className="flex gap-2 mt-1.5">
                          <button onClick={() => handleEditSave(c.id)} className="flex items-center gap-1 px-2.5 py-1 bg-indigo-600 text-white text-xs rounded-lg font-semibold hover:bg-indigo-700 transition-colors">
                            <CheckCircle className="h-3 w-3" /> Save
                          </button>
                          <button onClick={() => { setEditingId(null); setEditText(""); }} className="flex items-center gap-1 px-2.5 py-1 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs rounded-lg font-semibold transition-colors">
                            <XCircle className="h-3 w-3" /> Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className={`relative rounded-2xl px-4 py-2.5 max-w-[90%] text-sm leading-relaxed break-words
                        ${isMine
                          ? "bg-indigo-600 text-white rounded-tr-sm"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-sm"
                        }`}>
                        {isMine
                          ? c.comment
                          : renderCommentText(c.comment, users)
                        }

                        {/* Action buttons */}
                        {(isMine || canDelete) && (
                          <div className={`absolute ${isMine ? "-left-16" : "-right-16"} top-0 hidden group-hover:flex items-center gap-1`}>
                            {isMine && (
                              <button
                                onClick={() => { setEditingId(c.id); setEditText(c.comment); }}
                                className="p-1.5 rounded-lg bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-indigo-600 transition-colors"
                              >
                                <Pencil className="h-3 w-3" />
                              </button>
                            )}
                            {canDelete && (
                              <button
                                onClick={() => setDeletingId(c.id)}
                                className="p-1.5 rounded-lg bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-red-600 transition-colors"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        {/* Comment Input */}
        <div className="flex-shrink-0 px-5 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
          <form onSubmit={handleSubmit} className="flex items-end gap-2">
            <div className={`h-8 w-8 flex-shrink-0 rounded-full flex items-center justify-center text-white text-xs font-bold mb-0.5 ${getAvatarColor(currentUserName)}`}>
              {getInitials(currentUserName)}
            </div>
            <div className="flex-1">
              <MentionTextarea
                value={newComment}
                onChange={setNewComment}
                users={users}
                rows={2}
                placeholder="Write a comment… Use @ to mention"
                className="w-full text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-400"
              />
            </div>
            <button
              type="submit"
              disabled={submitting || !newComment.trim()}
              className="h-10 w-10 flex-shrink-0 flex items-center justify-center rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </form>
          <p className="text-[10px] text-slate-400 mt-1.5 ml-10">Press Enter to send • @ to mention</p>
        </div>
      </div>
    </>
  );
}
