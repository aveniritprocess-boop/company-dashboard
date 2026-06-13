"use client";

import { useEffect, useState } from "react";
import { 
  Task, 
  subscribeToTaskComments, 
  subscribeToTaskHistory 
} from "@/lib/tasks";
import { 
  MessageSquare, 
  Clipboard, 
  Play, 
  CheckCircle2, 
  UserPlus,
  Loader2,
  Calendar
} from "lucide-react";

interface ActivityTimelineProps {
  tasks: Task[];
}

interface ActivityEvent {
  id: string;
  type: "created" | "assigned" | "comment" | "status" | "completed" | "other";
  message: string;
  performedBy: string;
  performedByName: string;
  taskTitle: string;
  taskId: string;
  createdAt: Date;
}

export function ActivityTimeline({ tasks }: ActivityTimelineProps) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const targetTasks = tasks.slice(0, 15);
  const isCurrentlyLoading = targetTasks.length > 0 && loading;

  useEffect(() => {
    const target = tasks.slice(0, 15);
    if (target.length === 0) {
      return;
    }

    const unsubs: (() => void)[] = [];
    const taskEventMap: Record<string, ActivityEvent[]> = {};

    const updateAllEvents = () => {
      const allEvents = Object.values(taskEventMap).flat();
      allEvents.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      setEvents(allEvents.slice(0, 30)); // Show top 30 events
      setLoading(false);
    };

    target.forEach(task => {
      const taskId = task.id;
      const taskTitle = task.taskText || task.title || "Untitled Task";

      // Subscribe to history
      const unsubHist = subscribeToTaskHistory(taskId, (historyItems) => {
        const histEvents = historyItems.map(h => {
          const createdAt = h.createdAt?.toDate ? h.createdAt.toDate() : new Date();
          const msg = h.message.toLowerCase();
          
          let type: ActivityEvent["type"] = "other";
          if (msg.includes("created")) type = "created";
          else if (msg.includes("assigned")) type = "assigned";
          else if (msg.includes("status changed to completed") || msg.includes("marked task as 100% completed") || msg.includes("status changed to approved")) type = "completed";
          else if (msg.includes("status changed") || msg.includes("progress")) type = "status";

          return {
            id: h.id,
            type,
            message: h.message,
            performedBy: h.performedBy,
            performedByName: h.performedByName || "System",
            taskTitle,
            taskId,
            createdAt
          };
        });

        taskEventMap[`${taskId}_hist`] = histEvents;
        updateAllEvents();
      });

      // Subscribe to comments
      const unsubComm = subscribeToTaskComments(taskId, (comments) => {
        const commEvents = comments.map(c => {
          const createdAt = c.createdAt?.toDate ? c.createdAt.toDate() : new Date();
          return {
            id: c.id,
            type: "comment" as const,
            message: `commented: "${c.comment.length > 60 ? c.comment.slice(0, 60) + "..." : c.comment}"`,
            performedBy: c.commentedBy,
            performedByName: c.commentedByName || "User",
            taskTitle,
            taskId,
            createdAt
          };
        });

        taskEventMap[`${taskId}_comm`] = commEvents;
        updateAllEvents();
      });

      unsubs.push(unsubHist, unsubComm);
    });

    return () => {
      unsubs.forEach(unsub => unsub());
    };
  }, [tasks]); // Refresh listeners when the list of tasks changes

  if (isCurrentlyLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
        <p className="text-xs text-slate-500 font-semibold">Compiling recent activity timeline...</p>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-400 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6">
        <Calendar className="h-8 w-8 text-slate-300 dark:text-slate-700 mb-2" />
        <p className="text-xs font-semibold italic">No activity logged recently.</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
      <h3 className="text-sm font-black text-slate-900 dark:text-white mb-5 tracking-tight uppercase">
        Recent Activity Timeline
      </h3>

      <div className="relative border-l border-slate-100 dark:border-slate-800 space-y-6 pl-5 ml-2.5">
        {events.map((event, index) => {
          // Select icon and color
          let Icon = Clipboard;
          let colorClass = "bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-400";

          switch (event.type) {
            case "created":
              Icon = Clipboard;
              colorClass = "bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400";
              break;
            case "assigned":
              Icon = UserPlus;
              colorClass = "bg-purple-50 text-purple-600 dark:bg-purple-950/30 dark:text-purple-400";
              break;
            case "comment":
              Icon = MessageSquare;
              colorClass = "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/30 dark:text-indigo-400";
              break;
            case "status":
              Icon = Play;
              colorClass = "bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400";
              break;
            case "completed":
              Icon = CheckCircle2;
              colorClass = "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400";
              break;
            default:
              Icon = Clipboard;
              colorClass = "bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-400";
          }

          const timeStr = event.createdAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
          const dateStr = event.createdAt.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });

          return (
            <div key={event.id + index} className="relative flex gap-4 items-start group">
              {/* Event Bullet */}
              <div className={`absolute -left-[31px] mt-0.5 h-6 w-6 rounded-full flex items-center justify-center ring-4 ring-white dark:ring-slate-900 border border-slate-100 dark:border-slate-800 ${colorClass}`}>
                <Icon className="h-3 w-3" />
              </div>

              {/* Event Description */}
              <div className="flex-1">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-1">
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    <span className="font-extrabold text-slate-900 dark:text-white mr-1">
                      {event.performedByName}
                    </span>
                    {event.message}
                  </p>
                  <span className="text-[10px] text-slate-400 font-bold whitespace-nowrap">
                    {dateStr} at {timeStr}
                  </span>
                </div>
                
                {/* Related Task Link */}
                <p className="text-[10px] text-indigo-500 font-bold mt-1 uppercase tracking-wider">
                  Task: {event.taskTitle}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
