import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Sparkles } from "lucide-react";
import { LFCard } from "../ui/LFCard";
import { LFButton } from "../ui/LFButton";
import { S, GenerationResult, persistState } from "../../state";
import { getIdToken } from "../../lib/auth";
import { API_BASE_URL } from "../../lib/api";

const LOADING_MESSAGES = [
  "Reading through your documents...",
  "Identifying extractable patterns...",
  "Generating structured training pairs...",
  "Scoring confidence for each pair...",
  "Almost there...",
];

export function Step4LLMGeneration() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [sessionExpired, setSessionExpired] = useState(false);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const [loadingProgress, setLoadingProgress] = useState(0);
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
    setLoadingProgress(0);
    setLoadingMessageIndex(0);
    try {
      const token = await getIdToken();
      if (!token) {
        throw new Error("Please sign in to generate pairs.");
      }
      const headers = { Authorization: `Bearer ${token}` };

      const POLL_INTERVAL_MS = 1500;
      const POLL_TIMEOUT_MS = 900000;
      const startedAt = Date.now();

      while (Date.now() - startedAt < POLL_TIMEOUT_MS) {
        const jobResponse = await fetch(`${API_BASE_URL}/jobs/${S.jobId}`, {
          headers,
        });
        if (!jobResponse.ok) {
          const detail = await jobResponse.text();
          throw new Error(detail || "Failed to fetch job status.");
        }

        const jobData = await jobResponse.json();
        const status = String(jobData?.status || "");
        console.log("Step4 status poll:", status);

        if (status === "failed") {
          throw new Error(
            typeof jobData?.error === "string" && jobData.error.trim()
              ? jobData.error
              : "Failed to generate pairs."
          );
        }

        if (status === "review" || status === "done") {
          const statsResponse = await fetch(`${API_BASE_URL}/jobs/${S.jobId}/results/stats`, {
            headers,
          });
          if (!statsResponse.ok) {
            const detail = await statsResponse.text();
            throw new Error(detail || "Failed to load generation stats.");
          }
          const statsData = await statsResponse.json();
          const result: GenerationResult = {
            job_id: S.jobId,
            status,
            total_pairs: Number(statsData?.total || 0),
            high_confidence: Number(statsData?.approved || 0),
            low_confidence: Number(statsData?.pending || 0),
            chunks_processed: Number(jobData?.processed_chunks || 0),
            errors: Array.isArray(jobData?.errors) ? jobData.errors : null,
          };
          S.generationResult = result;
          persistState();
          setGenerationResult(result);
          await new Promise((resolve) => window.setTimeout(resolve, 500));
          return;
        }

        await new Promise((resolve) => window.setTimeout(resolve, POLL_INTERVAL_MS));
      }

      throw new Error("Generation timed out. Please retry.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to generate pairs.";
      setError(message);
    } finally {
      setLoadingProgress(100);
      await new Promise((resolve) => window.setTimeout(resolve, 250));
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

  useEffect(() => {
    if (!isLoading) return;

    const intervalId = window.setInterval(() => {
      setLoadingMessageIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
    }, 3000);

    return () => window.clearInterval(intervalId);
  }, [isLoading]);

  useEffect(() => {
    if (!isLoading) return;

    setLoadingProgress(0);
    const timeoutId = window.setTimeout(() => {
      setLoadingProgress(90);
    }, 80);

    return () => window.clearTimeout(timeoutId);
  }, [isLoading]);

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
    S.generationResult = null;
    persistState();
    setGenerationResult(null);
    runGeneration();
  };

  return (
    <div data-testid="step4-generation" className="space-y-4">
      {isLoading && (
        <LFCard>
          <div className="relative mx-auto flex w-full max-w-xl flex-col items-center justify-center gap-4 overflow-hidden px-6 py-10 text-center">
            <div className="relative flex h-28 w-28 items-center justify-center">
              <div
                className="absolute inset-0 animate-spin rounded-full border-4"
                style={{ borderColor: "var(--border-color)", borderTopColor: "var(--ink-dark)" }}
              />
              <div
                className="absolute inset-2 animate-ping rounded-full border opacity-40"
                style={{ borderColor: "var(--ink-light)" }}
              />
              <div className="relative z-10 rounded-full p-4 shadow-sm" style={{ background: "var(--card-bg)" }}>
                <Sparkles
                  className="h-8 w-8 animate-pulse"
                  style={{ color: "var(--ink-dark)" }}
                  aria-hidden="true"
                />
              </div>
            </div>
            <h3 style={{ fontSize: "18px", fontWeight: 500 }}>Extracting Training Pairs</h3>
            <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>
              {LOADING_MESSAGES[loadingMessageIndex]}
            </p>
            <div
              className="absolute bottom-0 left-0 h-[2px] w-full"
              style={{ background: "var(--border-color)" }}
            >
              <div
                className="h-full"
                style={{
                  background: "var(--ink-dark)",
                  width: `${loadingProgress}%`,
                  transition:
                    loadingProgress >= 100 ? "width 200ms ease-out" : "width 30000ms linear",
                }}
              />
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
