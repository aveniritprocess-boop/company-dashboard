"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { TeamMembers } from "@/components/teams/TeamMembers";
import { ProjectList } from "@/components/projects/ProjectList";
import { getTeam } from "@/lib/teams";
import { Team } from "@/lib/roles";

export default function TeamDetailsPage() {
    const params = useParams();
    const teamId = params?.teamId as string;
    const [team, setTeam] = useState<Team | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if(!teamId) return;
        async function fetch() {
            const data = await getTeam(teamId);
            setTeam(data);
            setLoading(false);
        }
        fetch();
    }, [teamId]);

    if (loading) return <div className="p-8">Loading team...</div>;
    if (!team) return <div className="p-8">Team not found</div>;

    return (
        <div className="p-8 max-w-5xl mx-auto space-y-8">
            <div className="border-b border-gray-200 dark:border-gray-700 pb-6">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{team.name}</h1>
                <p className="mt-2 text-gray-500">Manage your team members and settings.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Content */}
                <div className="lg:col-span-2 space-y-8">
                    <section>
                         <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Active Projects</h2>
                         <ProjectList teamId={teamId} />
                    </section>
                </div>

                {/* Sidebar / Members */}
                <div className="space-y-8">
                    <TeamMembers teamId={teamId} />
                </div>
            </div>
        </div>
    );
}
