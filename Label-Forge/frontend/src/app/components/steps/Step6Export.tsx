import { useEffect, useState } from "react";
import { LFCard } from "../ui/LFCard";
import { LFButton } from "../ui/LFButton";
import { Download } from "lucide-react";
import { S, ResultItem } from "../../state";

export function Step6Export() {
  const [previewResults, setPreviewResults] = useState<ResultItem[]>([]);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState("");
  const outputFormat = (S.jobData?.output_format ?? "json").toLowerCase() as "json" | "csv" | "jsonl";
  const downloadLabel = outputFormat === "jsonl" ? "Download JSONL" : `Download ${outputFormat.toUpperCase()}`;

  const API_BASE = "http://localhost:8001";

  useEffect(() => {
    const fetchPreview = async () => {
      setPreviewError("");
      if (!S.jobId) {
        setPreviewError("No job found. Please create a job first.");
        return;
      }

      setIsPreviewLoading(true);
      try {
        const response = await fetch(`${API_BASE}/jobs/${S.jobId}/results?approved=true`);
        if (!response.ok) {
          const message = await response.text();
          throw new Error(message || "Failed to load preview.");
        }
        const data = await response.json();
        const results: ResultItem[] = data.results || [];
        setPreviewResults(results.slice(0, 5));
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to load preview.";
        setPreviewError(message);
      } finally {
        setIsPreviewLoading(false);
      }
    };

    fetchPreview();
  }, []);

  const handleDownload = async () => {
    setDownloadError("");
    if (!S.jobId) {
      setDownloadError("No job found. Please create a job first.");
      return;
    }

    setIsDownloading(true);
    try {
      const response = await fetch(`${API_BASE}/jobs/${S.jobId}/export`);
      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Failed to download export.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `labelforge_dataset.${S.jobData?.output_format ?? outputFormat}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to download export.";
      setDownloadError(message);
    } finally {
      setIsDownloading(false);
    }
  };

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
              5
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
              4
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
              1
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
              0
            </div>
          </div>
        </LFCard>
      </div>

      <LFCard header="Export Preview">
        <div
          className="p-4 rounded-[6px] max-h-[400px] overflow-auto"
          style={{ backgroundColor: "var(--ink-dark)" }}
        >
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
          {!isPreviewLoading && !previewError && previewResults.length === 0 && (
            <p style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "#93c5fd" }}>
              No approved results yet.
            </p>
          )}
          {!isPreviewLoading && !previewError && previewResults.length > 0 && (
            <div className="space-y-3">
              {previewResults.map((item) => (
                <div key={item._id} className="rounded-[6px] px-3 py-2" style={{ backgroundColor: "#0f172a" }}>
                  {(S.jobData?.fields ?? Object.keys(item.pair)).map((field) => (
                    <div key={`${item._id}-${field}`} style={{ fontSize: "12px", color: "#2DD4BF" }}>
                      <span style={{ fontFamily: "var(--font-mono)", color: "#93c5fd", marginRight: "6px" }}>
                        {field}:
                      </span>
                      <span>{item.pair[field] ?? "—"}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </LFCard>

      <div className="flex flex-col items-end gap-2 pt-4">
        <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
          Export format: {outputFormat.toUpperCase()} (selected in setup)
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
