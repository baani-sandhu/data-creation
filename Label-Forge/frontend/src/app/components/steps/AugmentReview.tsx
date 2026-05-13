import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router";
import { LFButton } from "../ui/LFButton";
import { LFCard } from "../ui/LFCard";
import { getIdToken } from "../../lib/auth";
import { API_BASE_URL } from "../../lib/api";
import { S } from "../../state";

type AugmentationMode = "paraphrase" | "generate";

interface NoiseReport {
  status?: "clean" | "warning" | "rollback_recommended";
  noise_percentage?: number;
}

interface AugmentationJobDetail {
  augmentation_job_id: string;
  mode: AugmentationMode;
  status: string;
  noise_report?: NoiseReport | null;
}

interface ResultItem {
  _id: string;
  pair: Record<string, unknown>;
  source: string;
  chunk_index?: number;
  approved?: boolean;
  discarded?: boolean;
  original_result_id?: string;
  augmentation_source?: string;
}

interface LocationState {
  augmentationJobId?: string;
}

export function AugmentReview() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state || {}) as LocationState;
  const augmentationJobId = state.augmentationJobId || S.augmentationJobId || "";

  const [jobDetail, setJobDetail] = useState<AugmentationJobDetail | null>(null);
  const [pendingPairs, setPendingPairs] = useState<ResultItem[]>([]);
  const [approvedCount, setApprovedCount] = useState(0);
  const [discardedCount, setDiscardedCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyIds, setBusyIds] = useState<Record<string, boolean>>({});
  const [bulkBusy, setBulkBusy] = useState<"approve" | "discard" | "">("");

  const getAuthHeaders = async () => {
    const token = await getIdToken();
    if (!token) throw new Error("Please sign in to continue.");
    return { Authorization: `Bearer ${token}` };
  };

  const toDisplayText = (value: unknown) => {
    if (value === null || value === undefined) return "";
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  };

  const renderPairValue = (value: unknown): ReactNode => {
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      return (
        <div className="space-y-1">
          {Object.entries(value as Record<string, unknown>).map(([key, nestedValue]) => (
            <div key={key}>
              <strong>{key}:</strong> {toDisplayText(nestedValue)}
            </div>
          ))}
        </div>
      );
    }
    return <span>{toDisplayText(value)}</span>;
  };

  const load = async () => {
    if (!S.jobId || !augmentationJobId) {
      setError("No augmentation run selected.");
      setIsLoading(false);
      return;
    }

    setError("");
    setIsLoading(true);
    try {
      const authHeaders = await getAuthHeaders();
      const [jobRes, pendingRes, approvedRes, discardedRes] = await Promise.all([
        fetch(`${API_BASE_URL}/jobs/${S.jobId}/augment/${augmentationJobId}`, { headers: authHeaders }),
        fetch(`${API_BASE_URL}/jobs/${S.jobId}/results?source=augmented&augmentation_job_id=${augmentationJobId}&approved=false`, { headers: authHeaders }),
        fetch(`${API_BASE_URL}/jobs/${S.jobId}/results?source=augmented&augmentation_job_id=${augmentationJobId}&approved=true`, { headers: authHeaders }),
        fetch(`${API_BASE_URL}/jobs/${S.jobId}/results?source=augmented&augmentation_job_id=${augmentationJobId}&include_discarded=true`, { headers: authHeaders }),
      ]);

      if (!jobRes.ok) throw new Error((await jobRes.text()) || "Failed to load augmentation details.");
      if (!pendingRes.ok) throw new Error((await pendingRes.text()) || "Failed to load pending augmented pairs.");
      if (!approvedRes.ok) throw new Error((await approvedRes.text()) || "Failed to load approved stats.");
      if (!discardedRes.ok) throw new Error((await discardedRes.text()) || "Failed to load discarded stats.");

      const jobData = (await jobRes.json()) as AugmentationJobDetail;
      const pendingData = await pendingRes.json();
      const approvedData = await approvedRes.json();
      const discardedData = await discardedRes.json();

      const allForRun = (discardedData.results || []) as ResultItem[];
      const discarded = allForRun.filter((pair) => pair.discarded === true).length;

      setJobDetail(jobData);
      setPendingPairs((pendingData.results || []) as ResultItem[]);
      setApprovedCount(((approvedData.results || []) as ResultItem[]).length);
      setDiscardedCount(discarded);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load augmented review.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [augmentationJobId]);

  const actOnPair = async (pairId: string, action: "approve" | "discard") => {
    if (!S.jobId) return;
    setBusyIds((prev) => ({ ...prev, [pairId]: true }));
    try {
      const authHeaders = await getAuthHeaders();
      const payload = action === "approve" ? { approved: true } : { discarded: true };
      const response = await fetch(`${API_BASE_URL}/jobs/${S.jobId}/results/${pairId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error((await response.text()) || `Failed to ${action} pair.`);

      setPendingPairs((prev) => prev.filter((item) => item._id !== pairId));
      if (action === "approve") setApprovedCount((prev) => prev + 1);
      if (action === "discard") setDiscardedCount((prev) => prev + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update pair.");
    } finally {
      setBusyIds((prev) => ({ ...prev, [pairId]: false }));
    }
  };

  const bulkAct = async (action: "approve" | "discard") => {
    if (!S.jobId || pendingPairs.length === 0) return;
    setBulkBusy(action);
    setError("");
    try {
      const authHeaders = await getAuthHeaders();
      const payload = action === "approve" ? { approved: true } : { discarded: true };
      const ids = pendingPairs.map((p) => p._id);

      await Promise.all(
        ids.map((id) =>
          fetch(`${API_BASE_URL}/jobs/${S.jobId}/results/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", ...authHeaders },
            body: JSON.stringify(payload),
          }).then(async (res) => {
            if (!res.ok) throw new Error((await res.text()) || `Failed to ${action} one or more pairs.`);
          })
        )
      );

      const total = ids.length;
      setPendingPairs([]);
      if (action === "approve") setApprovedCount((prev) => prev + total);
      if (action === "discard") setDiscardedCount((prev) => prev + total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to run bulk action.");
      await load();
    } finally {
      setBulkBusy("");
    }
  };

  const modeLabel = jobDetail?.mode === "paraphrase" ? "Paraphrase Run" : "New Generation Run";
  const noisePct = jobDetail?.noise_report?.noise_percentage ?? 0;
  const pendingCount = pendingPairs.length;

  const noiseColor = useMemo(() => {
    if (noisePct > 30) return "var(--error-red)";
    if (noisePct >= 20) return "var(--warning-amber)";
    return "var(--success-green)";
  }, [noisePct]);

  const runHint = (item: ResultItem) => {
    if (jobDetail?.mode === "paraphrase") {
      return item.original_result_id ? `Paraphrased from pair #${item.original_result_id.slice(0, 8)}` : "Paraphrased pair";
    }
    return typeof item.chunk_index === "number" ? `Generated from chunk #${item.chunk_index}` : "Generated from source chunk";
  };

  return (
    <div className="space-y-4" data-testid="augment-review">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate("/wizard/augment")} style={{ fontSize: "12px", color: "var(--text-muted)" }}>&lt;- Back to Augmentation</button>
        <LFButton variant="ghost" onClick={() => navigate("/wizard/export")}>Done - Back to Export -&gt;</LFButton>
      </div>

      <LFCard>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p style={{ fontWeight: 700, fontSize: "16px" }}>Review Augmented Pairs</p>
            <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>{modeLabel}</p>
          </div>
          <div className="rounded-[999px] px-3 py-1" style={{ backgroundColor: `${noiseColor}20`, color: noiseColor, fontSize: "12px", fontWeight: 600 }}>
            Noise: {noisePct.toFixed(2)}%
          </div>
        </div>
        <div className="mt-3" style={{ fontSize: "12px", color: "var(--text-muted)" }}>
          {approvedCount} approved / {pendingCount} pending / {discardedCount} discarded
        </div>
      </LFCard>

      {isLoading && <LFCard><p style={{ fontSize: "12px", color: "var(--text-muted)" }}>Loading augmented pairs...</p></LFCard>}
      {error && <p style={{ fontSize: "12px", color: "var(--error-red)" }}>{error}</p>}

      {!isLoading && pendingPairs.length > 0 && (
        <div className="space-y-3 pb-20">
          {pendingPairs.map((item) => (
            <LFCard key={item._id}>
              <div className="space-y-2">
                {Object.entries(item.pair || {}).map(([field, value]) => (
                  <div key={field} style={{ fontSize: "13px", lineHeight: "1.6" }}>
                    <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)", marginRight: "6px" }}>{field}:</span>
                    {renderPairValue(value)}
                  </div>
                ))}
                <p style={{ fontSize: "11px", color: "var(--text-muted)" }}>{runHint(item)}</p>
                <div className="flex gap-2 pt-1">
                  <LFButton onClick={() => actOnPair(item._id, "approve")} disabled={Boolean(busyIds[item._id])}>
                    {busyIds[item._id] ? "Working..." : "Approve ?"}
                  </LFButton>
                  <LFButton variant="ghost" onClick={() => actOnPair(item._id, "discard")} disabled={Boolean(busyIds[item._id])}>
                    {busyIds[item._id] ? "Working..." : "Discard ?"}
                  </LFButton>
                </div>
              </div>
            </LFCard>
          ))}
        </div>
      )}

      {!isLoading && pendingPairs.length === 0 && (
        <LFCard>
          <div className="space-y-2">
            <p style={{ fontWeight: 700 }}>All pairs reviewed!</p>
            <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>{approvedCount} approved, {discardedCount} discarded</p>
            <LFButton onClick={() => navigate("/wizard/export")}>Done - Back to Export -&gt;</LFButton>
          </div>
        </LFCard>
      )}

      {pendingPairs.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 border-t p-3" style={{ backgroundColor: "white", borderColor: "var(--border-color)" }}>
          <div className="max-w-[980px] mx-auto flex items-center justify-between gap-3">
            <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>{pendingCount} pairs remaining</div>
            <div className="flex items-center gap-2">
              <LFButton onClick={() => bulkAct("approve")} disabled={bulkBusy !== ""}>{bulkBusy === "approve" ? "Approving..." : "Approve All Remaining"}</LFButton>
              <LFButton variant="ghost" onClick={() => bulkAct("discard")} disabled={bulkBusy !== ""}>{bulkBusy === "discard" ? "Discarding..." : "Discard All Remaining"}</LFButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
