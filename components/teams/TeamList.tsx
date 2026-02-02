"use client";

import { useEffect, useState } from "react";
import { getTeamsForUser } from "@/lib/teams";
import { Team } from "@/lib/roles";
import { useAuth } from "../AuthProvider";
import { CreateTeamDialog } from "./CreateTeamDialog";
import { Users } from "lucide-react";
import Link from "next/link";

export function TeamList() {
  const { user } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTeams = async () => {
    if (!user) return;
    try {
      const userTeams = await getTeamsForUser(user.uid);
      setTeams(userTeams);
    } catch (error) {
      console.error("Error fetching teams:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeams();
  }, [user]);

  if (loading) {
    return <div className="text-center py-10 opacity-60">Loading teams...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent">
            My Teams
        </h2>
        <CreateTeamDialog onTeamCreated={fetchTeams} />
      </div>

      {teams.length === 0 ? (
        <div className="text-center py-12 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <Users className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">No teams yet</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Get started by creating a new team.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {teams.map((team) => (
            <Link
              key={team.id}
              href={`/dashboard/teams/${team.id}`}
              className="group relative flex flex-col justify-between overflow-hidden rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition-all hover:shadow-md hover:border-indigo-500/50 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-indigo-400/50"
            >
              <div className="mb-4">
                  <div className="flex items-center gap-2 mb-2">
                       <div className="p-2 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                           <Users className="h-5 w-5" />
                       </div>
                       <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                         {team.name}
                       </h3>
                  </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {team.members.length} member{team.members.length !== 1 ? "s" : ""}
                </p>
              </div>
              
               <div className="flex -space-x-2 overflow-hidden py-2">
                   {team.members.slice(0, 5).map((member, i) => (
                       <div key={i} className="inline-block h-8 w-8 rounded-full ring-2 ring-white dark:ring-gray-800 bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600">
                           {member.email[0].toUpperCase()}
                       </div>
                   ))}
               </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
