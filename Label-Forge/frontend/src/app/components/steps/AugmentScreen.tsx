import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { LFButton } from "../ui/LFButton";
import { LFCard } from "../ui/LFCard";
import { getIdToken } from "../../lib/auth";
import { API_BASE_URL } from "../../lib/api";
import { S, persistState } from "../../state";

type AugmentationMode = "paraphrase" | "generate";
type AugmentationStatus = "pending" | "running" | "completed" | "failed" | "rolled_back";

interface NoiseReport {
  status: "clean" | "warning" | "rollback_recommended";
  noise_percentage?: number;
  message?: string;
  redundant_count?: number;
  drifted_count?: number;
  total_checked?: number;
  hallucinated_count?: number;
  total_sampled?: number;
  total_generated?: number;
}

interface AugmentationJob {
  augmentation_job_id: string;
  mode: AugmentationMode;
  status: AugmentationStatus;
  pairs_added: number;
  completed_batches: number;
  noise_report?: NoiseReport | null;
}

interface HistoryRow {
  augmentation_job_id: string;
  mode: AugmentationMode;
  status: AugmentationStatus;
  pairs_added: number;
  noise_report?: NoiseReport | null;
  can_rollback: boolean;
}

export function AugmentScreen() {
  const navigate = useNavigate();
  const [approvedCount, setApprovedCount] = useState(0);
  const [paraphraseTargetSize, setParaphraseTargetSize] = useState("40000");
  const [activeJob, setActiveJob] = useState<AugmentationJob | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [rollingBack, setRollingBack] = useState(false);

  const getAuthHeaders = async () => {
    const token = await getIdToken();
    if (!token) throw new Error("Please sign in to continue.");
    return { Authorization: `Bearer ${token}` };
  };

  const refreshCounts = async () => {
    if (!S.jobId) return;
    const authHeaders = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/jobs/${S.jobId}/results?approved=true`, { headers: authHeaders });
    if (!response.ok) throw new Error((await response.text()) || "Failed to load approved count.");
    const data = await response.json();
    const count = (data.results || []).filter((result: { discarded?: boolean }) => !result.discarded).length;
    setApprovedCount(count);
  };

  const refreshHistory = async () => {
    if (!S.jobId) return;
    setHistoryLoading(true);
    try {
      const authHeaders = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/jobs/${S.jobId}/augment/history`, { headers: authHeaders });
      if (!response.ok) throw new Error((await response.text()) || "Failed to load augmentation history.");
      setHistory((await response.json()) as HistoryRow[]);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    const load = async () => {
      try {
        await refreshCounts();
        await refreshHistory();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load augmentation data.");
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (!activeJob || !S.jobId) return;
    if (["completed", "failed", "rolled_back"].includes(activeJob.status)) return;

    let stopped = false;
    const poll = async () => {
      try {
        const authHeaders = await getAuthHeaders();
        const response = await fetch(`${API_BASE_URL}/jobs/${S.jobId}/augment/${activeJob.augmentation_job_id}`, { headers: authHeaders });
        if (!response.ok) throw new Error((await response.text()) || "Failed to fetch augmentation status.");
        const data = (await response.json()) as AugmentationJob;
        if (stopped) return;
        setActiveJob(data);
        if (["completed", "failed", "rolled_back"].includes(data.status)) {
          await refreshCounts();
          await refreshHistory();
          if (data.status === "completed") {
            S.augmentationJobId = data.augmentation_job_id;
            persistState();
          }
        }
      } catch (err) {
        if (!stopped) setError(err instanceof Error ? err.message : "Unable to poll augmentation job.");
      }
    };

    poll();
    const id = window.setInterval(poll, 3000);
    return () => {
      stopped = true;
      window.clearInterval(id);
    };
  }, [activeJob?.augmentation_job_id, activeJob?.status]);

  const parsedTarget = Number(paraphraseTargetSize);
  const gap = Math.max((Number.isFinite(parsedTarget) ? parsedTarget : 0) - approvedCount, 0);
  const minTarget = approvedCount + 1;
  const validationError = !paraphraseTargetSize.trim() || Number.isNaN(parsedTarget) || parsedTarget <= approvedCount
    ? `Target size must be greater than current approved pairs (${approvedCount}).`
    : "";

  const start = async (mode: AugmentationMode) => {
    if (!S.jobId) return;
    if (mode === "paraphrase" && validationError) {
      setError(validationError);
      return;
    }
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const authHeaders = await getAuthHeaders();
      const url = mode === "paraphrase" ? `${API_BASE_URL}/jobs/${S.jobId}/augment/paraphrase` : `${API_BASE_URL}/jobs/${S.jobId}/augment/generate`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: mode === "paraphrase" ? JSON.stringify({ target_size: parsedTarget }) : JSON.stringify({}),
      });
      if (!response.ok) throw new Error((await response.text()) || "Failed to start augmentation run.");
      const data = await response.json();
      setActiveJob({
        augmentation_job_id: String(data.augmentation_job_id),
        mode,
        status: "pending",
        pairs_added: 0,
        completed_batches: 0,
        noise_report: null,
      });
      await refreshHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to start augmentation.");
    } finally {
      setLoading(false);
    }
  };

  const rollback = async (augmentationJobId: string) => {
    if (!S.jobId) return;
    setRollingBack(true);
    setError("");
    setMessage("");
    try {
      const authHeaders = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/jobs/${S.jobId}/augment/${augmentationJobId}`, { method: "DELETE", headers: authHeaders });
      if (!response.ok) throw new Error((await response.text()) || "Failed to rollback run.");
      const data = await response.json();
      setMessage(`${data?.deleted_pairs ?? 0} pairs removed.`);
      if (S.augmentationJobId === augmentationJobId) {
        S.augmentationJobId = null;
        persistState();
      }
      setActiveJob((prev) => (prev?.augmentation_job_id === augmentationJobId ? null : prev));
      await refreshCounts();
      await refreshHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to rollback run.");
    } finally {
      setRollingBack(false);
    }
  };

  const noise = activeJob?.noise_report;
  const noiseColor = useMemo(() => {
    const n = noise?.noise_percentage ?? 0;
    if (n > 30) return "var(--error-red)";
    if (n >= 20) return "var(--warning-amber)";
    return "var(--success-green)";
  }, [noise?.noise_percentage]);

  return (
    <div className="space-y-4" data-testid="augment-screen">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate("/wizard/export")} style={{ fontSize: "12px", color: "var(--text-muted)" }}>&lt;- Back to Export</button>
        <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Step 6.5 - Augment</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <LFCard>
          <div className="space-y-3">
            <p style={{ fontWeight: 600 }}>Paraphrase Existing Data</p>
            <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>Generate paraphrased variants of your approved pairs to reach a target dataset size.</p>
            <input type="number" min={minTarget} value={paraphraseTargetSize} onChange={(event) => setParaphraseTargetSize(event.target.value)} className="w-full rounded-[6px] border px-3 py-2" style={{ borderColor: "var(--border-color)" }} />
            <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>Current approved pairs: {approvedCount}. Need {gap} more pairs.</p>
            {validationError && <p style={{ fontSize: "12px", color: "var(--error-red)" }}>{validationError}</p>}
            <LFButton onClick={() => start("paraphrase")} disabled={loading || Boolean(validationError)}>{loading ? "Starting..." : "Start Paraphrasing"}</LFButton>
          </div>
        </LFCard>

        <LFCard>
          <div className="space-y-3">
            <p style={{ fontWeight: 600 }}>Generate New Pairs</p>
            <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>Extract additional training pairs from your source documents that were not captured in the original run.</p>
            <LFButton onClick={() => start("generate")} disabled={loading}>{loading ? "Starting..." : "Generate New Pairs"}</LFButton>
          </div>
        </LFCard>
      </div>

      {activeJob && !["completed", "failed", "rolled_back"].includes(activeJob.status) && (
        <LFCard>
          <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>Processing... {activeJob.completed_batches} batches completed</p>
          <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>Mode: {activeJob.mode === "paraphrase" ? "Paraphrase Run" : "New Generation Run"} - Status: {activeJob.status}</p>
        </LFCard>
      )}

      {activeJob && activeJob.status === "completed" && noise && (
        <LFCard>
          <div className="space-y-2">
            <p style={{ fontWeight: 600 }}>{activeJob.mode === "paraphrase" ? "Paraphrase Run" : "New Generation Run"}</p>
            <p style={{ color: noiseColor, fontWeight: 600 }}>Noise: {(noise.noise_percentage ?? 0).toFixed(2)}%</p>
            {activeJob.mode === "paraphrase" ? (
              <>
                <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>{noise.redundant_count ?? 0} near-duplicate pairs</p>
                <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>{noise.drifted_count ?? 0} drifted pairs</p>
                <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>{noise.total_checked ?? 0} / {activeJob.pairs_added} pairs checked</p>
              </>
            ) : (
              <>
                <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>{noise.hallucinated_count ?? 0} hallucinated pairs (from sample of {noise.total_sampled ?? 0})</p>
                <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>{noise.total_generated ?? activeJob.pairs_added} total pairs generated</p>
              </>
            )}
            <p style={{ fontSize: "12px" }}>{noise.message || "Run completed."}</p>
            <div className="flex gap-2">
              {noise.status !== "clean" && <LFButton variant="ghost" onClick={() => rollback(activeJob.augmentation_job_id)} disabled={rollingBack}>{rollingBack ? "Rolling back..." : "Rollback This Run"}</LFButton>}
              <LFButton onClick={() => navigate("/wizard/augment/review", { state: { augmentationJobId: activeJob.augmentation_job_id } })}>Review Generated Pairs -&gt;</LFButton>
            </div>
          </div>
        </LFCard>
      )}

      <LFCard>
        <p style={{ fontWeight: 600, marginBottom: "8px" }}>Augmentation History</p>
        {historyLoading && <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>Loading history...</p>}
        {!historyLoading && history.length === 0 && <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>No augmentation runs yet.</p>}
        {!historyLoading && history.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full" style={{ fontSize: "12px" }}>
              <thead>
                <tr>
                  <th className="text-left py-2">Mode</th><th className="text-left py-2">Pairs Added</th><th className="text-left py-2">Noise %</th><th className="text-left py-2">Status</th><th className="text-left py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {history.map((row) => (
                  <tr key={row.augmentation_job_id}>
                    <td className="py-2">{row.mode === "paraphrase" ? "Paraphrase" : "Generate"}</td>
                    <td className="py-2">{row.pairs_added}</td>
                    <td className="py-2">{(row.noise_report?.noise_percentage ?? 0).toFixed(2)}%</td>
                    <td className="py-2">{row.status === "rolled_back" ? "Rolled Back" : row.status === "pending" || row.status === "running" ? "Processing..." : row.status}</td>
                    <td className="py-2">
                      {row.status === "completed" && row.can_rollback ? <LFButton variant="ghost" onClick={() => rollback(row.augmentation_job_id)} disabled={rollingBack}>Rollback</LFButton> : row.status === "rolled_back" ? "Rolled Back" : row.status === "pending" || row.status === "running" ? "Processing..." : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </LFCard>

      {error && <p style={{ fontSize: "12px", color: "var(--error-red)" }}>{error}</p>}
      {message && <p style={{ fontSize: "12px", color: "var(--success-green)" }}>{message}</p>}
    </div>
  );
}
