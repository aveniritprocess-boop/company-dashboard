import { TaskBoard } from "@/components/tasks/TaskBoard";

export default function TasksPage() {
  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
          Tasks Board
        </h1>
      </div>
      <TaskBoard />
    </div>
  );
}
