"use client";

import { useEffect, useState } from "react";
import { getProjectsForUser, getProjectsForTeam } from "@/lib/projects";
import { getTeamsForUser } from "@/lib/teams";
import { Project } from "@/lib/roles";
import { useAuth } from "../AuthProvider";
import { CreateProjectDialog } from "./CreateProjectDialog";
import { FolderGit2 } from "lucide-react";
import Link from "next/link";

export function ProjectList({ teamId }: { teamId?: string }) {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProjects = async () => {
    if (!user) return;
    try {
        let data: Project[] = [];
        if (teamId) {
            data = await getProjectsForTeam(teamId);
        } else {
            // "My Projects" across all teams
            // First get user teams
            const teams = await getTeamsForUser(user.uid);
            const teamIds = teams.map(t => t.id!).filter(Boolean);
            if(teamIds.length > 0) {
                 data = await getProjectsForUser(teamIds);
            }
        }
      setProjects(data);
    } catch (error) {
      console.error("Error fetching projects:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, [user, teamId]);

  if (loading) {
    return <div className="text-center py-10 opacity-60">Loading projects...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-500 to-cyan-600 bg-clip-text text-transparent">
            {teamId ? "Team Projects" : "All Projects"}
        </h2>
        <CreateProjectDialog onProjectCreated={fetchProjects} preselectedTeamId={teamId} />
      </div>

      {projects.length === 0 ? (
        <div className="text-center py-12 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <FolderGit2 className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">No projects found</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
             {teamId ? "Create a project for this team." : "Join a team to see projects or create one."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/dashboard/projects/${project.id}`}
              className="group relative flex flex-col justify-between overflow-hidden rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition-all hover:shadow-md hover:border-blue-500/50 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-blue-400/50"
            >
              <div className="mb-4">
                  <div className="flex items-center gap-2 mb-2">
                       <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                           <FolderGit2 className="h-5 w-5" />
                       </div>
                       <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                         {project.name}
                       </h3>
                  </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
                  {project.description || "No description provided."}
                </p>
              </div>
              
              <div className="mt-2 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                  <span>Status: {project.status}</span>
                  {/* Ideally fetch task count here */}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
