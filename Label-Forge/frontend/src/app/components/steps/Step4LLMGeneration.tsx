import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { LFCard } from "../ui/LFCard";
import { LFButton } from "../ui/LFButton";
import { LFProgress } from "../ui/LFProgress";

const mockPrompt = `You are a data labeling assistant. Given a text chunk, classify it into one of these categories:

Examples:
- "Machine learning models require high-quality labeled training data..." → Training Data
- "Data annotation is a critical step in the ML pipeline..." → Annotation Process
- "Fine-tuning large language models on domain-specific data..." → Model Performance

Classify the following text:`;

const mockLogs = [
  { time: "14:32:01", type: "info", message: "Initializing LLM connection..." },
  { time: "14:32:02", type: "info", message: "Loading few-shot examples..." },
  { time: "14:32:03", type: "info", message: "Processing chunk_001..." },
  { time: "14:32:04", type: "info", message: "Classified: Training Data (confidence: 0.92)" },
  { time: "14:32:05", type: "info", message: "Processing chunk_002..." },
  { time: "14:32:06", type: "info", message: "Classified: Annotation Process (confidence: 0.88)" },
  { time: "14:32:07", type: "warning", message: "Low confidence on chunk_003 (0.73)" },
  { time: "14:32:08", type: "info", message: "Processing chunk_004..." },
  { time: "14:32:09", type: "info", message: "Classified: Quality Control (confidence: 0.91)" },
  { time: "14:32:10", type: "info", message: "Processing chunk_005..." },
  { time: "14:32:11", type: "info", message: "Classified: Annotation Process (confidence: 0.87)" },
  { time: "14:32:12", type: "info", message: "Generation complete. 5 chunks processed." },
];

export function Step4LLMGeneration() {
  const navigate = useNavigate();
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<typeof mockLogs>([]);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    let currentLog = 0;
    let isMounted = true;

    const addLog = () => {
      if (!isMounted) return;
      
      if (currentLog < mockLogs.length) {
        const logToAdd = mockLogs[currentLog];
        if (logToAdd) {
          setLogs((prev) => [...prev, logToAdd]);
          setProgress(((currentLog + 1) / mockLogs.length) * 100);
          
          if (currentLog === mockLogs.length - 1) {
            setIsComplete(true);
          }
        }
        
        currentLog++;
        setTimeout(addLog, 400);
      }
    };

    setTimeout(addLog, 500);
    
    return () => {
      isMounted = false;
    };
  }, []);

  const handleNext = () => {
    navigate("/review");
  };

  const getLogColor = (type: string) => {
    switch (type) {
      case "info":
        return "#2DD4BF"; // teal
      case "warning":
        return "var(--warning-amber)";
      case "error":
        return "var(--error-red)";
      default:
        return "#2DD4BF";
    }
  };

  return (
    <div className="space-y-4">
      <LFCard header="Few-Shot Prompt Preview">
        <div
          className="p-4 rounded-[6px] max-h-[200px] overflow-y-auto"
          style={{ backgroundColor: "var(--ink-dark)" }}
        >
          <pre
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "12px",
              color: "#2DD4BF",
              lineHeight: "1.6",
              whiteSpace: "pre-wrap",
            }}
          >
            {mockPrompt}
          </pre>
        </div>
      </LFCard>

      <LFCard>
        <LFProgress value={progress} />
      </LFCard>

      <LFCard header="Generation Log">
        <div
          className="p-4 rounded-[6px] max-h-[300px] overflow-y-auto"
          style={{ backgroundColor: "var(--ink-dark)" }}
        >
          <div className="space-y-1">
            {logs.filter(log => log).map((log, index) => (
              <div
                key={index}
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "12px",
                  lineHeight: "1.5",
                }}
              >
                <span style={{ color: "#6B7280" }}>[{log.time}]</span>{" "}
                <span style={{ color: getLogColor(log.type) }}>{log.message}</span>
              </div>
            ))}
          </div>
        </div>
      </LFCard>

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
                  5
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
                  4
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
                  1
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