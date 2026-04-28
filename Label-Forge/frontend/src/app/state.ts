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
  is_augmented?: boolean;
  augmentation_source?: "generation" | "paraphrase" | string;
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
  exportResults: ResultItem[];
  approvedResults: ResultItem[];
  pendingResults: ResultItem[];
  feedbackCount: number;
  selectedDocumentId: string | null;
} = {
  jobId: null,
  jobData: null,
  chunks: [],
  currentChunkIndex: 0,
  userExamples: [],
  uploadedFiles: [],
  generationResult: null,
  results: [],
  exportResults: [],
  approvedResults: [],
  pendingResults: [],
  feedbackCount: 0,
  selectedDocumentId: null,
};

export function resetAppState() {
  S.jobId = null;
  S.jobData = null;
  S.chunks = [];
  S.currentChunkIndex = 0;
  S.userExamples = [];
  S.uploadedFiles = [];
  S.generationResult = null;
  S.results = [];
  S.exportResults = [];
  S.approvedResults = [];
  S.pendingResults = [];
  S.feedbackCount = 0;
  S.selectedDocumentId = null;
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // sessionStorage unavailable, ignore
  }
}

const SESSION_KEY = "labelforge_session";

export function persistState() {
  try {
    const toSave = {
      jobId: S.jobId,
      jobData: S.jobData,
      chunks: S.chunks,
      currentChunkIndex: S.currentChunkIndex,
      userExamples: S.userExamples,
      generationResult: S.generationResult,
      selectedDocumentId: S.selectedDocumentId,
    };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(toSave));
  } catch {
    // sessionStorage unavailable, ignore
  }
}

export function restoreState() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (saved.jobId) S.jobId = saved.jobId;
    if (saved.jobData) S.jobData = saved.jobData;
    if (saved.chunks) S.chunks = saved.chunks;
    if (saved.currentChunkIndex !== undefined) S.currentChunkIndex = saved.currentChunkIndex;
    if (saved.userExamples) S.userExamples = saved.userExamples;
    if (saved.generationResult) S.generationResult = saved.generationResult;
    if (saved.selectedDocumentId) S.selectedDocumentId = saved.selectedDocumentId;
  } catch {
    // corrupt data, ignore
  }
}
