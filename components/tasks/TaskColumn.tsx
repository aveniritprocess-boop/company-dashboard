"use client";

import { Task, TaskStatus } from "@/lib/tasks";
import { TaskCard } from "./TaskCard";

interface TaskColumnProps {
  title: string;
  status: TaskStatus;
  tasks: Task[];
  currentUserId: string;
}

export function TaskColumn({ title, status, tasks, currentUserId }: TaskColumnProps) {
  // Count tasks in this column
  const count = tasks.length;
  
  const statusColors = {
      backlog: "bg-gray-200 dark:bg-gray-700",
      todo: "bg-blue-200 dark:bg-blue-700",
      in_progress: "bg-yellow-200 dark:bg-yellow-700",
      done: "bg-green-200 dark:bg-green-700"
  };

  return (
    <div className="flex flex-col h-full min-w-[280px] w-full bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-800">
      <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between sticky top-0 bg-inherit rounded-t-xl z-10">
        <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${statusColors[status]}`} />
            <h3 className="font-semibold text-gray-700 dark:text-gray-200 text-sm uppercase tracking-wide">
                {title}
            </h3>
        </div>
        <span className="bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs px-2 py-0.5 rounded-full font-medium">
            {count}
        </span>
      </div>
      
      <div className="p-3 flex-1 overflow-y-auto space-y-3 min-h-[200px]">
        {tasks.map(task => (
            <TaskCard key={task.id} task={task} currentUserId={currentUserId} />
        ))}
        {tasks.length === 0 && (
            <div className="h-24 border-2 border-dashed border-gray-200 dark:border-gray-700/50 rounded-lg flex items-center justify-center text-gray-400 text-xs">
                No tasks
            </div>
        )}
      </div>
    </div>
  );
}
