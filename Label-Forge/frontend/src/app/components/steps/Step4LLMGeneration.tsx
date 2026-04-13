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

  const runGeneration = async () => {
    console.log("runGeneration called");
    setError("");
    if (!S.jobId) {
      setError("No job found. Please create a job first.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const token = await getIdToken();
      if (!token) {
        throw new Error("Please sign in to generate pairs.");
      }

      const normalizedTotal = Math.max(1, Math.floor(Number(S.jobData?.total_chunks ?? 1) || 1));
      setTotalChunks(normalizedTotal);
      setSimulatedChunk(1);
      const generateUrl = `${API_BASE_URL}/jobs/${S.jobId}/generate`;
      console.log("Calling generate:", generateUrl);
      const response = await fetch(generateUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      let data: unknown = null;
      try {
        data = await response.json();
      } catch {
        data = null;
      }
      console.log("Generate response:", response.status, data);
      if (!response.ok) {
        const detail =
          typeof data === "object" &&
          data !== null &&
          "detail" in data &&
          typeof (data as { detail?: unknown }).detail === "string"
            ? (data as { detail: string }).detail
            : "";
        throw new Error(detail || "Failed to generate pairs.");
      }
      const result = data as GenerationResult;
      S.generationResult = result;
      setGenerationResult(result);
      setSimulatedChunk(normalizedTotal);
      await new Promise((resolve) => window.setTimeout(resolve, 500));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to generate pairs.";
      setError(message);
    } finally {
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
    <div data-testid="step4-generation" className="space-y-4">
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
          <div data-testid="generation-complete" className="grid grid-cols-4 gap-4">
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
                  data-testid="total-pairs-stat"
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
            <LFButton data-testid="review-button" onClick={handleNext} disabled={isLoading}>
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
