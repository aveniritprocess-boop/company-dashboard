import { TeamList } from "@/components/teams/TeamList";

export default function TeamsPage() {
  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Teams</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Create and manage teams to collaborate on projects.
        </p>
      </div>

      <TeamList />
    </div>
  );
}
