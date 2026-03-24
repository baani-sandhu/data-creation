import { useState } from "react";
import { LFCard } from "../ui/LFCard";
import { LFButton } from "../ui/LFButton";
import { Download } from "lucide-react";

const mockExportData = {
  json: `{
  "dataset": "ml_training_labels",
  "version": "1.0",
  "timestamp": "2026-03-24T14:32:12Z",
  "items": [
    {
      "id": "chunk_001",
      "text": "Machine learning models require high-quality labeled training data...",
      "label": "Training Data",
      "confidence": 0.92,
      "source": "auto"
    },
    {
      "id": "chunk_002",
      "text": "Data annotation is a critical step in the ML pipeline...",
      "label": "Annotation Process",
      "confidence": 0.88,
      "source": "auto"
    }
  ]
}`,
  csv: `id,text,label,confidence,source
chunk_001,"Machine learning models require...",Training Data,0.92,auto
chunk_002,"Data annotation is a critical step...",Annotation Process,0.88,auto
chunk_003,"Fine-tuning large language models...",Model Performance,0.95,human
chunk_004,"Quality control in data labeling...",Quality Control,0.91,auto`,
  jsonl: `{"id":"chunk_001","text":"Machine learning models...","label":"Training Data","confidence":0.92}
{"id":"chunk_002","text":"Data annotation is...","label":"Annotation Process","confidence":0.88}
{"id":"chunk_003","text":"Fine-tuning large...","label":"Model Performance","confidence":0.95}`,
};

export function Step6Export() {
  const [selectedFormat, setSelectedFormat] = useState<"json" | "csv" | "jsonl">("json");

  const handleDownload = (format: "json" | "csv" | "jsonl") => {
    // In a real app, this would trigger a file download
    console.log(`Downloading ${format.toUpperCase()} format`);
  };

  return (
    <div className="space-y-4">
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
              TOTAL LABELED
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
              AUTO-SAVED
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
              HUMAN-REVIEWED
            </div>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "32px",
                fontWeight: 600,
                color: "var(--primary-blue)",
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
              PENDING
            </div>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "32px",
                fontWeight: 600,
                color: "var(--text-muted)",
              }}
            >
              0
            </div>
          </div>
        </LFCard>
      </div>

      <LFCard header="Export Preview">
        <div className="mb-4 flex gap-2">
          <button
            onClick={() => setSelectedFormat("json")}
            className="px-3 py-1.5 rounded-[6px] border transition-colors"
            style={{
              backgroundColor: selectedFormat === "json" ? "var(--primary-blue)" : "transparent",
              borderColor: selectedFormat === "json" ? "var(--primary-blue)" : "var(--border-color)",
              color: selectedFormat === "json" ? "white" : "var(--ink-dark)",
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              fontWeight: 500,
            }}
          >
            JSON
          </button>
          <button
            onClick={() => setSelectedFormat("csv")}
            className="px-3 py-1.5 rounded-[6px] border transition-colors"
            style={{
              backgroundColor: selectedFormat === "csv" ? "var(--primary-blue)" : "transparent",
              borderColor: selectedFormat === "csv" ? "var(--primary-blue)" : "var(--border-color)",
              color: selectedFormat === "csv" ? "white" : "var(--ink-dark)",
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              fontWeight: 500,
            }}
          >
            CSV
          </button>
          <button
            onClick={() => setSelectedFormat("jsonl")}
            className="px-3 py-1.5 rounded-[6px] border transition-colors"
            style={{
              backgroundColor: selectedFormat === "jsonl" ? "var(--primary-blue)" : "transparent",
              borderColor: selectedFormat === "jsonl" ? "var(--primary-blue)" : "var(--border-color)",
              color: selectedFormat === "jsonl" ? "white" : "var(--ink-dark)",
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              fontWeight: 500,
            }}
          >
            JSONL
          </button>
        </div>
        <div
          className="p-4 rounded-[6px] max-h-[400px] overflow-auto"
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
            {mockExportData[selectedFormat]}
          </pre>
        </div>
      </LFCard>

      <div className="flex gap-3 justify-end pt-4">
        <LFButton
          variant="secondary"
          onClick={() => handleDownload("csv")}
          className="flex items-center gap-2"
        >
          <Download className="w-4 h-4" />
          Download CSV
        </LFButton>
        <LFButton
          variant="secondary"
          onClick={() => handleDownload("jsonl")}
          className="flex items-center gap-2"
          style={{
            backgroundColor: "#E3EFFF",
            borderColor: "var(--primary-blue)",
            color: "var(--primary-blue)",
          }}
        >
          <Download className="w-4 h-4" />
          Download JSONL
        </LFButton>
        <LFButton
          onClick={() => handleDownload("json")}
          className="flex items-center gap-2"
        >
          <Download className="w-4 h-4" />
          Download JSON
        </LFButton>
      </div>
    </div>
  );
}
