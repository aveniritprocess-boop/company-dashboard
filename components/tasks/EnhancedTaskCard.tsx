"use client";

import { useEffect, useState } from "react";
import { 
  Task, 
  TaskComment, 
  updateTaskProgress, 
  startTask, 
  reopenTask, 
  deleteTask, 
  addTaskComment, 
  subscribeToTaskComments,
  TaskHistoryItem,
  subscribeToTaskHistory,
  addTaskHistory
} from "@/lib/tasks";
import { 
  CheckCircle2, 
  Trash2, 
  Play, 
  RotateCcw, 
  MessageSquare, 
  Send,
  AlertCircle
} from "lucide-react";

interface EnhancedTaskCardProps {
  task: Task;
  currentUserId: string;
  currentUserRole: string | undefined;
  currentUserName?: string;
}

export function EnhancedTaskCard({ task, currentUserId, currentUserRole, currentUserName }: EnhancedTaskCardProps) {
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [history, setHistory] = useState<TaskHistoryItem[]>([]);
  const [showComments, setShowComments] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let unsubComments: () => void;
    let unsubHistory: () => void;
    
    if (showComments || comments.length === 0) {
      unsubComments = subscribeToTaskComments(task.id, (fetchedComments) => {
        setComments(fetchedComments);
      });
    }
    
    if (showHistory || history.length === 0) {
      unsubHistory = subscribeToTaskHistory(task.id, (fetchedHistory) => {
        setHistory(fetchedHistory);
      });
    }

    return () => {
      if (unsubComments) unsubComments();
      if (unsubHistory) unsubHistory();
    };
  }, [task.id, showComments, showHistory, comments.length, history.length]);

  const isAssignedToMe = Array.isArray(task.assignedTo) 
    ? task.assignedTo.includes(currentUserId) 
    : task.assignedTo === currentUserId;

  const isAdminOrCEO = currentUserRole === "admin" || currentUserRole === "ceo" || currentUserRole === "md";
  const canEdit = isAssignedToMe || isAdminOrCEO || currentUserRole === "manager";
  const canDelete = isAdminOrCEO && task.status === "completed";

  const isOverdue = (() => {
    if (task.status === "completed" || !task.dueDate) return false;
    const due = new Date(task.dueDate);
    const now = new Date();
    due.setHours(0,0,0,0);
    now.setHours(0,0,0,0);
    return now > due;
  })();

  const progress = task.progress || 0;

  const handleStart = async () => {
    if (!canEdit) return;
    setLoading(true);
    await startTask(task.id);
    await addTaskHistory(task.id, "Started the task", currentUserId, currentUserName || "User");
    setLoading(false);
  };

  const handleMarkCompleted = async () => {
    if (!canEdit) return;
    setLoading(true);
    await updateTaskProgress(task.id, 100, task.taskText || task.title, task.assignedBy);
    await addTaskHistory(task.id, "Marked task as 100% completed", currentUserId, currentUserName || "User");
    setLoading(false);
  };

  const handleProgressUpdate = async (val: number) => {
    if (!canEdit) return;
    setLoading(true);
    await updateTaskProgress(task.id, val, task.taskText || task.title, task.assignedBy);
    await addTaskHistory(task.id, `Updated progress to ${val}%`, currentUserId, currentUserName || "User");
    setLoading(false);
  };

  const handleReopen = async () => {
    if (!canEdit) return;
    setLoading(true);
    await reopenTask(task.id);
    await addTaskHistory(task.id, "Reopened the task", currentUserId, currentUserName || "User");
    setLoading(false);
  };

  const handleDelete = async () => {
    if (!canDelete) return;
    if (confirm("Are you sure you want to delete this completed task?")) {
      setLoading(true);
      await deleteTask(task.id);
      setLoading(false);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !canEdit) return;
    setLoading(true);
    await addTaskComment(
      task.id, 
      newComment.trim(), 
      currentUserId, 
      currentUserName || "User",
      task.taskText || task.title,
      task.assignedBy,
      task.assignedTo
    );
    setNewComment("");
    setLoading(false);
  };

  return (
    <div className={`bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border transition-shadow ${loading ? 'opacity-60 pointer-events-none' : ''} ${isOverdue ? 'border-red-400 dark:border-red-500/50 shadow-red-500/10' : 'border-gray-200 dark:border-gray-700'}`}>
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className={`text-xs px-2.5 py-1 rounded-full font-semibold capitalize tracking-wide ${
              task.status === "completed" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" 
              : task.status === "in_progress" ? "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
              : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
            }`}>
              {task.status === 'pending' ? 'Not Started' : task.status.replace("_", " ")}
            </span>
            {isOverdue && (
              <span className="text-xs px-2.5 py-1 rounded-full font-semibold bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> Overdue
              </span>
            )}
          </div>
          
          <h3 className="text-base font-bold text-gray-900 dark:text-white mb-2 leading-tight">
            {task.taskText || task.title}
          </h3>
          
          {task.description && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
              {task.description}
            </p>
          )}

          <div className="grid grid-cols-3 gap-2 text-xs text-gray-500 dark:text-gray-400 mb-4 bg-gray-50 dark:bg-gray-900/50 p-3 rounded-xl border border-gray-100 dark:border-gray-800">
            <div>
              <span className="font-medium text-gray-700 dark:text-gray-300 block mb-0.5">Start Date</span>
              {task.startDate ? new Date(task.startDate).toLocaleDateString() : "Not set"}
            </div>
            <div>
              <span className="font-medium text-gray-700 dark:text-gray-300 block mb-0.5">Due Date</span>
              {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "Not set"}
            </div>
            <div>
              <span className="font-medium text-gray-700 dark:text-gray-300 block mb-0.5">Priority</span>
              <span className={`uppercase font-bold ${task.priority === 'high' ? 'text-red-500' : task.priority === 'low' ? 'text-gray-500' : 'text-blue-500'}`}>
                {task.priority || "Medium"}
              </span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mb-4">
            <div className="flex justify-between items-end mb-1.5">
              <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Progress</span>
              <span className="text-xs font-bold text-gray-900 dark:text-white">{progress}%</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
              <div 
                className={`h-2.5 rounded-full transition-all duration-500 ease-out ${progress === 100 ? 'bg-emerald-500' : progress > 0 ? 'bg-blue-500' : 'bg-gray-400 dark:bg-gray-500'}`} 
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            
            {canEdit && task.status !== "completed" && (
              <div className="flex gap-2 mt-3 overflow-x-auto pb-1 hide-scrollbar">
                {[25, 50, 75, 100].map(val => (
                  <button
                    key={val}
                    onClick={() => handleProgressUpdate(val)}
                    className="text-[10px] font-medium px-2 py-1 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded border border-gray-200 dark:border-gray-700 transition-colors whitespace-nowrap"
                  >
                    Set {val}%
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        {(canEdit || canDelete) && (
          <div className="shrink-0 flex flex-row sm:flex-col gap-2 w-full sm:w-auto mt-4 sm:mt-0">
            {task.status === "pending" && canEdit && (
              <button onClick={handleStart} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-colors shadow-sm">
                <Play className="h-4 w-4" /> Start Task
              </button>
            )}
            
            {task.status === "in_progress" && canEdit && (
              <button onClick={handleMarkCompleted} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-xl transition-colors shadow-sm">
                <CheckCircle2 className="h-4 w-4" /> Complete
              </button>
            )}

            {task.status === "completed" && canEdit && (
              <button onClick={handleReopen} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-xl transition-colors shadow-sm">
                <RotateCcw className="h-4 w-4" /> Reopen
              </button>
            )}

            {task.status === "completed" && canDelete && (
              <button onClick={handleDelete} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm font-medium rounded-xl transition-colors">
                <Trash2 className="h-4 w-4" /> Delete
              </button>
            )}
          </div>
        )}
      </div>

      {/* Footer Tabs */}
      <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700/50 flex gap-6">
        <button 
          onClick={() => { setShowComments(!showComments); setShowHistory(false); }}
          className={`flex items-center gap-2 text-sm transition-colors font-medium ${showComments ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'}`}
        >
          <MessageSquare className="h-4 w-4" />
          {comments.length} Comments
        </button>

        <button 
          onClick={() => { setShowHistory(!showHistory); setShowComments(false); }}
          className={`flex items-center gap-2 text-sm transition-colors font-medium ${showHistory ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'}`}
        >
          <RotateCcw className="h-4 w-4" />
          History
        </button>
      </div>

      <div className="mt-4">
        {showComments && (
          <div className="mt-4 space-y-4">
            {comments.length > 0 ? (
              <div className="space-y-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                {comments.map(c => (
                  <div key={c.id} className="bg-gray-50 dark:bg-gray-900/60 p-3 rounded-xl border border-gray-100 dark:border-gray-800">
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-xs font-bold text-gray-900 dark:text-white">
                        {c.commentedByName || "User"}
                      </span>
                      <span className="text-[10px] text-gray-400">
                        {c.createdAt && c.createdAt.toDate ? c.createdAt.toDate().toLocaleString() : "Just now"}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{c.comment}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic">No comments yet. Be the first to update!</p>
            )}

            {canEdit && (
              <form onSubmit={handleAddComment} className="flex gap-2">
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Add a comment or update..."
                  className="flex-1 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="submit"
                  disabled={!newComment.trim() || loading}
                  className="shrink-0 flex items-center justify-center p-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
            )}
          </div>
        )}

        {showHistory && (
          <div className="space-y-4">
            {history.length > 0 ? (
              <div className="space-y-4 max-h-64 overflow-y-auto pr-2 custom-scrollbar relative before:absolute before:inset-0 before:ml-2 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-gray-200 dark:before:via-gray-700 before:to-transparent">
                {history.map(h => (
                  <div key={h.id} className="relative flex items-start gap-3">
                    <div className="mt-1.5 h-2 w-2 rounded-full bg-blue-500 ring-4 ring-white dark:ring-gray-800 shrink-0 relative z-10 ml-[3px]" />
                    <div className="flex-1 bg-gray-50 dark:bg-gray-900/60 p-3 rounded-xl border border-gray-100 dark:border-gray-800">
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-xs font-bold text-gray-900 dark:text-white">
                          {h.performedByName || "User"}
                        </span>
                        <span className="text-[10px] text-gray-400">
                          {h.createdAt && h.createdAt.toDate ? h.createdAt.toDate().toLocaleString() : "Just now"}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 dark:text-gray-300">{h.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic">No history tracked yet.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
