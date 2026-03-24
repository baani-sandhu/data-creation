import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { LFCard } from "../ui/LFCard";
import { LFButton } from "../ui/LFButton";
import { LFProgress } from "../ui/LFProgress";

const mockChunks = [
  { id: "chunk_001", text: "Machine learning models require high-quality labeled training data to achieve optimal performance. The labeling process transforms raw, unstructured documents into structured datasets that can be used for supervised learning." },
  { id: "chunk_002", text: "Data annotation is a critical step in the ML pipeline. Human annotators or automated systems classify, tag, or label data points according to predefined categories or schemas." },
  { id: "chunk_003", text: "Fine-tuning large language models (LLMs) on domain-specific data can significantly improve their performance on specialized tasks. This requires curated training examples with accurate labels." },
  { id: "chunk_004", text: "Quality control in data labeling involves verifying accuracy, maintaining consistency across annotators, and resolving ambiguous cases through clear guidelines and review processes." },
  { id: "chunk_005", text: "Active learning strategies can reduce labeling costs by intelligently selecting the most informative samples for human annotation, allowing models to learn more efficiently from fewer labeled examples." },
];

export function Step2Extract() {
  const navigate = useNavigate();
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("Initializing extraction...");
  const [chunks, setChunks] = useState<typeof mockChunks>([]);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    // Simulate extraction process
    const stages = [
      { progress: 20, status: "Reading document structure...", delay: 500 },
      { progress: 40, status: "Extracting text content...", delay: 800 },
      { progress: 60, status: "Chunking by semantic boundaries...", delay: 1000 },
      { progress: 80, status: "Processing chunks...", delay: 700 },
      { progress: 100, status: "Extraction complete", delay: 500 },
    ];

    let currentStage = 0;

    const runStage = () => {
      if (currentStage < stages.length) {
        const stage = stages[currentStage];
        setProgress(stage.progress);
        setStatus(stage.status);
        
        if (stage.progress === 100) {
          setChunks(mockChunks);
          setIsComplete(true);
        }
        
        currentStage++;
        setTimeout(runStage, stage.delay);
      }
    };

    runStage();
  }, []);

  const handleNext = () => {
    navigate("/sample");
  };

  return (
    <div className="space-y-4">
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
          <div className="space-y-3 max-h-[500px] overflow-y-auto">
            {chunks.map((chunk) => (
              <div
                key={chunk.id}
                className="border rounded-[6px] p-3"
                style={{ borderColor: "var(--border-color)" }}
              >
                <div
                  className="mb-2"
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "10px",
                    color: "var(--text-muted)",
                  }}
                >
                  {chunk.id}
                </div>
                <p style={{ fontSize: "14px", lineHeight: "1.6" }}>{chunk.text}</p>
              </div>
            ))}
          </div>
        </LFCard>
      )}

      {isComplete && (
        <div className="flex justify-end pt-4">
          <LFButton onClick={handleNext}>Continue to Sample Labeling →</LFButton>
        </div>
      )}
    </div>
  );
}
