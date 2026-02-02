import { ProjectList } from "@/components/projects/ProjectList";

export default function ProjectsPage() {
  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Projects</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          View all projects across your teams.
        </p>
      </div>

      <ProjectList />
    </div>
  );
}
