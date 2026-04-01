import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { LFButton } from "../ui/LFButton";
import { LFCard } from "../ui/LFCard";
import { getIdToken } from "../../lib/auth";
import { S, type JobData, type ResultItem } from "../../state";

interface ResultsStats {
  pending: number;
}

type ExportFormat = "json" | "jsonl" | "csv";

export function Step6Export() {
  const [exportResults, setExportResults] = useState<ResultItem[]>(S.exportResults ?? []);
  const [jobData, setJobData] = useState<JobData | null>(S.jobData);
  const [stats, setStats] = useState<ResultsStats | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState("");

  const API_BASE = "http://localhost:8001";
  const fmt = ((jobData?.output_format || "json").toLowerCase()) as ExportFormat;
  const labels: Record<ExportFormat, string> = {
    json: "Download JSON",
    jsonl: "Download JSONL",
    csv: "Download CSV",
  };
  const downloadLabel = labels[fmt];

  const getAuthHeaders = async () => {
    const token = await getIdToken();
    if (!token) {
      throw new Error("Please sign in to continue.");
    }
    return { Authorization: `Bearer ${token}` };
  };

  useEffect(() => {
    const fetchExportData = async () => {
      setPreviewError("");
      if (!S.jobId) {
        setPreviewError("No job found. Please create a job first.");
        return;
      }

      setIsPreviewLoading(true);
      try {
        const authHeaders = await getAuthHeaders();
        const [resultsResponse, statsResponse, jobResponse] = await Promise.all([
          fetch(`${API_BASE}/jobs/${S.jobId}/results?approved=true`, { headers: authHeaders }),
          fetch(`${API_BASE}/jobs/${S.jobId}/results/stats`, { headers: authHeaders }),
          fetch(`${API_BASE}/jobs/${S.jobId}`, { headers: authHeaders }),
        ]);

        if (!resultsResponse.ok) {
          const message = await resultsResponse.text();
          throw new Error(message || "Failed to load export results.");
        }
        if (!statsResponse.ok) {
          const message = await statsResponse.text();
          throw new Error(message || "Failed to load export stats.");
        }
        if (!jobResponse.ok) {
          const message = await jobResponse.text();
          throw new Error(message || "Failed to load job details.");
        }

        const resultsData = await resultsResponse.json();
        const statsData = await statsResponse.json();
        const nextJobData = await jobResponse.json();
        const nextResults: ResultItem[] = resultsData.results || [];

        S.exportResults = nextResults;
        setExportResults(nextResults);
        setStats(statsData as ResultsStats);
        S.jobData = nextJobData;
        setJobData(nextJobData as JobData);
        console.log("output_format:", nextJobData.output_format);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to load export data.";
        setPreviewError(message);
      } finally {
        setIsPreviewLoading(false);
      }
    };

    fetchExportData();
  }, []);

  const handleDownload = async () => {
    setDownloadError("");
    if (!S.jobId) {
      setDownloadError("No job found. Please create a job first.");
      return;
    }

    setIsDownloading(true);
    try {
      const authHeaders = await getAuthHeaders();
      const response = await fetch(`${API_BASE}/jobs/${S.jobId}/export`, {
        headers: authHeaders,
      });
      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Failed to download export.");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `labelforge_dataset.${fmt}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to download export.";
      setDownloadError(message);
    } finally {
      setIsDownloading(false);
    }
  };

  const totalLabeled = exportResults.length;
  const autoSaved = exportResults.filter((result) => result.source === "model" && result.approved).length;
  const humanReviewed = exportResults.filter((result) => result.human_reviewed === true).length;
  const fields = jobData?.fields ?? [];

  const renderJsonPreview = () => (
    <div className="divide-y" style={{ borderColor: "rgba(148, 163, 184, 0.2)" }}>
      {exportResults.map((item) => (
        <pre
          key={item._id}
          className="py-4 whitespace-pre-wrap break-words"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "12px",
            color: "#E2E8F0",
            margin: 0,
          }}
        >
          {JSON.stringify(item.pair, null, 2)}
        </pre>
      ))}
    </div>
  );

  const renderCsvPreview = () => (
    <div className="overflow-x-auto rounded-[6px]" style={{ border: "1px solid rgba(148, 163, 184, 0.2)" }}>
      <table className="w-full border-collapse" style={{ fontSize: "12px", color: "#E2E8F0" }}>
        <thead>
          <tr style={{ backgroundColor: "#0f172a" }}>
            {fields.map((field) => (
              <th
                key={field}
                className="px-3 py-2 text-left"
                style={{
                  fontFamily: "var(--font-mono)",
                  color: "#93c5fd",
                  borderBottom: "1px solid rgba(148, 163, 184, 0.2)",
                }}
              >
                {field}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {exportResults.map((item, index) => (
            <tr
              key={item._id}
              style={{ backgroundColor: index % 2 === 0 ? "#111827" : "#0b1220" }}
            >
              {fields.map((field) => (
                <td
                  key={`${item._id}-${field}`}
                  className="px-3 py-2 align-top"
                  style={{ borderBottom: "1px solid rgba(148, 163, 184, 0.12)" }}
                >
                  {item.pair[field] ?? ""}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-4">
        <LFCard>
          <div className="text-center">
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
                color: "var(--text-muted)",
                marginBottom: "8px",
              }}
            >
              TOTAL LABELED
            </div>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "32px",
                fontWeight: 600,
              }}
            >
              {totalLabeled}
            </div>
          </div>
        </LFCard>
        <LFCard>
          <div className="text-center">
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
                color: "var(--text-muted)",
                marginBottom: "8px",
              }}
            >
              AUTO-SAVED
            </div>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "32px",
                fontWeight: 600,
                color: "var(--success-green)",
              }}
            >
              {autoSaved}
            </div>
          </div>
        </LFCard>
        <LFCard>
          <div className="text-center">
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
                color: "var(--text-muted)",
                marginBottom: "8px",
              }}
            >
              HUMAN-REVIEWED
            </div>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "32px",
                fontWeight: 600,
                color: "var(--primary-blue)",
              }}
            >
              {humanReviewed}
            </div>
          </div>
        </LFCard>
        <LFCard>
          <div className="text-center">
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
                color: "var(--text-muted)",
                marginBottom: "8px",
              }}
            >
              PENDING
            </div>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "32px",
                fontWeight: 600,
                color: "var(--text-muted)",
              }}
            >
              {stats?.pending ?? 0}
            </div>
          </div>
        </LFCard>
      </div>

      <LFCard header="Export Preview">
        <div className="p-4 rounded-[6px]" style={{ backgroundColor: "var(--ink-dark)" }}>
          {isPreviewLoading && (
            <p style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "#93c5fd" }}>
              Loading preview...
            </p>
          )}
          {previewError && (
            <p style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "#fca5a5" }}>
              {previewError}
            </p>
          )}
          {!isPreviewLoading && !previewError && exportResults.length === 0 && (
            <p style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "#93c5fd" }}>
              No approved results yet.
            </p>
          )}
          {!isPreviewLoading && !previewError && exportResults.length > 0 && (
            <div className="space-y-3">
              <div style={{ fontSize: "12px", color: "#93c5fd", fontFamily: "var(--font-mono)" }}>
                Showing all {exportResults.length} pairs
              </div>
              <div className="max-h-[500px] overflow-y-auto rounded-[6px] px-3 py-2" style={{ backgroundColor: "#0f172a" }}>
                {fmt === "csv" ? renderCsvPreview() : renderJsonPreview()}
              </div>
            </div>
          )}
        </div>
      </LFCard>

      <div className="flex flex-col items-end gap-2 pt-4">
        <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
          Export format: {fmt.toUpperCase()} (selected in setup)
        </span>
        <LFButton onClick={handleDownload} className="flex items-center gap-2" disabled={isDownloading}>
          <Download className="w-4 h-4" />
          {isDownloading ? "Downloading..." : downloadLabel}
        </LFButton>
        {downloadError && (
          <span style={{ fontSize: "12px", color: "var(--error-red)" }}>
            {downloadError}
          </span>
        )}
      </div>
    </div>
  );
}
