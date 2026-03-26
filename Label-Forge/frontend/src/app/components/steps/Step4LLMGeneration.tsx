import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { LFCard } from "../ui/LFCard";
import { LFButton } from "../ui/LFButton";
import { LFProgress } from "../ui/LFProgress";

const totalChunks = 12;

export function Step4LLMGeneration() {
  const navigate = useNavigate();
  const [progress, setProgress] = useState(0);
  const [currentChunk, setCurrentChunk] = useState(1);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    let isMounted = true;
    let chunk = 1;

    const tick = () => {
      if (!isMounted) return;

      const nextChunk = Math.min(chunk + 1, totalChunks);
      chunk = nextChunk;
      setCurrentChunk(nextChunk);
      setProgress((nextChunk / totalChunks) * 100);

      if (nextChunk >= totalChunks) {
        setIsComplete(true);
        return;
      }

      setTimeout(tick, 450);
    };

    setProgress((chunk / totalChunks) * 100);
    setTimeout(tick, 600);

    return () => {
      isMounted = false;
    };
  }, []);

  const handleNext = () => {
    navigate("/review");
  };

  return (
    <div className="space-y-4">
      {!isComplete && (
        <LFCard>
          <div className="flex flex-col items-center justify-center gap-4 py-6">
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "12px",
                color: "var(--text-muted)",
              }}
            >
              Extracting pairs from chunk {currentChunk} of {totalChunks}...
            </div>
            <div className="w-full max-w-[520px]">
              <LFProgress value={progress} />
            </div>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "12px",
                color: "var(--ink-dark)",
              }}
            >
              {Math.round(progress)}% complete
            </div>
          </div>
        </LFCard>
      )}

      {isComplete && (
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
                  48
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
                  41
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
                  7
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
                  0.85
                </div>
              </div>
            </LFCard>
          </div>

          <div className="flex justify-end pt-4">
            <LFButton onClick={handleNext}>Review Results →</LFButton>
          </div>
        </>
      )}
    </div>
  );
}
