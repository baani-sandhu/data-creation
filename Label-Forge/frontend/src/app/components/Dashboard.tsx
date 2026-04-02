import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { LFCard } from "./ui/LFCard";
import { LFButton } from "./ui/LFButton";
import { LFBadge } from "./ui/LFBadge";
import { FileText, Trash2, Download, Plus, Loader2 } from "lucide-react";
import { getIdToken } from "../lib/auth";
import { S, resetAppState } from "../state";

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

interface Stats {
  total_jobs: number;
  total_pairs: number;
  in_review: number;
  completed: number;
}

const API_BASE = "http://localhost:8001";

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

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return `${Math.floor(diffDays / 30)} months ago`;
}

export function Dashboard() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchJobs = async () => {
    try {
      setLoading(true);
      setError("");
      const token = await getIdToken();
      if (!token) throw new Error("Not authenticated");

      const response = await fetch(`${API_BASE}/jobs/`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error("Failed to fetch jobs");

      const data = await response.json();
      setJobs(data.jobs);
      setStats(data.stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load jobs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  const handleNewJob = () => {
    resetAppState();
    navigate("/wizard");
  };

  const handleResume = async (job: Job) => {
    try {
      const token = await getIdToken();
      if (!token) throw new Error("Not authenticated");

      // Fetch full job data
      const response = await fetch(`${API_BASE}/jobs/${job._id}`, {
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
    } catch (err) {
      alert("Failed to load job details");
    }
  };

  const handleDelete = async (jobId: string) => {
    if (!confirm("Are you sure you want to delete this job? This action cannot be undone.")) return;

    try {
      const token = await getIdToken();
      if (!token) throw new Error("Not authenticated");

      const response = await fetch(`${API_BASE}/jobs/${jobId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error("Failed to delete job");

      setJobs(jobs.filter(job => job._id !== jobId));
      setStats(prev => prev ? { ...prev, total_jobs: prev.total_jobs - 1 } : null);
    } catch (err) {
      alert("Failed to delete job");
    }
  };

  const handleDownload = async (jobId: string) => {
    try {
      const token = await getIdToken();
      if (!token) throw new Error("Not authenticated");

      const response = await fetch(`${API_BASE}/jobs/${jobId}/export`, {
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
    } catch (err) {
      alert("Failed to download export");
    }
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
        {/* Stats Cards */}
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

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 style={{ fontSize: "24px", fontWeight: 600, color: "var(--ink-dark)" }}>My Datasets</h1>
          <LFButton onClick={handleNewJob}>
            <Plus className="w-4 h-4 mr-2" />
            New Job
          </LFButton>
        </div>

        {/* Jobs List */}
        {jobs.length === 0 ? (
          <div className="text-center py-16">
            <FileText className="w-16 h-16 mx-auto mb-4" style={{ color: "var(--text-muted)" }} />
            <h2 style={{ fontSize: "18px", fontWeight: 600, color: "var(--ink-dark)", marginBottom: "8px" }}>
              No datasets yet
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
              const files = job.files.map(f => f.filename);
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
                        {job.status === "done" ? "View Export →" :
                         job.status === "failed" ? "Retry →" : "Resume →"}
                      </LFButton>
                    </div>
                  </div>
                </LFCard>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
