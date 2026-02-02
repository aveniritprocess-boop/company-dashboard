import { TodoList } from "@/components/TodoList";

export default function TodosPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
          Todo List
        </h1>
      </div>
      <TodoList />
    </div>
  );
}
