"use client";

import { useEffect, useState } from "react";
import { TeamMember } from "@/lib/roles";
import { getTeam, removeMemberFromTeam } from "@/lib/teams";
import { InviteMemberDialog } from "./InviteMemberDialog";
import { Trash2, Shield } from "lucide-react";

export function TeamMembers({ teamId }: { teamId: string }) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTeam = async () => {
    try {
      const team = await getTeam(teamId);
      if (team) {
        setMembers(team.members);
      }
    } catch (error) {
      console.error("Error fetching team members:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeam();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

  // Allow removing members
  const handleRemove = async (uidToRemove: string) => {
    if (!confirm("Are you sure you want to remove this member?")) return;
    await removeMemberFromTeam(teamId, uidToRemove);
    fetchTeam();
  }

  if (loading) return <div>Loading members...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">Team Members</h3>
        <InviteMemberDialog teamId={teamId} />
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <ul className="divide-y divide-gray-200 dark:divide-gray-700">
          {members.map((member) => (
            <li key={member.uid} className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold">
                  {member.email[0].toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{member.email}</p>
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <Shield className="h-3 w-3" />
                    <span className="capitalize">{member.role}</span>
                  </div>
                </div>
              </div>

              {/* Only admins/managers (or owner) can remove - simplistic check for now */}
              <button
                onClick={() => handleRemove(member.uid)}
                className="text-red-500 hover:text-red-700 p-2"
                title="Remove member"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
