import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Download } from "lucide-react";
import { LFButton } from "../ui/LFButton";
import { LFCard } from "../ui/LFCard";
import { getIdToken } from "../../lib/auth";
import { API_BASE_URL } from "../../lib/api";
import { S, persistState, type JobData, type ResultItem } from "../../state";

interface ResultsStats {
  pending: number;
}

type ExportFormat = "json" | "jsonl" | "csv";
type PreviewTab = "all" | "original" | "augmented";

export function Step6Export() {
  const navigate = useNavigate();
  const [exportResults, setExportResults] = useState<ResultItem[]>(S.exportResults ?? []);
  const [originalResults, setOriginalResults] = useState<ResultItem[]>([]);
  const [augmentedResults, setAugmentedResults] = useState<ResultItem[]>([]);
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
  const [activePreviewTab, setActivePreviewTab] = useState<PreviewTab>("all");

  const fmt = ((jobData?.output_format || "csv").toLowerCase()) as ExportFormat;
  const labels: Record<ExportFormat, string> = { json: "Download JSON", jsonl: "Download JSONL", csv: "Download CSV" };
  const downloadLabel = labels[fmt];

  const activePreviewResults =
    activePreviewTab === "original" ? originalResults : activePreviewTab === "augmented" ? augmentedResults : exportResults;
  const previewHeaderText =
    activePreviewTab === "original"
      ? `Showing ${activePreviewResults.length} original pairs`
      : activePreviewTab === "augmented"
        ? `Showing ${activePreviewResults.length} augmented pairs`
        : `Showing all ${activePreviewResults.length} pairs`;

  const getAuthHeaders = async () => {
    const token = await getIdToken();
    if (!token) throw new Error("Please sign in to continue.");
    return { Authorization: `Bearer ${token}` };
  };

  const refreshExportData = async () => {
    setPreviewError("");
    if (!S.jobId) {
      setPreviewError("No job found. Please create a job first.");
      return;
    }

    setIsPreviewLoading(true);
    try {
      const authHeaders = await getAuthHeaders();
      const [approvedResponse, augmentedResponse, statsResponse, jobResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/jobs/${S.jobId}/results?approved=true`, { headers: authHeaders }),
        fetch(`${API_BASE_URL}/jobs/${S.jobId}/results?approved=true&source=augmented`, { headers: authHeaders }),
        fetch(`${API_BASE_URL}/jobs/${S.jobId}/results/stats`, { headers: authHeaders }),
        fetch(`${API_BASE_URL}/jobs/${S.jobId}`, { headers: authHeaders }),
      ]);
      if (!approvedResponse.ok) throw new Error((await approvedResponse.text()) || "Failed to load original export results.");
      if (!augmentedResponse.ok) throw new Error((await augmentedResponse.text()) || "Failed to load augmented export results.");
      if (!statsResponse.ok) throw new Error((await statsResponse.text()) || "Failed to load export stats.");
      if (!jobResponse.ok) throw new Error((await jobResponse.text()) || "Failed to load job details.");

      const approvedPayload = await approvedResponse.json();
      const augmentedPayload = await augmentedResponse.json();
      const statsData = await statsResponse.json();
      const nextJobData = await jobResponse.json();

      const approvedResults: ResultItem[] = approvedPayload.results || [];
      const nextAugmentedResults: ResultItem[] = augmentedPayload.results || [];
      const nextOriginalResults = approvedResults.filter((result) => result.source !== "augmented");
      const combinedById = new Map<string, ResultItem>();
      for (const result of nextOriginalResults) combinedById.set(result._id, result);
      for (const result of nextAugmentedResults) combinedById.set(result._id, result);
      const nextResults = Array.from(combinedById.values());

      S.exportResults = nextResults;
      setExportResults(nextResults);
      setOriginalResults(nextOriginalResults);
      setAugmentedResults(nextAugmentedResults);
      setStats(statsData as ResultsStats);
      S.jobData = nextJobData;
      persistState();
      setJobData(nextJobData as JobData);
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : "Unable to load export data.");
    } finally {
      setIsPreviewLoading(false);
    }
  };

  useEffect(() => {
    refreshExportData();
  }, []);

  const handleDownload = async () => {
    setDownloadError("");
    if (!S.jobId) return setDownloadError("No job found. Please create a job first.");
    setIsDownloading(true);
    try {
      const authHeaders = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/jobs/${S.jobId}/export`, { headers: authHeaders });
      if (!response.ok) throw new Error((await response.text()) || "Failed to download export.");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `labelforge_dataset.${fmt}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : "Unable to download export.");
    } finally {
      setIsDownloading(false);
    }
  };

  const handleSaveToGallery = async () => {
    setSaveMessage("");
    setSaveError("");
    if (!S.jobId) return setSaveError("No job found. Please create a job first.");
    setIsSaving(true);
    try {
      const authHeaders = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/jobs/${S.jobId}/save-to-gallery`, { method: "POST", headers: authHeaders });
      if (!response.ok) throw new Error((await response.text()) || "Failed to save dataset.");
      const data = await response.json();
      setSaveMessage(data?.already_saved ? "Already saved to gallery" : "Dataset saved to your gallery. View it on the Dashboard.");
      setIsSavedToGallery(true);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Unable to save dataset.");
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
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
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
          <pre className="whitespace-pre-wrap break-words" style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "#E2E8F0", margin: 0 }}>
            {JSON.stringify(item.pair, null, 2)}
          </pre>
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
              <th key={field} className="px-3 py-2 text-left" style={{ fontFamily: "var(--font-mono)", color: "#93c5fd", borderBottom: "1px solid rgba(148, 163, 184, 0.2)" }}>
                {field}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((item, index) => (
            <tr key={item._id} style={{ backgroundColor: index % 2 === 0 ? "#111827" : "#0b1220" }}>
              {fields.map((field) => (
                <td key={`${item._id}-${field}`} className="px-3 py-2 align-top" style={{ borderBottom: "1px solid rgba(148, 163, 184, 0.12)" }}>
                  {toDisplayText(item.pair[field])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div data-testid="step6-export" className="space-y-4">
      <div className="grid grid-cols-4 gap-4">
        <LFCard><div className="text-center"><div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-muted)", marginBottom: "8px" }}>TOTAL LABELED</div><div style={{ fontFamily: "var(--font-mono)", fontSize: "32px", fontWeight: 600 }}>{totalLabeled}</div></div></LFCard>
        <LFCard><div className="text-center"><div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-muted)", marginBottom: "8px" }}>AUTO-SAVED</div><div style={{ fontFamily: "var(--font-mono)", fontSize: "32px", fontWeight: 600, color: "var(--success-green)" }}>{autoSaved}</div></div></LFCard>
        <LFCard><div className="text-center"><div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-muted)", marginBottom: "8px" }}>HUMAN-REVIEWED</div><div style={{ fontFamily: "var(--font-mono)", fontSize: "32px", fontWeight: 600, color: "var(--primary-blue)" }}>{humanReviewed}</div></div></LFCard>
        <LFCard><div className="text-center"><div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-muted)", marginBottom: "8px" }}>PENDING</div><div style={{ fontFamily: "var(--font-mono)", fontSize: "32px", fontWeight: 600, color: "var(--text-muted)" }}>{stats?.pending ?? 0}</div></div></LFCard>
      </div>

      <div className="flex justify-end">
        <LFButton onClick={() => navigate("/wizard/augment")}>Augment Dataset -&gt;</LFButton>
      </div>

      <LFCard data-testid="export-preview" header="Export Preview">
        <div className="p-4 rounded-[6px]" style={{ backgroundColor: "var(--ink-dark)" }}>
          {isPreviewLoading && <p style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "#93c5fd" }}>Loading preview...</p>}
          {previewError && <p style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "#fca5a5" }}>{previewError}</p>}
          {!isPreviewLoading && !previewError && exportResults.length === 0 && <p style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "#93c5fd" }}>No approved results yet.</p>}
          {!isPreviewLoading && !previewError && exportResults.length > 0 && (
            <div className="space-y-3">
              <div className="inline-flex rounded-lg border p-1" style={{ borderColor: "rgba(148, 163, 184, 0.3)" }}>
                <button onClick={() => setActivePreviewTab("original")} className="px-3 py-1.5 rounded-md text-xs transition-colors" style={{ backgroundColor: activePreviewTab === "original" ? "var(--label-blue)" : "transparent", color: activePreviewTab === "original" ? "var(--ink-dark)" : "#93c5fd", fontWeight: activePreviewTab === "original" ? 600 : 500 }}>Original ({originalResults.length})</button>
                <button onClick={() => setActivePreviewTab("augmented")} className="px-3 py-1.5 rounded-md text-xs transition-colors" style={{ backgroundColor: activePreviewTab === "augmented" ? "var(--label-blue)" : "transparent", color: activePreviewTab === "augmented" ? "var(--ink-dark)" : "#93c5fd", fontWeight: activePreviewTab === "augmented" ? 600 : 500 }}>Augmented ({augmentedResults.length})</button>
                <button onClick={() => setActivePreviewTab("all")} className="px-3 py-1.5 rounded-md text-xs transition-colors" style={{ backgroundColor: activePreviewTab === "all" ? "var(--label-blue)" : "transparent", color: activePreviewTab === "all" ? "var(--ink-dark)" : "#93c5fd", fontWeight: activePreviewTab === "all" ? 600 : 500 }}>All ({exportResults.length})</button>
              </div>
              <div style={{ fontSize: "12px", color: "#93c5fd", fontFamily: "var(--font-mono)" }}>{previewHeaderText}</div>
              <div className="max-h-[500px] overflow-y-auto rounded-[6px] px-3 py-2" style={{ backgroundColor: "#0f172a" }}>
                {fmt === "csv" ? renderCsvPreview(activePreviewResults) : renderJsonPreview(activePreviewResults)}
              </div>
            </div>
          )}
        </div>
      </LFCard>

      <div className="flex flex-col items-end gap-2 pt-4">
        <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Export format: {fmt.toUpperCase()} (selected in setup)</span>
        <LFButton data-testid="download-button" onClick={handleDownload} className="flex items-center gap-2" disabled={isDownloading}>
          <Download className="w-4 h-4" />
          {isDownloading ? "Downloading..." : downloadLabel}
        </LFButton>
        <LFButton data-testid="save-to-gallery-button" variant="secondary" onClick={handleSaveToGallery} disabled={isSaving || isSavedToGallery}>
          {isSaving ? "Saving..." : "Save to Gallery"}
        </LFButton>
        {downloadError && <span style={{ fontSize: "12px", color: "var(--error-red)" }}>{downloadError}</span>}
        {saveMessage && <span style={{ fontSize: "12px", color: "var(--success-green)" }}>{saveMessage}</span>}
        {saveError && <span style={{ fontSize: "12px", color: "var(--error-red)" }}>{saveError}</span>}
      </div>
    </div>
  );
}
