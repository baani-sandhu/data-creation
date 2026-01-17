export interface ProjectCardData {
  _id: string;
  name: string;
  base_model: string;
  dataset_url?: string;
  metrics?: Record<string, number | string>;
  created_at: string;
}

export interface ProjectResponse {
  _id: string;
  user_id: string;
  name: string;
  base_model: string;
  dataset_url: string;
  metrics?: Record<string, number | string>;
  configuration: Record<string, any>;
  training_job_ids: string[];
  created_at: string; // ISO string from backend datetime
  updated_at: string;
}

export interface ProjectCreate {
  name: string;
  base_model?: string;
  dataset_link?: string;
  configuration?: Record<string, any>;
}

export interface ProjectUpdate {
  name?: string;
  base_model?: string;
  dataset_link?: string;
  configuration?: Record<string, any>;
}

export interface ProjectListResponse {
  projects: ProjectResponse[];
  total: number;
  page: number;
  limit: number;
}
