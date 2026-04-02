import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { LFCard } from "../ui/LFCard";
import { LFButton } from "../ui/LFButton";
import { LFBadge } from "../ui/LFBadge";
import { S, ResultItem, GenerationResult } from "../../state";
import { getIdToken } from "../../lib/auth";

interface ResultsStats {
  total: number;
  approved: number;
  pending: number;
  discarded: number;
  human_reviewed: number;
  by_run: Record<string, number>;
}

export function Step5Review() {
  const navigate = useNavigate();
  const [approvedResults, setApprovedResults] = useState<ResultItem[]>(S.approvedResults ?? []);
  const [pendingResults, setPendingResults] = useState<ResultItem[]>(S.pendingResults ?? []);
  const [editedPairs, setEditedPairs] = useState<Record<string, Record<string, string>>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [approvingIds, setApprovingIds] = useState<Record<string, boolean>>({});
  const [discardingIds, setDiscardingIds] = useState<Record<string, boolean>>({});
  const [addingExampleIds, setAddingExampleIds] = useState<Record<string, boolean>>({});
  const [addedExampleIds, setAddedExampleIds] = useState<Record<string, boolean>>({});
  const [stats, setStats] = useState<ResultsStats | null>(null);
  const [feedbackCount, setFeedbackCount] = useState(S.feedbackCount ?? 0);
  const [isRerunning, setIsRerunning] = useState(false);

  const API_BASE = "http://localhost:8001";

  const getAuthHeaders = async () => {
    const token = await getIdToken();
    if (!token) {
      throw new Error("Please sign in to continue.");
    }
    return { Authorization: `Bearer ${token}` };
  };

  const refreshResultsAndStats = async () => {
    setError("");
    if (!S.jobId) {
      setError("No job found. Please create a job first.");
      return;
    }

    try {
      const authHeaders = await getAuthHeaders();
      const [resultsResponse, statsResponse] = await Promise.all([
        fetch(`${API_BASE}/jobs/${S.jobId}/results`, { headers: authHeaders }),
        fetch(`${API_BASE}/jobs/${S.jobId}/results/stats`, { headers: authHeaders }),
      ]);

      if (!resultsResponse.ok) {
        const message = await resultsResponse.text();
        throw new Error(message || "Failed to load results.");
      }
      if (!statsResponse.ok) {
        const message = await statsResponse.text();
        throw new Error(message || "Failed to load stats.");
      }

      const resultsData = await resultsResponse.json();
      const statsData = await statsResponse.json();

      const results: ResultItem[] = resultsData.results || [];
      S.results = results;
      S.approvedResults = results.filter((r) => r.approved && !r.discarded);
      S.pendingResults = results.filter((r) => !r.approved && !r.discarded);

      setApprovedResults(S.approvedResults);
      setPendingResults(S.pendingResults);
      setStats(statsData as ResultsStats);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load results.";
      setError(message);
    }
  };

  useEffect(() => {
    const fetchAll = async () => {
      setIsLoading(true);
      await refreshResultsAndStats();
      setIsLoading(false);
    };

    fetchAll();
  }, []);

  const handleNext = () => {
    navigate("/wizard/export");
  };

  const updateStateStores = (nextApproved: ResultItem[], nextPending: ResultItem[]) => {
    setApprovedResults(nextApproved);
    setPendingResults(nextPending);
    S.approvedResults = nextApproved;
    S.pendingResults = nextPending;
    S.results = [...nextApproved, ...nextPending];
  };

  const getEditedPair = (item: ResultItem) => {
    const edits = editedPairs[item._id] || {};
    return { ...item.pair, ...edits };
  };

  const handleApprove = async (item: ResultItem) => {
    if (!S.jobId) return;
    setError("");
    setApprovingIds((prev) => ({ ...prev, [item._id]: true }));
    try {
      const updatedPair = getEditedPair(item);
      const authHeaders = await getAuthHeaders();
      const response = await fetch(`${API_BASE}/jobs/${S.jobId}/results/${item._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ approved: true, pair: updatedPair }),
      });
      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Failed to approve result.");
      }

      const approvedItem: ResultItem = {
        ...item,
        approved: true,
        human_reviewed: true,
        pair: updatedPair,
      };
      const nextPending = pendingResults.filter((r) => r._id !== item._id);
      const nextApproved = [approvedItem, ...approvedResults];
      updateStateStores(nextApproved, nextPending);
      await refreshResultsAndStats();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to approve result.";
      setError(message);
    } finally {
      setApprovingIds((prev) => ({ ...prev, [item._id]: false }));
    }
  };

  const handleDiscard = async (item: ResultItem) => {
    if (!S.jobId) return;
    setError("");
    setDiscardingIds((prev) => ({ ...prev, [item._id]: true }));
    try {
      const authHeaders = await getAuthHeaders();
      const response = await fetch(`${API_BASE}/jobs/${S.jobId}/results/${item._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ discarded: true }),
      });
      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Failed to discard result.");
      }
      const nextPending = pendingResults.filter((r) => r._id !== item._id);
      updateStateStores(approvedResults, nextPending);
      await refreshResultsAndStats();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to discard result.";
      setError(message);
    } finally {
      setDiscardingIds((prev) => ({ ...prev, [item._id]: false }));
    }
  };

  const handleAddExample = async (item: ResultItem) => {
    if (!S.jobId) return;
    setError("");
    setAddingExampleIds((prev) => ({ ...prev, [item._id]: true }));
    try {
      const authHeaders = await getAuthHeaders();
      const response = await fetch(
        `${API_BASE}/jobs/${S.jobId}/results/${item._id}/add-example`,
        { method: "POST", headers: authHeaders }
      );
      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Failed to add example.");
      }
      setAddedExampleIds((prev) => ({ ...prev, [item._id]: true }));
      const nextCount = feedbackCount + 1;
      setFeedbackCount(nextCount);
      S.feedbackCount = nextCount;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to add example.";
      setError(message);
    } finally {
      setAddingExampleIds((prev) => ({ ...prev, [item._id]: false }));
    }
  };

  const handlePairChange = (itemId: string, field: string, value: string) => {
    setEditedPairs((prev) => ({
      ...prev,
      [itemId]: {
        ...(prev[itemId] || {}),
        [field]: value,
      },
    }));
  };

  const handleRerun = async () => {
    if (!S.jobId) return;
    setError("");
    setIsRerunning(true);
    try {
      const authHeaders = await getAuthHeaders();
      const response = await fetch(`${API_BASE}/jobs/${S.jobId}/generate`, {
        method: "POST",
        headers: authHeaders,
      });
      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Failed to re-run generation.");
      }
      const data: GenerationResult = await response.json();
      S.generationResult = data;
      await refreshResultsAndStats();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to re-run generation.";
      setError(message);
    } finally {
      setIsRerunning(false);
    }
  };

  const approvedCount = stats?.approved ?? approvedResults.length;
  const pendingCount = stats?.pending ?? pendingResults.length;

  return (
    <div className="space-y-4">
      {isLoading && (
        <LFCard>
          <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>
            Loading results...
          </p>
        </LFCard>
      )}

      {error && (
        <p style={{ color: "var(--error-red)", fontSize: "12px" }}>{error}</p>
      )}

      {feedbackCount > 0 && (
        <div
          className="p-4 rounded-[6px] border flex items-center justify-between"
          style={{
            backgroundColor: "var(--card-header)",
            borderColor: "var(--border-color)",
          }}
        >
          <p style={{ fontSize: "13px", color: "var(--ink-dark)" }}>
            You have added {feedbackCount} new examples. Re-run generation to improve low confidence results.
          </p>
          <LFButton onClick={handleRerun} disabled={isRerunning}>
            {isRerunning ? "Re-running..." : "Re-run ?"}
          </LFButton>
        </div>
      )}

      {!isLoading && (
        <div className="grid grid-cols-2 gap-4">
          {/* Left Column: Auto Approved */}
          <div>
            <LFCard>
              <div className="mb-4 p-2 rounded-[6px]" style={{ backgroundColor: "#D4F1E3" }}>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "11px",
                    fontWeight: 600,
                    color: "var(--success-green)",
                  }}
                >
                  Auto Approved ({approvedCount})
                </span>
              </div>
              <div className="space-y-3 max-h-[500px] overflow-y-auto">
                {approvedResults.length === 0 && (
                  <div
                    className="p-3 rounded-[8px] text-center"
                    style={{ backgroundColor: "var(--card-header)", color: "var(--text-muted)", fontSize: "12px" }}
                  >
                    No auto-approved results yet.
                  </div>
                )}
                {approvedResults.map((item) => (
                  <div
                    key={item._id}
                    className="border rounded-[6px] p-3"
                    style={{ borderColor: "var(--border-color)" }}
                  >
                    <div className="space-y-2">
                      {Object.entries(item.pair || {}).map(([field, value]) => (
                        <div key={field} style={{ fontSize: "13px", lineHeight: "1.6" }}>
                          <span
                            style={{
                              fontFamily: "var(--font-mono)",
                              color: "var(--text-muted)",
                              marginRight: "6px",
                            }}
                          >
                            {field}:
                          </span>
                          <span>{value}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <LFBadge color={item.source === "feedback" ? "teal" : item.source === "human" ? "green" : "blue"}>
                        {item.source}
                      </LFBadge>
                      <div className="flex-1 ml-3">
                        <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: "#E5E7EB" }}>
                          <div
                            className="h-full"
                            style={{
                              width: `${Math.round(item.confidence * 100)}%`,
                              backgroundColor: "var(--success-green)",
                            }}
                          />
                        </div>
                        <span
                          className="mt-1 block text-right"
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: "10px",
                            color: "var(--text-muted)",
                          }}
                        >
                          {(item.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </LFCard>
          </div>

          {/* Right Column: Needs Review */}
          <div>
            <LFCard>
              <div className="mb-4 p-2 rounded-[6px]" style={{ backgroundColor: "#FFE5E5" }}>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "11px",
                    fontWeight: 600,
                    color: "var(--error-red)",
                  }}
                >
                  Needs Review ({pendingCount})
                </span>
              </div>
              <div className="space-y-3 max-h-[500px] overflow-y-auto">
                {pendingResults.length === 0 && (
                  <div
                    className="p-3 rounded-[8px] text-center"
                    style={{ backgroundColor: "var(--card-header)", color: "var(--text-muted)", fontSize: "12px" }}
                  >
                    No pending results.
                  </div>
                )}
                {pendingResults.map((item) => (
                  <div
                    key={item._id}
                    className="border rounded-[6px] p-3"
                    style={{ borderColor: "var(--border-color)" }}
                  >
                    <div className="space-y-3">
                      {Object.entries(item.pair || {}).map(([field, value]) => (
                        <div key={field} className="space-y-1">
                          <div
                            style={{
                              fontFamily: "var(--font-mono)",
                              fontSize: "11px",
                              color: "var(--text-muted)",
                            }}
                          >
                            {field}
                          </div>
                          <textarea
                            value={editedPairs[item._id]?.[field] ?? value}
                            onChange={(event) => handlePairChange(item._id, field, event.target.value)}
                            className="w-full rounded-[6px] border px-3 py-2"
                            style={{
                              borderColor: "var(--border-color)",
                              fontSize: "12px",
                              lineHeight: "1.6",
                              minHeight: "60px",
                              resize: "vertical",
                            }}
                          />
                        </div>
                      ))}
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: "#E5E7EB" }}>
                            <div
                              className="h-full"
                              style={{
                                width: `${Math.round(item.confidence * 100)}%`,
                                backgroundColor: "var(--error-red)",
                              }}
                            />
                          </div>
                          <span
                            className="mt-1 block text-right"
                            style={{
                              fontFamily: "var(--font-mono)",
                              fontSize: "10px",
                              color: "var(--text-muted)",
                            }}
                          >
                            {(item.confidence * 100).toFixed(0)}%
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <LFButton
                          onClick={() => handleApprove(item)}
                          disabled={approvingIds[item._id] || discardingIds[item._id] || addingExampleIds[item._id]}
                        >
                          {approvingIds[item._id] ? "Approving..." : "Approve"}
                        </LFButton>
                        <LFButton
                          variant="ghost"
                          onClick={() => handleDiscard(item)}
                          disabled={approvingIds[item._id] || discardingIds[item._id] || addingExampleIds[item._id]}
                        >
                          {discardingIds[item._id] ? "Discarding..." : "Discard"}
                        </LFButton>
                        <LFButton
                          variant="ghost"
                          onClick={() => handleAddExample(item)}
                          disabled={addedExampleIds[item._id] || addingExampleIds[item._id]}
                        >
                          {addingExampleIds[item._id] ? "Adding..." : "Add as Example"}
                        </LFButton>
                      </div>
                      {addedExampleIds[item._id] && (
                        <p style={{ fontSize: "11px", color: "var(--success-green)" }}>
                          Added to examples
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </LFCard>
          </div>
        </div>
      )}

      <div className="flex justify-end pt-4">
        <LFButton onClick={handleNext}>Export ?</LFButton>
      </div>
    </div>
  );
}
