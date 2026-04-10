import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { LFCard } from "../ui/LFCard";
import { LFButton } from "../ui/LFButton";
import { S, GenerationResult } from "../../state";
import { getIdToken } from "../../lib/auth";
import { API_BASE_URL } from "../../lib/api";

export function Step4LLMGeneration() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [sessionExpired, setSessionExpired] = useState(false);
  const [totalChunks, setTotalChunks] = useState(Math.max(1, Number(S.jobData?.total_chunks ?? 1)));
  const [simulatedChunk, setSimulatedChunk] = useState(1);
  const [generationResult, setGenerationResult] = useState<GenerationResult | null>(
    S.generationResult ?? null
  );

  const syncProgressFromJob = async (token: string, fallbackTotal: number) => {
    if (!S.jobId) return;
    try {
      const jobResponse = await fetch(`${API_BASE_URL}/jobs/${S.jobId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!jobResponse.ok) return;

      const jobData = await jobResponse.json();
      const backendTotal = Number(jobData?.total_chunks ?? jobData?.chunk_count ?? fallbackTotal);
      const normalizedTotal = Math.max(1, Math.floor(backendTotal || fallbackTotal || 1));
      const processed = Math.max(0, Math.floor(Number(jobData?.processed_chunks ?? 0)));
      const nextChunk = Math.min(normalizedTotal, Math.max(1, processed + 1));

      setTotalChunks(normalizedTotal);
      setSimulatedChunk(nextChunk);
    } catch {
      // Keep existing progress state if polling temporarily fails.
    }
  };

  const extractErrorMessage = async (response: Response) => {
    try {
      const data = await response.json();
      if (typeof data?.detail === "string") {
        return data.detail;
      }
    } catch {
      // Fall through to text parsing.
    }

    try {
      const text = await response.text();
      if (text) {
        return text;
      }
    } catch {
      // Ignore text parsing errors.
    }

    return "";
  };

  const runGeneration = async () => {
    setError("");
    if (!S.jobId) {
      setError("No job found. Please create a job first.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    let pollId: number | null = null;
    try {
      const token = await getIdToken();
      if (!token) {
        throw new Error("Please sign in to generate pairs.");
      }

      let resolvedTotal = Number(S.jobData?.total_chunks ?? 0);
      if (!Number.isFinite(resolvedTotal) || resolvedTotal <= 0) {
        const jobResponse = await fetch(`${API_BASE_URL}/jobs/${S.jobId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (jobResponse.ok) {
          const jobData = await jobResponse.json();
          resolvedTotal = Number(jobData?.chunk_count ?? 0);
          if (S.jobData) {
            S.jobData.total_chunks = resolvedTotal;
          }
        }
      }
      const normalizedTotal = Math.max(1, Math.floor(resolvedTotal || 1));
      setTotalChunks(normalizedTotal);
      setSimulatedChunk(1);
      await syncProgressFromJob(token, normalizedTotal);

      pollId = window.setInterval(() => {
        void syncProgressFromJob(token, normalizedTotal);
      }, 1000);

      const response = await fetch(`${API_BASE_URL}/jobs/${S.jobId}/generate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const message = await extractErrorMessage(response);
        throw new Error(message || "Failed to generate pairs.");
      }
      const data: GenerationResult = await response.json();
      S.generationResult = data;
      setGenerationResult(data);
      setSimulatedChunk(normalizedTotal);
      await new Promise((resolve) => window.setTimeout(resolve, 500));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to generate pairs.";
      setError(message);
    } finally {
      if (pollId !== null) {
        window.clearInterval(pollId);
      }
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!S.jobId) {
      setSessionExpired(true);
      setIsLoading(false);
      const timeoutId = window.setTimeout(() => {
        navigate("/");
      }, 1000);

      return () => window.clearTimeout(timeoutId);
    }

    runGeneration();
  }, [navigate]);

  if (sessionExpired) {
    return (
      <div className="space-y-4">
        <LFCard>
          <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>
            Session expired. Redirecting to your jobs...
          </p>
        </LFCard>
      </div>
    );
  }

  const handleNext = () => {
    navigate("/wizard/review");
  };

  const handleRetry = () => {
    if (isLoading) return;
    setError("");
    setGenerationResult(null);
    runGeneration();
  };

  return (
    <div className="space-y-4">
      {isLoading && (
        <LFCard>
          <div className="flex flex-col items-center justify-center gap-4 py-10">
            <svg width="36" height="36" viewBox="0 0 36 36" aria-label="Loading">
              <circle
                cx="18"
                cy="18"
                r="14"
                fill="none"
                stroke="var(--border-color)"
                strokeWidth="4"
                opacity="0.25"
              />
              <path
                d="M18 4a14 14 0 0 1 14 14"
                fill="none"
                stroke="var(--ink-dark)"
                strokeWidth="4"
                strokeLinecap="round"
              >
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  from="0 18 18"
                  to="360 18 18"
                  dur="1s"
                  repeatCount="indefinite"
                />
              </path>
            </svg>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "12px",
                color: "var(--text-muted)",
              }}
            >
              Processing chunk {Math.min(simulatedChunk, totalChunks)} of {totalChunks}...
            </div>
          </div>
        </LFCard>
      )}

      {!isLoading && !error && generationResult && (
        <>
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
                  TOTAL
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "32px",
                    fontWeight: 600,
                  }}
                >
                  {generationResult.total_pairs}
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
                  HIGH CONF
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "32px",
                    fontWeight: 600,
                    color: "var(--success-green)",
                  }}
                >
                  {generationResult.high_confidence}
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
                  LOW CONF
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "32px",
                    fontWeight: 600,
                    color: "var(--error-red)",
                  }}
                >
                  {generationResult.low_confidence}
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
                  THRESHOLD
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "32px",
                    fontWeight: 600,
                  }}
                >
                  {S.jobData?.confidence_threshold ?? "-"}
                </div>
              </div>
            </LFCard>
          </div>

          <div className="flex justify-end pt-4">
            <LFButton onClick={handleNext} disabled={isLoading}>
              Review Results
            </LFButton>
          </div>
        </>
      )}

      {!isLoading && error && (
        <div className="space-y-3">
          <p style={{ color: "var(--error-red)", fontSize: "12px" }}>{error}</p>
          <LFButton onClick={handleRetry} disabled={isLoading}>
            Retry
          </LFButton>
        </div>
      )}
    </div>
  );
}
