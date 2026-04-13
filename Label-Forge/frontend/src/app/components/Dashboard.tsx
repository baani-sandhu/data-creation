import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { LFCard } from "./ui/LFCard";
import { LFButton } from "./ui/LFButton";
import { LFBadge } from "./ui/LFBadge";
import { FileText, Trash2, Download, Plus, Loader2 } from "lucide-react";
import { getIdToken, signOut } from "../lib/auth";
import { API_BASE_URL } from "../lib/api";
import { S, resetAppState } from "../state";
import { useAuth } from "../lib/AuthContext";

interface Job {
  _id: string;
  status: string;
  created_at: string;
  chunk_count: number;
  pair_count: number;
  pending_count: number;
  example_count: number;
  primary_filename: string;
  fields: string[];
  files: Array<{ filename: string }>;
}

interface Dataset {
  _id: string;
  filename: string;
  output_format: string;
  pair_count: number;
  fields: string[];
  saved_at: string;
}

interface SavedDocument {
  _id: string;
  original_filename: string;
  file_type: string;
  chunk_count: number;
  created_at: string;
}

interface Stats {
  total_jobs: number;
  total_pairs: number;
  in_review: number;
  completed: number;
}

type DatasetPreviewRow = Record<string, string>;

const statusConfig = {
  chunked: { label: "Chunked", color: "gray" as const },
  labeling: { label: "Labeling", color: "blue" as const },
  generating: { label: "Generating", color: "amber" as const },
  review: { label: "Review", color: "orange" as const },
  done: { label: "Done", color: "green" as const },
  failed: { label: "Failed", color: "red" as const },
  pending: { label: "Pending", color: "gray" as const },
};

const STATUS_TO_STEP = {
  chunked: "/wizard/extract",
  labeling: "/wizard/sample",
  generating: "/wizard/generate",
  review: "/wizard/review",
  done: "/wizard/export",
  failed: "/wizard",
};

function formatDate(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return `${Math.floor(diffDays / 30)} months ago`;
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === "\"") {
      if (inQuotes && line[i + 1] === "\"") {
        current += "\"";
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }
    current += char;
  }

  values.push(current);
  return values.map((value) => value.trim());
}

export function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [savedDocuments, setSavedDocuments] = useState<SavedDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [datasetsError, setDatasetsError] = useState("");
  const [documentsError, setDocumentsError] = useState("");
  const [previewDataset, setPreviewDataset] = useState<Dataset | null>(null);
  const [previewRows, setPreviewRows] = useState<DatasetPreviewRow[]>([]);
  const [previewColumns, setPreviewColumns] = useState<string[]>([]);
  const [previewError, setPreviewError] = useState("");
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  const fetchJobs = async () => {
    const token = await getIdToken();
    if (!token) {
      await signOut();
      navigate("/");
      return;
    }

    const response = await fetch(`${API_BASE_URL}/jobs/`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (response.status === 401) {
      await signOut();
      navigate("/");
      return;
    }
    if (!response.ok) throw new Error("Failed to fetch jobs");

    const data = await response.json();
    setJobs(data.jobs || []);
    setStats(data.stats || null);
  };

  const fetchDatasets = async () => {
    try {
      setDatasetsError("");
      const token = await getIdToken();
      if (!token) {
        await signOut();
        navigate("/");
        return;
      }
      const response = await fetch(`${API_BASE_URL}/datasets`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.status === 401) {
        await signOut();
        navigate("/");
        return;
      }
      if (!response.ok) throw new Error("Failed to fetch datasets");
      const data = await response.json();
      setDatasets(data.datasets || []);
    } catch {
      setDatasetsError("Could not load datasets right now.");
      setDatasets([]);
    }
  };

  const fetchDocuments = async () => {
    try {
      setDocumentsError("");
      const token = await getIdToken();
      if (!token) {
        await signOut();
        navigate("/");
        return;
      }

      const response = await fetch(`${API_BASE_URL}/documents/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.status === 401) {
        await signOut();
        navigate("/");
        return;
      }
      if (!response.ok) throw new Error("Failed to fetch documents");

      const data = await response.json();
      setSavedDocuments(data.documents || []);
    } catch {
      setDocumentsError("Could not load documents right now.");
      setSavedDocuments([]);
    }
  };

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError("");
        await Promise.all([fetchJobs(), fetchDatasets(), fetchDocuments()]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load jobs");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const handleNewJob = () => {
    resetAppState();
    navigate("/wizard");
  };

  const handleResume = async (job: Job) => {
    try {
      const token = await getIdToken();
      if (!token) throw new Error("Not authenticated");

      const response = await fetch(`${API_BASE_URL}/jobs/${job._id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Failed to fetch job details");

      const fullJob = await response.json();
      S.jobId = job._id;
      S.jobData = {
        job_id: fullJob._id,
        status: fullJob.status,
        fields: fullJob.fields,
        task_prompt: fullJob.task_prompt,
        confidence_threshold: fullJob.confidence_threshold,
        output_format: fullJob.output_format,
        total_chunks: fullJob.chunk_count,
      };
      navigate(STATUS_TO_STEP[job.status as keyof typeof STATUS_TO_STEP] || "/wizard");
    } catch {
      alert("Failed to load job details");
    }
  };

  const handleDelete = async (jobId: string) => {
    if (!confirm("Are you sure you want to delete this job? This action cannot be undone.")) return;

    try {
      const token = await getIdToken();
      if (!token) throw new Error("Not authenticated");

      const response = await fetch(`${API_BASE_URL}/jobs/${jobId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Failed to delete job");

      setJobs(jobs.filter((job) => job._id !== jobId));
      setStats((prev) => prev ? { ...prev, total_jobs: prev.total_jobs - 1 } : null);
    } catch {
      alert("Failed to delete job");
    }
  };

  const handleDownload = async (jobId: string) => {
    try {
      const token = await getIdToken();
      if (!token) throw new Error("Not authenticated");

      const response = await fetch(`${API_BASE_URL}/jobs/${jobId}/export`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Failed to download export");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch {
      alert("Failed to download export");
    }
  };

  const handleDatasetDownload = async (datasetId: string) => {
    try {
      const token = await getIdToken();
      if (!token) throw new Error("Not authenticated");

      const response = await fetch(`${API_BASE_URL}/datasets/${datasetId}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Failed to download dataset");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch {
      alert("Failed to download dataset");
    }
  };

  const handleDatasetDelete = async (datasetId: string) => {
    if (!confirm("Delete this dataset from gallery?")) return;

    try {
      const token = await getIdToken();
      if (!token) throw new Error("Not authenticated");

      const response = await fetch(`${API_BASE_URL}/datasets/${datasetId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Failed to delete dataset");

      setDatasets(datasets.filter((dataset) => dataset._id !== datasetId));
    } catch {
      alert("Failed to delete dataset");
    }
  };

  const handleDocumentDelete = async (documentId: string) => {
    if (!confirm("Delete this document? This will not affect jobs already created from it.")) return;

    try {
      const token = await getIdToken();
      if (!token) throw new Error("Not authenticated");

      const response = await fetch(`${API_BASE_URL}/documents/${documentId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Failed to delete document");

      setSavedDocuments(savedDocuments.filter((document) => document._id !== documentId));
    } catch {
      alert("Failed to delete document");
    }
  };

  const handleDatasetView = async (dataset: Dataset) => {
    try {
      setPreviewDataset(dataset);
      setPreviewRows([]);
      setPreviewColumns([]);
      setPreviewError("");
      setIsPreviewLoading(true);

      const token = await getIdToken();
      if (!token) throw new Error("Not authenticated");

      const response = await fetch(`${API_BASE_URL}/datasets/${dataset._id}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Failed to load dataset preview");

      const format = dataset.output_format.toLowerCase();
      const text = await response.text();
      let rows: DatasetPreviewRow[] = [];

      if (format === "jsonl") {
        rows = text
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line) => {
            const parsed = JSON.parse(line);
            const source = typeof parsed?.pair === "object" && parsed?.pair !== null ? parsed.pair : parsed;
            const obj = source && typeof source === "object" ? source : {};
            return Object.fromEntries(
              Object.entries(obj).map(([key, value]) => [key, value == null ? "" : String(value)])
            );
          });
      } else if (format === "json") {
        const parsed = JSON.parse(text);
        if (!Array.isArray(parsed)) {
          throw new Error("JSON dataset is not an array.");
        }
        rows = parsed.map((item) => {
          const source = typeof item?.pair === "object" && item?.pair !== null ? item.pair : item;
          const obj = source && typeof source === "object" ? source : {};
          return Object.fromEntries(
            Object.entries(obj).map(([key, value]) => [key, value == null ? "" : String(value)])
          );
        });
      } else if (format === "csv") {
        const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
        if (lines.length === 0) {
          rows = [];
        } else {
          const headers = parseCsvLine(lines[0]);
          rows = lines.slice(1).map((line) => {
            const values = parseCsvLine(line);
            const row: DatasetPreviewRow = {};
            headers.forEach((header, index) => {
              row[header] = values[index] ?? "";
            });
            return row;
          });
          setPreviewColumns(headers);
        }
      } else {
        throw new Error(`Unsupported format: ${dataset.output_format}`);
      }

      if (format !== "csv") {
        const dynamicColumns = rows.length > 0 ? Array.from(new Set(rows.flatMap((row) => Object.keys(row)))) : [];
        setPreviewColumns(dataset.fields?.length ? dataset.fields : dynamicColumns);
      }
      setPreviewRows(rows);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to preview dataset.";
      setPreviewError(message);
      setPreviewRows([]);
      setPreviewColumns([]);
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const closePreview = () => {
    setPreviewDataset(null);
    setPreviewRows([]);
    setPreviewColumns([]);
    setPreviewError("");
    setIsPreviewLoading(false);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "var(--base-bg)" }}>
        <div className="flex items-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--primary-blue)" }} />
          <span style={{ fontSize: "14px", color: "var(--text-muted)" }}>Loading jobs...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "var(--base-bg)" }}>
        <div className="text-center">
          <p style={{ color: "var(--text-muted)", marginBottom: "16px" }}>{error}</p>
          <LFButton onClick={fetchJobs}>Retry</LFButton>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--base-bg)", fontFamily: "var(--font-sans)" }}>
      <div className="max-w-[1200px] mx-auto px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <span style={{ fontSize: "14px", color: "var(--ink-dark)", fontWeight: 500 }}>
            {user?.email || ""}
          </span>
          <LFButton variant="ghost" onClick={handleSignOut}>
            Sign Out
          </LFButton>
        </div>

        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <LFCard className="text-center">
              <div style={{ fontSize: "32px", fontWeight: 700, color: "var(--primary-blue)", marginBottom: "8px" }}>
                {stats.total_jobs}
              </div>
              <div style={{ fontSize: "14px", color: "var(--text-muted)" }}>Total Jobs</div>
            </LFCard>
            <LFCard className="text-center">
              <div style={{ fontSize: "32px", fontWeight: 700, color: "var(--primary-blue)", marginBottom: "8px" }}>
                {stats.total_pairs}
              </div>
              <div style={{ fontSize: "14px", color: "var(--text-muted)" }}>Total Pairs Generated</div>
            </LFCard>
            <LFCard className="text-center">
              <div style={{ fontSize: "32px", fontWeight: 700, color: "var(--primary-blue)", marginBottom: "8px" }}>
                {stats.in_review}
              </div>
              <div style={{ fontSize: "14px", color: "var(--text-muted)" }}>In Review</div>
            </LFCard>
            <LFCard className="text-center">
              <div style={{ fontSize: "32px", fontWeight: 700, color: "var(--primary-blue)", marginBottom: "8px" }}>
                {stats.completed}
              </div>
              <div style={{ fontSize: "14px", color: "var(--text-muted)" }}>Completed</div>
            </LFCard>
          </div>
        )}

        <div className="flex items-center justify-between mb-6">
          <h1 style={{ fontSize: "24px", fontWeight: 600, color: "var(--ink-dark)" }}>My Jobs</h1>
          <LFButton onClick={handleNewJob}>
            <Plus className="w-4 h-4 mr-2" />
            New Job
          </LFButton>
        </div>

        {jobs.length === 0 ? (
          <div className="text-center py-16">
            <FileText className="w-16 h-16 mx-auto mb-4" style={{ color: "var(--text-muted)" }} />
            <h2 style={{ fontSize: "18px", fontWeight: 600, color: "var(--ink-dark)", marginBottom: "8px" }}>
              No jobs yet
            </h2>
            <p style={{ color: "var(--text-muted)", marginBottom: "16px" }}>
              Upload your first document to get started.
            </p>
            <LFButton onClick={handleNewJob}>
              <Plus className="w-4 h-4 mr-2" />
              New Job
            </LFButton>
          </div>
        ) : (
          <div className="space-y-4">
            {jobs.map((job) => {
              const statusInfo = statusConfig[job.status as keyof typeof statusConfig] || statusConfig.failed;
              const files = job.files.map((f) => f.filename);
              const primaryFile = files[0] || job.primary_filename || "Unknown";
              const extraFiles = files.length - 1;

              return (
                <LFCard key={job._id} className="hover:shadow-lg transition-shadow">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1">
                      <FileText className="w-8 h-8 flex-shrink-0" style={{ color: "var(--text-muted)" }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span style={{ fontWeight: 600, color: "var(--ink-dark)" }}>
                            {primaryFile}
                          </span>
                          {extraFiles > 0 && (
                            <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                              + {extraFiles} more
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-sm">
                          <LFBadge color={statusInfo.color}>{statusInfo.label}</LFBadge>
                          <span style={{ color: "var(--text-muted)" }}>{formatDate(job.created_at)}</span>
                          <span style={{ color: "var(--text-muted)" }}>{job.pair_count} pairs</span>
                          <span style={{ color: "var(--text-muted)" }}>{job.example_count} examples</span>
                          <div className="flex gap-1">
                            {job.fields.slice(0, 3).map((field) => (
                              <LFBadge key={field} color="blue" className="text-xs">
                                {field}
                              </LFBadge>
                            ))}
                            {job.fields.length > 3 && (
                              <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                                +{job.fields.length - 3}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {job.status === "done" && (
                        <LFButton variant="ghost" className="px-3 py-1.5" onClick={() => handleDownload(job._id)}>
                          <Download className="w-4 h-4" />
                        </LFButton>
                      )}
                      <LFButton variant="ghost" className="px-3 py-1.5" onClick={() => handleDelete(job._id)}>
                        <Trash2 className="w-4 h-4" />
                      </LFButton>
                      <LFButton
                        variant="secondary"
                        className="px-3 py-1.5 text-sm"
                        onClick={() => handleResume(job)}
                      >
                        {job.status === "done" ? "View Export ->" :
                         job.status === "failed" ? "Retry ->" : "Resume ->"}
                      </LFButton>
                    </div>
                  </div>
                </LFCard>
              );
            })}
          </div>
        )}

        <div className="mt-10 mb-4">
          <h2 style={{ fontSize: "20px", fontWeight: 600, color: "var(--ink-dark)" }}>My Documents</h2>
          {documentsError && (
            <p style={{ color: "var(--text-muted)", fontSize: "12px", marginTop: "6px" }}>
              {documentsError}
            </p>
          )}
        </div>

        {savedDocuments.length === 0 ? (
          <p style={{ color: "var(--text-muted)", fontSize: "14px" }}>
            No documents saved yet. Upload a document to get started.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {savedDocuments.map((document) => (
              <LFCard key={document._id}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex gap-3 min-w-0">
                    <FileText className="w-6 h-6 mt-1 flex-shrink-0" style={{ color: "var(--text-muted)" }} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className="truncate"
                          style={{ fontWeight: 600, color: "var(--ink-dark)", maxWidth: "320px" }}
                          title={document.original_filename}
                        >
                          {document.original_filename}
                        </span>
                        <LFBadge color="blue">{document.file_type.toUpperCase()}</LFBadge>
                      </div>
                      <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>
                        {document.chunk_count} chunks
                      </p>
                      <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                        Uploaded {formatDate(document.created_at)}
                      </p>
                    </div>
                  </div>
                  <LFButton variant="ghost" onClick={() => handleDocumentDelete(document._id)}>
                    Delete
                  </LFButton>
                </div>
              </LFCard>
            ))}
          </div>
        )}

        <div className="mt-10 mb-4">
          <h2 style={{ fontSize: "20px", fontWeight: 600, color: "var(--ink-dark)" }}>My Datasets</h2>
          {datasetsError && (
            <p style={{ color: "var(--text-muted)", fontSize: "12px", marginTop: "6px" }}>
              {datasetsError}
            </p>
          )}
        </div>

        {datasets.length === 0 ? (
          <p style={{ color: "var(--text-muted)", fontSize: "14px" }}>
            No datasets saved yet. Complete a job and click Save to Gallery in the export screen.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {datasets.map((dataset) => (
              <LFCard key={dataset._id}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex gap-3">
                    <FileText className="w-6 h-6 mt-1" style={{ color: "var(--text-muted)" }} />
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span style={{ fontWeight: 600, color: "var(--ink-dark)" }}>{dataset.filename || "Dataset"}</span>
                        <LFBadge color="blue">{dataset.output_format.toUpperCase()}</LFBadge>
                      </div>
                      <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>
                        {dataset.pair_count} pairs
                      </p>
                      <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                        Saved {formatDate(dataset.saved_at)}
                      </p>
                      <div className="flex gap-1 mt-2">
                        {dataset.fields?.map((field) => (
                          <LFBadge key={`${dataset._id}-${field}`} color="blue" className="text-xs">
                            {field}
                          </LFBadge>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <LFButton variant="ghost" onClick={() => handleDatasetView(dataset)}>
                      View
                    </LFButton>
                    <LFButton variant="ghost" onClick={() => handleDatasetDownload(dataset._id)}>
                      Download
                    </LFButton>
                    <LFButton variant="ghost" onClick={() => handleDatasetDelete(dataset._id)}>
                      Delete
                    </LFButton>
                  </div>
                </div>
              </LFCard>
            ))}
          </div>
        )}
      </div>
      {previewDataset && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(15, 23, 42, 0.45)" }}
        >
          <div
            className="w-full max-w-[1100px] rounded-[12px] border bg-white shadow-xl"
            style={{ borderColor: "var(--border-color)" }}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--border-color)" }}>
              <h3 style={{ fontSize: "18px", fontWeight: 600, color: "var(--ink-dark)" }}>
                {previewDataset.filename || "Dataset"}
              </h3>
              <LFButton variant="ghost" onClick={closePreview}>
                Close
              </LFButton>
            </div>

            <div className="p-5">
              {isPreviewLoading && (
                <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>Loading preview...</p>
              )}
              {!isPreviewLoading && previewError && (
                <p style={{ fontSize: "13px", color: "var(--error-red)" }}>{previewError}</p>
              )}
              {!isPreviewLoading && !previewError && (
                <div
                  className="rounded-[10px] border overflow-auto"
                  style={{ borderColor: "var(--border-color)", maxHeight: "70vh" }}
                >
                  {previewColumns.length === 0 || previewRows.length === 0 ? (
                    <div className="p-4" style={{ fontSize: "13px", color: "var(--text-muted)" }}>
                      No rows to preview.
                    </div>
                  ) : (
                    <table className="w-full border-collapse">
                      <thead>
                        <tr style={{ backgroundColor: "var(--card-header)" }}>
                          {previewColumns.map((column) => (
                            <th
                              key={column}
                              className="px-3 py-2 text-left"
                              style={{
                                fontFamily: "var(--font-mono)",
                                fontSize: "12px",
                                color: "var(--ink-dark)",
                                borderBottom: "1px solid var(--border-color)",
                              }}
                            >
                              {column}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {previewRows.map((row, rowIndex) => (
                          <tr key={`${previewDataset._id}-row-${rowIndex}`}>
                            {previewColumns.map((column) => (
                              <td
                                key={`${previewDataset._id}-cell-${rowIndex}-${column}`}
                                className="px-3 py-2 align-top"
                                style={{
                                  fontSize: "12px",
                                  color: "var(--ink-dark)",
                                  borderBottom: "1px solid var(--border-color)",
                                }}
                              >
                                {row[column] ?? ""}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
