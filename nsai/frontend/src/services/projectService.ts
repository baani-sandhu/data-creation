import api from "./axios";
import type { ProjectResponse, ProjectCreate, ProjectListResponse, ProjectUpdate } from "@/types/projectType";

const getAuthHeaders = () => {
    const access_token = localStorage.getItem('access_token');
    return {
      headers: {
        Authorization: `Bearer ${access_token}`,
        'Content-Type': 'application/json',
      },
    };
  };

export const projectService = {

    create: (data: ProjectCreate) =>
        api.post<ProjectResponse>("/projects/", data , getAuthHeaders()),

    getAll: (page: number = 1, limit: number = 10) =>
        api.get<ProjectListResponse>(`/projects/?page=${page}&limit=${limit}`, getAuthHeaders()),

    getById: (projectId: string) =>
        api.get<ProjectResponse>(`/projects/${projectId}`, getAuthHeaders()),

    update: (projectId: string, data: ProjectUpdate) =>
        api.patch<ProjectResponse>(`/projects/${projectId}`, data, getAuthHeaders()),

    delete: (projectId: string) =>
        api.delete(`/projects/${projectId}`, getAuthHeaders()),
};
