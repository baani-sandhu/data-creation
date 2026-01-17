"use client";

import { useEffect, useState } from "react";
import ProjectCard from "@/components/ProjectCard";
import ProjectCreateDialog from "@/components/ProjectCreateDialog";
import { projectService } from "@/services/projectService";
import type { ProjectResponse } from "@/types/projectType";
import { toast } from "sonner"; 
import { Loader2 } from "lucide-react";

export default function Projects() {
  const [projects, setProjects] = useState<ProjectResponse[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const response = await projectService.getAll(1, 10);
      // Ensure we access the data property from Axios
      setProjects(response.data.projects);
    } catch (error) {
      toast.error("Failed to load projects");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleDelete = async (projectId: string) => {
    try {
      await projectService.delete(projectId);
      // Remove from UI state immediately
      setProjects((prev) => prev.filter((p) => p._id !== projectId));
      toast.success("Project deleted successfully");
    } catch (error) {
      toast.error("Failed to delete project");
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
        <ProjectCreateDialog onSuccess={fetchProjects} />
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : projects.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((item) => (
            <ProjectCard
              key={item._id}
              project={item}
              onEdit={(proj) => console.log(proj)}
              onDelete={handleDelete} // Correctly passed
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-20 border-2 border-dashed rounded-xl">
          <p>No projects found.</p>
        </div>
      )}
    </div>
  );
}