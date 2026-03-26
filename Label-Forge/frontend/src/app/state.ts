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

export type GenerationResult = {
  job_id: string;
  status: string;
  total_pairs: number;
  high_confidence: number;
  low_confidence: number;
  chunks_processed: number;
  errors?: Array<{
    chunk_id: string;
    chunk_index: number;
    error: string;
  }> | null;
};

export type ResultItem = {
  _id: string;
  job_id: string;
  chunk_id: string;
  chunk_index: number;
  source_filename: string;
  pair: Record<string, string>;
  confidence: number;
  reasoning?: string;
  source: "human" | "model";
  human_reviewed: boolean;
  approved: boolean;
  created_at?: string;
};

export const S: {
  jobId: string | null;
  jobData: JobData | null;
  chunks: ChunkData[];
  currentChunkIndex: number;
  userExamples: ExampleCreate[];
  uploadedFiles: File[];
  generationResult: GenerationResult | null;
  results: ResultItem[];
  approvedResults: ResultItem[];
  pendingResults: ResultItem[];
  feedbackCount: number;
} = {
  jobId: null,
  jobData: null,
  chunks: [],
  currentChunkIndex: 0,
  userExamples: [],
  uploadedFiles: [],
  generationResult: null,
  results: [],
  approvedResults: [],
  pendingResults: [],
  feedbackCount: 0,
};
