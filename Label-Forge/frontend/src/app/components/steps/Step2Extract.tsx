import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { LFCard } from "../ui/LFCard";
import { LFButton } from "../ui/LFButton";
import { LFProgress } from "../ui/LFProgress";
import { S, ChunkData } from "../../state";
import { getIdToken } from "../../lib/auth";
import { API_BASE_URL } from "../../lib/api";

export function Step2Extract() {
  const navigate = useNavigate();
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("Initializing extraction...");
  const [chunks, setChunks] = useState<ChunkData[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isContinuing, setIsContinuing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchChunks = async () => {
      setError("");
      if (!S.jobId) {
        setStatus("No job found. Please create a job first.");
        return;
      }

      setIsLoading(true);
      setStatus("Fetching chunks from the backend...");
      setProgress(40);

      try {
        const token = await getIdToken();
        if (!token) {
          throw new Error("Please sign in to fetch chunks.");
        }
        const response = await fetch(`${API_BASE_URL}/jobs/${S.jobId}/chunks?limit=50`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) {
          const message = await response.text();
          throw new Error(message || "Failed to load chunks.");
        }
        const data = await response.json();
        S.chunks = data.chunks || [];
        setChunks(S.chunks);
        setProgress(100);
        setStatus("Extraction complete");
        setIsComplete(true);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unexpected error fetching chunks.";
        setError(message);
        setStatus("Failed to fetch chunks.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchChunks();
  }, []);

  const handleNext = async () => {
    setIsContinuing(true);
    try {
      navigate("/wizard/sample");
    } catch {
      setError("Unable to proceed to sampling.");
    } finally {
      setIsContinuing(false);
    }
  };

  return (
    <div data-testid="step2-extract" className="space-y-4">
      <LFCard>
        <div className="space-y-4">
          <LFProgress value={progress} />
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "13px",
              color: "var(--text-muted)",
            }}
          >
            {status}
          </p>
        </div>
      </LFCard>

      {chunks.length > 0 && (
        <LFCard header={`Extracted Chunks (${chunks.length})`}>
          <div data-testid="chunk-list" className="space-y-3 max-h-[500px] overflow-y-auto">
            {chunks.map((chunk) => (
              <div
                key={chunk._id}
                className="border rounded-[6px] p-3"
                style={{ borderColor: "var(--border-color)" }}
              >
                <div
                  className="mb-2 flex items-center justify-between"
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "10px",
                    color: "var(--text-muted)",
                  }}
                >
                  <span>
                    Chunk {chunk.chunk_index + 1} � {chunk.source_filename}
                  </span>
                  <span>{chunk.word_count} words</span>
                </div>
                <p style={{ fontSize: "14px", lineHeight: "1.6" }}>
                  {chunk.text.length > 160 ? `${chunk.text.slice(0, 160)}...` : chunk.text}
                </p>
              </div>
            ))}
          </div>
        </LFCard>
      )}

      {isComplete && (
        <div className="flex justify-end pt-4">
          <LFButton data-testid="start-annotating-button" onClick={handleNext} disabled={isContinuing}>
            {isContinuing ? "Opening Sample Labeling..." : "Continue to Sample Labeling →"}
          </LFButton>
        </div>
      )}
      {isLoading && (
        <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>
          Loading chunks...
        </p>
      )}
      {error && (
        <p style={{ color: "var(--error-red)", fontSize: "12px" }}>
          {error}
        </p>
      )}
    </div>
  );
}
