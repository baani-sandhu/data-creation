import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { LFButton } from "../ui/LFButton";
import { LFCard } from "../ui/LFCard";
import { LFBadge } from "../ui/LFBadge";
import { getIdToken } from "../../lib/auth";
import { API_BASE_URL } from "../../lib/api";
import { S, persistState, type JobData, type ResultItem } from "../../state";

interface ResultsStats {
  pending: number;
}

type ExportFormat = "json" | "jsonl" | "csv";
type AugmentationStatus = "running" | "completed" | "partial" | "failed";
type PreviewTab = "all" | "original" | "augmented";

interface AugmentationRunState {
  augmentation_run_id: string;
  status: AugmentationStatus;
  mode1_generated: number;
  mode2_generated: number;
  mode1_quota: number;
  mode2_quota: number;
  shortfall_message: string | null;
  created_at: string | null;
  completed_at: string | null;
}

export function Step6Export() {
  const [exportResults, setExportResults] = useState<ResultItem[]>(S.exportResults ?? []);
  const [jobData, setJobData] = useState<JobData | null>(S.jobData);
  const [stats, setStats] = useState<ResultsStats | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [saveError, setSaveError] = useState("");
  const [isSavedToGallery, setIsSavedToGallery] = useState(false);
  const [targetSize, setTargetSize] = useState("");
  const [mode2Percent, setMode2Percent] = useState(50);
  const [augmentationError, setAugmentationError] = useState("");
  const [isStartingAugmentation, setIsStartingAugmentation] = useState(false);
  const [augmentationRun, setAugmentationRun] = useState<AugmentationRunState | null>(null);
  const [activePreviewTab, setActivePreviewTab] = useState<PreviewTab>("all");

  const fmt = ((jobData?.output_format || "csv").toLowerCase()) as ExportFormat;
  const labels: Record<ExportFormat, string> = {
    json: "Download JSON",
    jsonl: "Download JSONL",
    csv: "Download CSV",
  };
  const downloadLabel = labels[fmt];
  const approvedCount = exportResults.length;
  const minimumTargetSize = approvedCount + 1;
  const parsedTargetSize = Number(targetSize);
  const targetValidationMessage =
    targetSize.trim().length === 0
      ? ""
      : Number.isNaN(parsedTargetSize) || parsedTargetSize <= approvedCount
        ? `Target size must be greater than current approved pairs (${approvedCount}).`
        : "";
  const canShowAugmentation = approvedCount > 0;
  const isAugmentationRunning = augmentationRun?.status === "running";
  const totalGeneratedSoFar = (augmentationRun?.mode1_generated || 0) + (augmentationRun?.mode2_generated || 0);
  const totalQuota = (augmentationRun?.mode1_quota || 0) + (augmentationRun?.mode2_quota || 0);
  const originalResults = exportResults.filter((result) => !result.is_augmented);
  const augmentedResults = exportResults.filter((result) => result.is_augmented === true);
  const activePreviewResults =
    activePreviewTab === "original"
      ? originalResults
      : activePreviewTab === "augmented"
        ? augmentedResults
        : exportResults;
  const previewHeaderText =
    activePreviewTab === "original"
      ? `Showing ${activePreviewResults.length} original pairs`
      : activePreviewTab === "augmented"
        ? `Showing ${activePreviewResults.length} augmented pairs`
        : `Showing all ${activePreviewResults.length} pairs`;

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
          fetch(`${API_BASE_URL}/jobs/${S.jobId}/results?approved=true`, { headers: authHeaders }),
          fetch(`${API_BASE_URL}/jobs/${S.jobId}/results/stats`, { headers: authHeaders }),
          fetch(`${API_BASE_URL}/jobs/${S.jobId}`, { headers: authHeaders }),
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
        persistState();
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

  useEffect(() => {
    if (!canShowAugmentation) return;
    if (!targetSize) {
      setTargetSize(String(minimumTargetSize));
    }
  }, [canShowAugmentation, minimumTargetSize, targetSize]);

  useEffect(() => {
    if (!augmentationRun?.augmentation_run_id) return;
    if (augmentationRun.status !== "running") return;

    let stopped = false;
    let intervalId: number | null = null;

    const pollStatus = async () => {
      try {
        const authHeaders = await getAuthHeaders();
        const response = await fetch(
          `${API_BASE_URL}/augmentation/${augmentationRun.augmentation_run_id}/status`,
          { headers: authHeaders }
        );
        if (!response.ok) {
          const message = await response.text();
          throw new Error(message || "Failed to fetch augmentation status.");
        }
        const statusData = (await response.json()) as AugmentationRunState;
        if (stopped) return;
        setAugmentationRun(statusData);
      } catch (err) {
        if (stopped) return;
        const message = err instanceof Error ? err.message : "Unable to poll augmentation status.";
        setAugmentationError(message);
      }
    };

    pollStatus();
    intervalId = window.setInterval(pollStatus, 5000);

    return () => {
      stopped = true;
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [augmentationRun?.augmentation_run_id, augmentationRun?.status]);

  const handleStartAugmentation = async () => {
    setAugmentationError("");
    if (!S.jobId) {
      setAugmentationError("No job found. Please create a job first.");
      return;
    }
    if (targetValidationMessage) {
      setAugmentationError(targetValidationMessage);
      return;
    }

    setIsStartingAugmentation(true);
    try {
      const authHeaders = await getAuthHeaders();
      const startResponse = await fetch(`${API_BASE_URL}/augmentation/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({
          job_id: S.jobId,
          target_size: parsedTargetSize,
          mode_split: mode2Percent / 100,
        }),
      });
      if (!startResponse.ok) {
        const message = await startResponse.text();
        throw new Error(message || "Failed to start augmentation.");
      }

      const startData = await startResponse.json();
      const runId = startData?.augmentation_run_id?.toString();
      if (!runId) {
        throw new Error("Augmentation run id not returned.");
      }

      setAugmentationRun({
        augmentation_run_id: runId,
        status: "running",
        mode1_generated: 0,
        mode2_generated: 0,
        mode1_quota: 0,
        mode2_quota: 0,
        shortfall_message: null,
        created_at: null,
        completed_at: null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to start augmentation.";
      setAugmentationError(message);
    } finally {
      setIsStartingAugmentation(false);
    }
  };

  const handleResetAugmentation = () => {
    setAugmentationRun(null);
    setAugmentationError("");
    if (canShowAugmentation) {
      setTargetSize(String(approvedCount + 1));
      setMode2Percent(50);
    }
  };

  const handleDownload = async () => {
    setDownloadError("");
    if (!S.jobId) {
      setDownloadError("No job found. Please create a job first.");
      return;
    }

    setIsDownloading(true);
    try {
      const authHeaders = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/jobs/${S.jobId}/export`, {
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

  const handleSaveToGallery = async () => {
    setSaveMessage("");
    setSaveError("");
    if (!S.jobId) {
      setSaveError("No job found. Please create a job first.");
      return;
    }

    setIsSaving(true);
    try {
      const authHeaders = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/jobs/${S.jobId}/save-to-gallery`, {
        method: "POST",
        headers: authHeaders,
      });
      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Failed to save dataset.");
      }

      const data = await response.json();
      if (data?.already_saved) {
        setSaveMessage("Already saved to gallery");
      } else {
        setSaveMessage("Dataset saved to your gallery. View it on the Dashboard.");
      }
      setIsSavedToGallery(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to save dataset.";
      setSaveError(message);
    } finally {
      setIsSaving(false);
    }
  };

  const totalLabeled = exportResults.length;
  const autoSaved = exportResults.filter((result) => result.source === "model" && result.approved).length;
  const humanReviewed = exportResults.filter((result) => result.human_reviewed === true).length;
  const fields = jobData?.fields ?? [];

  const toDisplayText = (value: unknown) => {
    if (value === null || value === undefined) return "";
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  };

  const renderJsonPreview = (rows: ResultItem[]) => (
    <div className="divide-y" style={{ borderColor: "rgba(148, 163, 184, 0.2)" }}>
      {rows.map((item) => (
        <div key={item._id} className="py-4">
          <pre
            className="whitespace-pre-wrap break-words"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "12px",
              color: "#E2E8F0",
              margin: 0,
            }}
          >
            {JSON.stringify(item.pair, null, 2)}
          </pre>
          {item.is_augmented && (
            <div className="mt-2">
              <LFBadge color="amber">
                {item.augmentation_source === "generation" ? "Generated" : "Paraphrase"}
              </LFBadge>
            </div>
          )}
        </div>
      ))}
    </div>
  );

  const renderCsvPreview = (rows: ResultItem[]) => (
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
          {rows.map((item, index) => (
            [
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
                    {toDisplayText(item.pair[field])}
                  </td>
                ))}
              </tr>,
              item.is_augmented ? (
                <tr key={`${item._id}-augmentation`}>
                  <td
                    colSpan={Math.max(1, fields.length)}
                    className="px-3 py-2"
                    style={{ borderBottom: "1px solid rgba(148, 163, 184, 0.12)", backgroundColor: "#0f172a" }}
                  >
                    <LFBadge color="amber">
                      {item.augmentation_source === "generation" ? "Generated" : "Paraphrase"}
                    </LFBadge>
                  </td>
                </tr>
              ) : null
            ]
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div data-testid="step6-export" className="space-y-4">
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

      <LFCard data-testid="export-preview" header="Export Preview">
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
              <div className="inline-flex rounded-lg border p-1" style={{ borderColor: "rgba(148, 163, 184, 0.3)" }}>
                <button
                  onClick={() => setActivePreviewTab("original")}
                  className="px-3 py-1.5 rounded-md text-xs transition-colors"
                  style={{
                    backgroundColor: activePreviewTab === "original" ? "var(--label-blue)" : "transparent",
                    color: activePreviewTab === "original" ? "var(--ink-dark)" : "#93c5fd",
                    fontWeight: activePreviewTab === "original" ? 600 : 500,
                  }}
                >
                  Original ({originalResults.length})
                </button>
                <button
                  onClick={() => setActivePreviewTab("augmented")}
                  className="px-3 py-1.5 rounded-md text-xs transition-colors"
                  style={{
                    backgroundColor: activePreviewTab === "augmented" ? "var(--label-blue)" : "transparent",
                    color: activePreviewTab === "augmented" ? "var(--ink-dark)" : "#93c5fd",
                    fontWeight: activePreviewTab === "augmented" ? 600 : 500,
                  }}
                >
                  Augmented ({augmentedResults.length})
                </button>
                <button
                  onClick={() => setActivePreviewTab("all")}
                  className="px-3 py-1.5 rounded-md text-xs transition-colors"
                  style={{
                    backgroundColor: activePreviewTab === "all" ? "var(--label-blue)" : "transparent",
                    color: activePreviewTab === "all" ? "var(--ink-dark)" : "#93c5fd",
                    fontWeight: activePreviewTab === "all" ? 600 : 500,
                  }}
                >
                  All ({exportResults.length})
                </button>
              </div>
              <div style={{ fontSize: "12px", color: "#93c5fd", fontFamily: "var(--font-mono)" }}>
                {previewHeaderText}
              </div>
              <div className="max-h-[500px] overflow-y-auto rounded-[6px] px-3 py-2" style={{ backgroundColor: "#0f172a" }}>
                {fmt === "csv" ? renderCsvPreview(activePreviewResults) : renderJsonPreview(activePreviewResults)}
              </div>
            </div>
          )}
        </div>
      </LFCard>

      {canShowAugmentation && (
        <LFCard header="Augment Dataset">
          <div className="space-y-4">
            <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>
              Current approved pairs: {approvedCount}
            </p>

            {!augmentationRun && (
              <>
                <div>
                  <label className="block mb-2" style={{ fontSize: "13px", color: "var(--text-secondary)", fontWeight: 500 }}>
                    Target Size
                  </label>
                  <input
                    type="number"
                    min={minimumTargetSize}
                    value={targetSize}
                    onChange={(event) => setTargetSize(event.target.value)}
                    className="w-full rounded-[6px] border px-3 py-2"
                    style={{ borderColor: "var(--border-color)", fontSize: "13px" }}
                  />
                  {targetValidationMessage && (
                    <p style={{ fontSize: "12px", color: "var(--error-red)", marginTop: "6px" }}>
                      {targetValidationMessage}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block mb-2" style={{ fontSize: "13px", color: "var(--text-secondary)", fontWeight: 500 }}>
                    New generation % / Paraphrase %
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={mode2Percent}
                    onChange={(event) => setMode2Percent(Number(event.target.value))}
                    className="w-full"
                  />
                  <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "6px" }}>
                    Generation: {mode2Percent}% | Paraphrase: {100 - mode2Percent}%
                  </p>
                </div>

                <LFButton
                  onClick={handleStartAugmentation}
                  disabled={isStartingAugmentation || Boolean(targetValidationMessage)}
                >
                  {isStartingAugmentation ? "Starting..." : "Start Augmentation"}
                </LFButton>
              </>
            )}

            {augmentationRun && (
              <div className="space-y-3">
                <div
                  className="p-3 rounded-[6px] border"
                  style={{ borderColor: "var(--border-color)", backgroundColor: "var(--card-header)" }}
                >
                  <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                    Status: {augmentationRun.status}
                  </p>
                  <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                    Mode 2 (Generation): {augmentationRun.mode2_generated} / {augmentationRun.mode2_quota}
                  </p>
                  <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                    Mode 1 (Paraphrase): {augmentationRun.mode1_generated} / {augmentationRun.mode1_quota}
                  </p>
                  <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                    Overall: {totalGeneratedSoFar} of {totalQuota} target pairs generated
                  </p>
                </div>

                {!isAugmentationRunning && (
                  <div className="space-y-2">
                    <p style={{ fontSize: "13px", color: "var(--ink-dark)", fontWeight: 500 }}>
                      Augmentation Summary
                    </p>
                    <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                      Pairs generated by Mode 2: {augmentationRun.mode2_generated}
                    </p>
                    <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                      Pairs generated by Mode 1: {augmentationRun.mode1_generated}
                    </p>
                    <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                      Total added to dataset: {totalGeneratedSoFar}
                    </p>
                    {augmentationRun.shortfall_message && (
                      <div
                        className="p-3 rounded-[6px] border"
                        style={{ borderColor: "var(--warning-amber)", backgroundColor: "var(--label-amber)" }}
                      >
                        <p style={{ fontSize: "12px", color: "var(--ink-dark)" }}>
                          {augmentationRun.shortfall_message}
                        </p>
                      </div>
                    )}
                    <LFButton variant="secondary" onClick={handleResetAugmentation}>
                      Run Another Augmentation
                    </LFButton>
                  </div>
                )}
              </div>
            )}

            {augmentationError && (
              <p style={{ fontSize: "12px", color: "var(--error-red)" }}>{augmentationError}</p>
            )}
          </div>
        </LFCard>
      )}

      <div className="flex flex-col items-end gap-2 pt-4">
        <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
          Export format: {fmt.toUpperCase()} (selected in setup)
        </span>
        <LFButton data-testid="download-button" onClick={handleDownload} className="flex items-center gap-2" disabled={isDownloading}>
          <Download className="w-4 h-4" />
          {isDownloading ? "Downloading..." : downloadLabel}
        </LFButton>
        <LFButton
          data-testid="save-to-gallery-button"
          variant="secondary"
          onClick={handleSaveToGallery}
          disabled={isSaving || isSavedToGallery}
        >
          {isSaving ? "Saving..." : "Save to Gallery"}
        </LFButton>
        {downloadError && (
          <span style={{ fontSize: "12px", color: "var(--error-red)" }}>
            {downloadError}
          </span>
        )}
        {saveMessage && (
          <span style={{ fontSize: "12px", color: "var(--success-green)" }}>
            {saveMessage}
          </span>
        )}
        {saveError && (
          <span style={{ fontSize: "12px", color: "var(--error-red)" }}>
            {saveError}
          </span>
        )}
      </div>
    </div>
  );
}
