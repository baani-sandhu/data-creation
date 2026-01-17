import api from "./axios";
import type { Project, ProjectCreate, ProjectListResponse, ProjectUpdate } from "@/types/projectType";


export const projectService = {

    create: (data: ProjectCreate) =>
        api.post<Project>("/projects/", data),

    getAll: (page: number = 1, limit: number = 10) =>
        api.get<ProjectListResponse>(`/projects/?page=${page}&limit=${limit}`),

    getById: (projectId: string) =>
        api.get<Project>(`/projects/${projectId}`),

    update: (projectId: string, data: ProjectUpdate) =>
        api.patch<Project>(`/projects/${projectId}`, data),

    delete: (projectId: string) =>
        api.delete(`/projects/${projectId}`),
};
