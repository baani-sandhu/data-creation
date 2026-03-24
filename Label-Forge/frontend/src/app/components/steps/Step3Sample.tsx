import { useState } from "react";
import { useNavigate } from "react-router";
import { LFCard } from "../ui/LFCard";
import { LFButton } from "../ui/LFButton";
import { LFProgress } from "../ui/LFProgress";
import { LFBadge, LabelColor } from "../ui/LFBadge";

const mockLabels = [
  { name: "Training Data", color: "blue" as LabelColor },
  { name: "Model Performance", color: "green" as LabelColor },
  { name: "Annotation Process", color: "red" as LabelColor },
  { name: "Quality Control", color: "amber" as LabelColor },
];

const mockChunks = [
  { id: "chunk_001", text: "Machine learning models require high-quality labeled training data to achieve optimal performance. The labeling process transforms raw, unstructured documents into structured datasets." },
  { id: "chunk_002", text: "Data annotation is a critical step in the ML pipeline. Human annotators or automated systems classify, tag, or label data points according to predefined categories." },
  { id: "chunk_003", text: "Fine-tuning large language models (LLMs) on domain-specific data can significantly improve their performance on specialized tasks through curated training examples." },
  { id: "chunk_004", text: "Quality control in data labeling involves verifying accuracy, maintaining consistency across annotators, and resolving ambiguous cases through review processes." },
  { id: "chunk_005", text: "Active learning strategies can reduce labeling costs by intelligently selecting the most informative samples for human annotation." },
];

export function Step3Sample() {
  const navigate = useNavigate();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [labeledExamples, setLabeledExamples] = useState<Array<{ chunk: string; label: string; color: LabelColor }>>([]);

  const handleLabelClick = (label: { name: string; color: LabelColor }) => {
    setLabeledExamples([
      ...labeledExamples,
      { chunk: mockChunks[currentIndex].text, label: label.name, color: label.color },
    ]);
    
    if (currentIndex < mockChunks.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handleSkip = () => {
    if (currentIndex < mockChunks.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handleNext = () => {
    navigate("/generate");
  };

  const progress = ((labeledExamples.length) / mockChunks.length) * 100;
  const isComplete = labeledExamples.length >= 3; // Minimum 3 examples

  return (
    <div className="space-y-4">
      <LFCard>
        <div className="space-y-3">
          <LFProgress value={progress} />
          <div
            className="flex justify-between"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "13px",
              color: "var(--text-muted)",
            }}
          >
            <span>{labeledExamples.length} labeled</span>
            <span>{mockChunks.length - labeledExamples.length} remaining</span>
          </div>
        </div>
      </LFCard>

      {currentIndex < mockChunks.length && (
        <LFCard>
          <div className="space-y-4">
            <div
              className="p-4 rounded-[6px] border"
              style={{ borderColor: "var(--border-color)" }}
            >
              <p style={{ fontSize: "14px", lineHeight: "1.7" }}>
                {mockChunks[currentIndex].text}
              </p>
            </div>
            <div
              className="flex items-center justify-between gap-2 p-3 rounded-[6px]"
              style={{ backgroundColor: "var(--card-header)" }}
            >
              <div className="flex gap-2 flex-wrap">
                {mockLabels.map((label) => (
                  <button
                    key={label.name}
                    onClick={() => handleLabelClick(label)}
                    className="px-4 py-2 rounded-[6px] border transition-all hover:opacity-80"
                    style={{
                      backgroundColor: `var(--label-${label.color})`,
                      borderColor: `var(--label-${label.color}-border)`,
                      fontFamily: "var(--font-mono)",
                      fontSize: "12px",
                      fontWeight: 500,
                    }}
                  >
                    {label.name}
                  </button>
                ))}
              </div>
              <LFButton variant="ghost" onClick={handleSkip}>
                Skip →
              </LFButton>
            </div>
          </div>
        </LFCard>
      )}

      {labeledExamples.length > 0 && (
        <LFCard header="Labeled Examples">
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {labeledExamples.map((example, index) => (
              <div
                key={index}
                className="border rounded-[6px] p-3 flex items-start gap-3"
                style={{ borderColor: "var(--border-color)" }}
              >
                <LFBadge color={example.color}>{example.label}</LFBadge>
                <p
                  className="flex-1"
                  style={{
                    fontSize: "13px",
                    color: "var(--text-muted)",
                    lineHeight: "1.5",
                  }}
                >
                  {example.chunk.substring(0, 100)}...
                </p>
              </div>
            ))}
          </div>
        </LFCard>
      )}

      {isComplete && (
        <div className="flex justify-end pt-4">
          <LFButton onClick={handleNext}>Start LLM Generation →</LFButton>
        </div>
      )}
    </div>
  );
}
