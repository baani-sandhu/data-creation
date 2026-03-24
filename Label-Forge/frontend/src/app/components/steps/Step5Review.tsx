import { useState } from "react";
import { useNavigate } from "react-router";
import { LFCard } from "../ui/LFCard";
import { LFButton } from "../ui/LFButton";
import { LFBadge, LabelColor } from "../ui/LFBadge";
import { AlertCircle } from "lucide-react";

interface LabeledItem {
  id: string;
  text: string;
  label: string;
  labelColor: LabelColor;
  confidence: number;
  reasoning?: string;
}

const mockAutoSaved: LabeledItem[] = [
  {
    id: "chunk_001",
    text: "Machine learning models require high-quality labeled training data to achieve optimal performance.",
    label: "Training Data",
    labelColor: "blue",
    confidence: 0.92,
  },
  {
    id: "chunk_002",
    text: "Data annotation is a critical step in the ML pipeline. Human annotators classify and tag data points.",
    label: "Annotation Process",
    labelColor: "red",
    confidence: 0.88,
  },
  {
    id: "chunk_004",
    text: "Quality control in data labeling involves verifying accuracy and maintaining consistency.",
    label: "Quality Control",
    labelColor: "amber",
    confidence: 0.91,
  },
  {
    id: "chunk_005",
    text: "Active learning strategies can reduce labeling costs by selecting the most informative samples.",
    label: "Annotation Process",
    labelColor: "red",
    confidence: 0.87,
  },
];

const mockReviewRequired: LabeledItem[] = [
  {
    id: "chunk_003",
    text: "Fine-tuning large language models on domain-specific data can significantly improve their performance.",
    label: "Model Performance",
    labelColor: "green",
    confidence: 0.73,
    reasoning: "Ambiguous between Model Performance and Training Data",
  },
];

const mockLabels = [
  { name: "Training Data", color: "blue" as LabelColor },
  { name: "Model Performance", color: "green" as LabelColor },
  { name: "Annotation Process", color: "red" as LabelColor },
  { name: "Quality Control", color: "amber" as LabelColor },
];

export function Step5Review() {
  const navigate = useNavigate();
  const [reviewItems, setReviewItems] = useState<LabeledItem[]>(mockReviewRequired);
  const [showFeedback, setShowFeedback] = useState(true);

  const handleRelabel = (itemId: string, newLabel: { name: string; color: LabelColor }) => {
    setReviewItems(
      reviewItems.map((item) =>
        item.id === itemId
          ? { ...item, label: newLabel.name, labelColor: newLabel.color, confidence: 0.95 }
          : item
      )
    );
  };

  const handleNext = () => {
    navigate("/export");
  };

  return (
    <div className="space-y-4">
      {showFeedback && (
        <div
          className="p-4 rounded-[6px] border flex items-start gap-3"
          style={{
            backgroundColor: "#FFF4E6",
            borderColor: "var(--warning-amber)",
          }}
        >
          <AlertCircle className="w-5 h-5 mt-0.5" style={{ color: "var(--warning-amber)" }} />
          <div className="flex-1">
            <p style={{ fontSize: "14px", lineHeight: "1.6" }}>
              <strong>1 item below threshold.</strong> Review and relabel if needed, or add as training
              example and re-run generation for improved accuracy.
            </p>
          </div>
          <button
            onClick={() => setShowFeedback(false)}
            style={{ color: "var(--text-muted)" }}
          >
            ✕
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        {/* Left Panel: Auto-Saved */}
        <div>
          <LFCard>
            <div
              className="mb-4 p-2 rounded-[6px]"
              style={{ backgroundColor: "#D4F1E3" }}
            >
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "var(--success-green)",
                }}
              >
                AUTO-SAVED ({mockAutoSaved.length})
              </span>
            </div>
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {mockAutoSaved.map((item) => (
                <div
                  key={item.id}
                  className="border rounded-[6px] p-3"
                  style={{ borderColor: "var(--border-color)" }}
                >
                  <p
                    className="mb-3"
                    style={{ fontSize: "13px", lineHeight: "1.6" }}
                  >
                    {item.text}
                  </p>
                  <div className="flex items-center justify-between">
                    <LFBadge color={item.labelColor}>{item.label}</LFBadge>
                    <div className="flex-1 ml-3">
                      <div
                        className="h-1 rounded-full overflow-hidden"
                        style={{ backgroundColor: "#E5E7EB" }}
                      >
                        <div
                          className="h-full"
                          style={{
                            width: `${item.confidence * 100}%`,
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

        {/* Right Panel: Human Review Required */}
        <div>
          <LFCard>
            <div
              className="mb-4 p-2 rounded-[6px]"
              style={{ backgroundColor: "#FFE5E5" }}
            >
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "var(--error-red)",
                }}
              >
                HUMAN REVIEW REQUIRED ({reviewItems.length})
              </span>
            </div>
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {reviewItems.map((item) => (
                <div
                  key={item.id}
                  className="border rounded-[6px] p-3"
                  style={{ borderColor: "var(--border-color)" }}
                >
                  <p
                    className="mb-3"
                    style={{ fontSize: "13px", lineHeight: "1.6" }}
                  >
                    {item.text}
                  </p>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <LFBadge color={item.labelColor}>{item.label}</LFBadge>
                      <div className="flex-1 ml-3">
                        <div
                          className="h-1 rounded-full overflow-hidden"
                          style={{ backgroundColor: "#E5E7EB" }}
                        >
                          <div
                            className="h-full"
                            style={{
                              width: `${item.confidence * 100}%`,
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
                    {item.reasoning && (
                      <p
                        className="italic"
                        style={{
                          fontSize: "11px",
                          color: "var(--text-muted)",
                          lineHeight: "1.5",
                        }}
                      >
                        {item.reasoning}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {mockLabels.map((label) => (
                        <button
                          key={label.name}
                          onClick={() => handleRelabel(item.id, label)}
                          className="px-3 py-1.5 rounded-[6px] border text-xs transition-all hover:opacity-80"
                          style={{
                            backgroundColor: `var(--label-${label.color})`,
                            borderColor: `var(--label-${label.color}-border)`,
                            fontFamily: "var(--font-mono)",
                            fontSize: "11px",
                            fontWeight: 500,
                          }}
                        >
                          {label.name}
                        </button>
                      ))}
                    </div>
                    <LFButton variant="ghost" className="w-full text-xs">
                      + add as example
                    </LFButton>
                  </div>
                </div>
              ))}
            </div>
          </LFCard>
        </div>
      </div>

      <div className="flex justify-end pt-4">
        <LFButton onClick={handleNext}>Proceed to Export →</LFButton>
      </div>
    </div>
  );
}
