export type JobData = {
  job_id: string;
  status: string;
  fields: string[];
  task_prompt: string;
  confidence_threshold: number;
  output_format: string;
  total_chunks?: number;
};

export type ChunkData = {
  _id: string;
  job_id: string;
  chunk_index: number;
  chunk_index_in_file: number;
  is_first_chunk: boolean;
  source_filename: string;
  text: string;
  word_count: number;
};

export type ExampleCreate = {
  chunk_id: string;
  chunk_index: number;
  source_filename: string;
  pairs: Array<{ field: string; text: string }>;
};

export const S: {
  jobId: string | null;
  jobData: JobData | null;
  chunks: ChunkData[];
  currentChunkIndex: number;
  userExamples: ExampleCreate[];
  uploadedFiles: File[];
} = {
  jobId: null,
  jobData: null,
  chunks: [],
  currentChunkIndex: 0,
  userExamples: [],
  uploadedFiles: [],
};
