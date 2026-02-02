"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Project } from "@/lib/roles";
import { getProject } from "@/lib/projects";
import { TaskManager } from "@/components/TaskManager"; // Re-using for now, will need refactor later for project context

export default function ProjectDetailsPage() {
    const params = useParams();
    const projectId = params?.projectId as string;
    const [project, setProject] = useState<Project | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if(!projectId) return;
        async function fetch() {
            const data = await getProject(projectId);
            setProject(data);
            setLoading(false);
        }
        fetch();
    }, [projectId]);

    if (loading) return <div className="p-8">Loading project...</div>;
    if (!project) return <div className="p-8">Project not found</div>;

    return (
        <div className="p-8 max-w-6xl mx-auto space-y-8">
            <div className="border-b border-gray-200 dark:border-gray-700 pb-6">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{project.name}</h1>
                <p className="mt-2 text-gray-500">{project.description}</p>
            </div>
            
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                <TaskManager context="project" contextId={projectId} />
            </div>
        </div>
    );
}
