"use client";

import { useEffect, useState, useRef } from "react";
import { 
  Task, 
  TaskComment, 
  TaskHistoryItem, 
  subscribeToTaskComments, 
  subscribeToTaskHistory,
  addTaskComment,
  updateTaskStatus,
  updateTaskProgress,
  addTaskHistory,
  TaskStatus
} from "@/lib/tasks";
import { AppUserSummary } from "@/lib/users";
import { 
  X, 
  MessageSquare, 
  Loader2, 
  Send,
  Paperclip,
  Calendar,
  FileText,
  Download,
  Trash2,
  Plus,
  Clock
} from "lucide-react";
import { MentionTextarea, extractMentionedUsers } from "@/components/MentionTextarea";

interface TaskDetailsModalProps {
  task: Task;
  onClose: () => void;
  currentUserId: string;
  currentUserName: string;
  currentUserRole?: string;
  users: AppUserSummary[];
}

interface MockAttachment {
  id: string;
  name: string;
  size: string;
  type: string;
  uploadedBy: string;
  uploadedAt: string;
}

const PRIORITY_LABELS = {
  low: "Low Priority",
  medium: "Medium Priority",
  high: "High Priority",
  critical: "Critical Priority"
};

const PRIORITY_COLORS = {
  low: "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700",
  medium: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/30",
  high: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/20 dark:text-orange-400 dark:border-orange-900/30",
  critical: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900/30",
};

export function TaskDetailsModal({ task, onClose, currentUserId, currentUserName, currentUserRole, users }: TaskDetailsModalProps) {
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [history, setHistory] = useState<TaskHistoryItem[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<"comments" | "history">("comments");
  
  // Attachments State
  const [attachments, setAttachments] = useState<MockAttachment[]>([
    { id: "att-1", name: "SOAS_Testing_Guide_v1.pdf", size: "1.4 MB", type: "pdf", uploadedBy: "Rishi", uploadedAt: "Yesterday at 3:12 PM" },
    { id: "att-2", name: "Box_Testing_Results.png", size: "450 KB", type: "image", uploadedBy: "Himanshu", uploadedAt: "Today at 9:45 AM" }
  ]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsubComments = subscribeToTaskComments(task.id, (data) => {
      setComments(data);
      setLoading(false);
    });
    
    const unsubHistory = subscribeToTaskHistory(task.id, (data) => {
      setHistory(data);
    });

    return () => {
      unsubComments();
      unsubHistory();
    };
  }, [task.id]);

  // Names Resolver
  const getUserName = (uid: string) => {
    if (uid === currentUserId) return "You";
    const u = users.find(user => user.uid === uid);
    return u?.name || u?.email || "Unknown";
  };

  const assignedToArray = Array.isArray(task.assignedTo) 
    ? task.assignedTo 
    : task.assignedTo ? [task.assignedTo] : [];

  const isAssignedToMe = assignedToArray.includes(currentUserId);
  const isCreatedByMe = task.assignedBy === currentUserId;
  const isAdminOrManager = currentUserRole === "admin" || currentUserRole === "ceo" || currentUserRole === "manager";
  
  const canEdit = isAssignedToMe || isCreatedByMe || isAdminOrManager;

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    
    setSubmitting(true);
    try {
      const mentionedUserIds = extractMentionedUsers(newComment, users);
      await addTaskComment(
        task.id, 
        newComment.trim(), 
        currentUserId, 
        currentUserName,
        task.taskText || task.title,
        task.assignedBy,
        task.assignedTo,
        mentionedUserIds
      );
      setNewComment("");
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (status: TaskStatus) => {
    setSubmitting(true);
    try {
      await updateTaskStatus(task.id, status);
      await addTaskHistory(
        task.id, 
        `Status updated to ${status.toUpperCase().replace("_", " ")}`, 
        currentUserId, 
        currentUserName
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleProgress = async (val: number) => {
    setSubmitting(true);
    try {
      await updateTaskProgress(task.id, val, task.taskText || task.title, task.assignedBy);
      await addTaskHistory(
        task.id, 
        `Progress set to ${val}%`, 
        currentUserId, 
        currentUserName
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleProgressChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    await handleProgress(val);
  };

  // Mock Upload
  const handleFileUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
    const sizeStr = parseFloat(sizeMB) > 0.1 ? `${sizeMB} MB` : `${(file.size / 1024).toFixed(0)} KB`;
    
    const newAttach: MockAttachment = {
      id: `att-${Date.now()}`,
      name: file.name,
      size: sizeStr,
      type: file.name.split(".").pop() || "file",
      uploadedBy: currentUserName,
      uploadedAt: "Just now"
    };

    setAttachments(prev => [...prev, newAttach]);
  };

  const handleRemoveAttachment = (id: string) => {
    setAttachments(prev => prev.filter(att => att.id !== id));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-full max-w-5xl rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
          <div className="flex items-center gap-3">
            <span className="text-xs font-black bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400 px-3 py-1 rounded-full uppercase tracking-wider">
              #{task.id.slice(0, 5).toUpperCase()}
            </span>
            <span className={`text-[10px] font-black border uppercase px-2.5 py-0.5 rounded-full ${PRIORITY_COLORS[task.priority as keyof typeof PRIORITY_COLORS] || PRIORITY_COLORS.medium}`}>
              {PRIORITY_LABELS[task.priority as keyof typeof PRIORITY_LABELS] || PRIORITY_LABELS.medium}
            </span>
          </div>
          
          <button 
            onClick={onClose} 
            className="p-2 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-950 dark:hover:text-white transition-all"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Two Column Workspace */}
        <div className="flex-1 overflow-y-auto flex flex-col lg:flex-row">
          
          {/* Left Column (Core Details, Attachments, Comments) */}
          <div className="flex-1 p-6 space-y-6 lg:border-r border-slate-100 dark:border-slate-800">
            {/* Title & Desc */}
            <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white leading-snug">
                {task.taskText || task.title}
              </h2>
              {task.description ? (
                <div className="mt-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 text-sm text-slate-700 dark:text-slate-300 font-medium whitespace-pre-wrap leading-relaxed">
                  {task.description}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic mt-3">No description provided for this task.</p>
              )}
            </div>

            {/* Attachments Section */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                  <Paperclip className="h-3.5 w-3.5" /> Attachments ({attachments.length})
                </h4>
                {canEdit && (
                  <button 
                    onClick={handleFileUploadClick}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300"
                  >
                    <Plus className="h-3 w-3" /> Add Attachment
                  </button>
                )}
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  className="hidden" 
                />
              </div>

              {attachments.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {attachments.map(att => (
                    <div 
                      key={att.id} 
                      className="flex items-center justify-between p-3 border border-slate-100 dark:border-slate-800 rounded-xl hover:border-indigo-100 dark:hover:border-indigo-900/30 bg-slate-50/20 dark:bg-slate-900/30 group"
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="h-9 w-9 bg-indigo-50 dark:bg-indigo-950/45 text-indigo-600 dark:text-indigo-400 rounded-lg flex items-center justify-center shrink-0">
                          <FileText className="h-4.5 w-4.5" />
                        </div>
                        <div className="overflow-hidden">
                          <p className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate" title={att.name}>
                            {att.name}
                          </p>
                          <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                            {att.size} • by {att.uploadedBy}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button 
                          title="Download"
                          className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </button>
                        {canEdit && (
                          <button 
                            onClick={() => handleRemoveAttachment(att.id)}
                            title="Remove"
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-slate-400 text-xs italic">
                  No files attached.
                </div>
              )}
            </div>

            {/* Comments & History Tabs */}
            <div>
              <div className="flex border-b border-slate-100 dark:border-slate-800 gap-6 mb-4">
                <button
                  onClick={() => setActiveTab("comments")}
                  className={`pb-2.5 text-xs font-black uppercase tracking-widest border-b-2 transition-all flex items-center gap-1.5 ${
                    activeTab === "comments" 
                      ? "border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400" 
                      : "border-transparent text-slate-400 hover:text-slate-600"
                  }`}
                >
                  <MessageSquare className="h-3.5 w-3.5" /> Discussion ({comments.length})
                </button>
                <button
                  onClick={() => setActiveTab("history")}
                  className={`pb-2.5 text-xs font-black uppercase tracking-widest border-b-2 transition-all flex items-center gap-1.5 ${
                    activeTab === "history" 
                      ? "border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400" 
                      : "border-transparent text-slate-400 hover:text-slate-600"
                  }`}
                >
                  <Clock className="h-3.5 w-3.5" /> History Log ({history.length})
                </button>
              </div>

              {loading ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
                </div>
              ) : activeTab === "comments" ? (
                <div className="space-y-4">
                  {/* Comments Log */}
                  {comments.length > 0 ? (
                    <div className="space-y-3.5 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                      {comments.map(c => {
                        const initials = c.commentedByName ? c.commentedByName.slice(0, 2).toUpperCase() : "U";
                        const dateStr = c.createdAt?.toDate ? c.createdAt.toDate().toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "Just now";
                        const timeStr = c.createdAt?.toDate ? c.createdAt.toDate().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "";
                        
                        return (
                          <div key={c.id} className="flex gap-3 bg-slate-50/40 dark:bg-slate-900/40 border border-slate-100/50 dark:border-slate-800/80 p-3.5 rounded-2xl">
                            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                              {initials}
                            </div>
                            <div className="flex-1">
                              <div className="flex justify-between items-start">
                                <h5 className="text-xs font-black text-slate-800 dark:text-slate-200">
                                  {c.commentedByName || "User"}
                                </h5>
                                <span className="text-[10px] text-slate-400 font-bold">
                                  {dateStr} {timeStr && `at ${timeStr}`}
                                </span>
                              </div>
                              <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mt-1 whitespace-pre-wrap leading-relaxed">
                                {c.comment}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">No comments yet. Write a comment to coordinate with your team.</p>
                  )}

                  {/* Comment Input Form */}
                  <form onSubmit={handleAddComment} className="flex gap-2 pt-2">
                    <div className="flex-1">
                      <MentionTextarea
                        value={newComment}
                        onChange={setNewComment}
                        users={users}
                        rows={2}
                        placeholder="Coordination comment... type @ to mention someone"
                        className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 w-full"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={submitting || !newComment.trim()}
                      className="h-[42px] px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase flex items-center justify-center transition-colors disabled:opacity-50"
                    >
                      {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </button>
                  </form>
                </div>
              ) : (
                /* History List */
                <div className="space-y-4">
                  {history.length > 0 ? (
                    <div className="space-y-4 max-h-72 overflow-y-auto pr-2 custom-scrollbar pl-2 relative border-l border-slate-100 dark:border-slate-800 ml-2">
                      {history.map(h => {
                        const dateStr = h.createdAt?.toDate ? h.createdAt.toDate().toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "Just now";
                        const timeStr = h.createdAt?.toDate ? h.createdAt.toDate().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "";
                        
                        return (
                          <div key={h.id} className="relative flex gap-3 items-start group">
                            <div className="absolute -left-[17px] mt-1 h-2 w-2 rounded-full bg-slate-400 ring-4 ring-white dark:ring-slate-900 shrink-0" />
                            <div className="flex-1 bg-slate-50/50 dark:bg-slate-850 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                              <div className="flex justify-between items-start mb-0.5">
                                <span className="text-[10px] font-black text-slate-800 dark:text-slate-300">
                                  {h.performedByName || "System"}
                                </span>
                                <span className="text-[9px] text-slate-400 font-bold">
                                  {dateStr} {timeStr && `at ${timeStr}`}
                                </span>
                              </div>
                              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{h.message}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">No history logged yet.</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Column (Metadata sidebar) */}
          <div className="w-full lg:w-80 p-6 bg-slate-50/30 dark:bg-slate-950/20 space-y-6">
            
            {/* Status Switcher */}
            <div>
              <h4 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">
                Task Status
              </h4>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { value: "pending" as const, label: "To Do" },
                  { value: "in_progress" as const, label: "In Progress" },
                  { value: "review" as const, label: "Review" },
                  { value: "completed" as const, label: "Completed" }
                ].map(s => {
                  const isActive = task.status === s.value;
                  return (
                    <button
                      key={s.value}
                      onClick={() => handleStatusChange(s.value)}
                      disabled={submitting || !canEdit}
                      className={`px-3 py-2 rounded-xl text-xs font-extrabold uppercase transition-all border ${
                        isActive 
                          ? "bg-indigo-600 border-indigo-600 text-white shadow-sm shadow-indigo-600/20" 
                          : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 hover:bg-slate-50 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                      }`}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>

              {/* Extra Admin Approval Controls */}
              {isAdminOrManager && task.status === "completed" && (
                <div className="mt-3 p-3 bg-teal-50 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-900/30 rounded-xl space-y-2">
                  <p className="text-[10px] font-black text-teal-850 dark:text-teal-400 uppercase tracking-wider">
                    Approval Workspace
                  </p>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => handleStatusChange("approved")}
                      className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold rounded-lg uppercase tracking-wide transition-colors"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleStatusChange("rejected")}
                      className="flex-1 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold rounded-lg uppercase tracking-wide transition-colors"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => handleStatusChange("hold")}
                      className="flex-1 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-[10px] font-bold rounded-lg uppercase tracking-wide transition-colors"
                    >
                      Hold
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Progress Slider */}
            <div>
              <div className="flex justify-between items-center text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2.5">
                <span>Progress Tracker</span>
                <span className="text-slate-800 dark:text-slate-200">{task.progress || 0}%</span>
              </div>
              <div className="flex items-center gap-3">
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  step="5"
                  value={task.progress || 0}
                  onChange={handleProgressChange}
                  disabled={submitting || !canEdit}
                  className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-600 dark:accent-indigo-400"
                />
              </div>
              {canEdit && (
                <div className="flex gap-1.5 mt-2.5">
                  {[25, 50, 75, 100].map(val => (
                    <button
                      key={val}
                      onClick={() => {
                        handleProgress(val);
                      }}
                      disabled={submitting}
                      className="text-[9px] font-extrabold px-1.5 py-1 bg-white border border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-800 dark:hover:bg-slate-800 text-slate-650 dark:text-slate-400 rounded-lg transition-colors flex-1"
                    >
                      {val}%
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Assignment Details */}
            <div className="space-y-4 border-t border-slate-100 dark:border-slate-800 pt-4">
              {/* Assigned By */}
              <div>
                <span className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">
                  Assigned By
                </span>
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-full bg-indigo-50 dark:bg-indigo-950/45 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-[10px] font-black shrink-0 border border-indigo-100 dark:border-indigo-900/30">
                    {task.assignedBy === currentUserId ? "ME" : getUserName(task.assignedBy).slice(0, 2).toUpperCase()}
                  </div>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {task.assignedBy === task.assignedTo && task.assignedBy === currentUserId ? "Self Task" : getUserName(task.assignedBy)}
                  </span>
                </div>
              </div>

              {/* Assigned To */}
              <div>
                <span className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">
                  Assigned To
                </span>
                <div className="space-y-1.5">
                  {assignedToArray.length > 0 ? (
                    assignedToArray.map(uid => (
                      <div key={uid} className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-emerald-50 dark:bg-emerald-950/45 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-[10px] font-black shrink-0 border border-emerald-100 dark:border-emerald-900/30">
                          {uid === currentUserId ? "ME" : getUserName(uid).slice(0, 2).toUpperCase()}
                        </div>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          {getUserName(uid)}
                        </span>
                      </div>
                    ))
                  ) : (
                    <span className="text-xs font-medium text-slate-400 italic">No assignees</span>
                  )}
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4 border-t border-slate-100 dark:border-slate-800 pt-4">
                <div>
                  <span className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">
                    Start Date
                  </span>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
                    <Calendar className="h-3.5 w-3.5 text-slate-400" />
                    <span>
                      {task.startDate ? new Date(task.startDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "—"}
                    </span>
                  </div>
                </div>
                <div>
                  <span className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">
                    Due Date
                  </span>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
                    <Calendar className="h-3.5 w-3.5 text-slate-400" />
                    <span>
                      {task.dueDate ? new Date(task.dueDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "—"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
