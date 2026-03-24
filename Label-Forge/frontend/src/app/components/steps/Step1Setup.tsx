import { useState } from "react";
import { useNavigate } from "react-router";
import { LFCard } from "../ui/LFCard";
import { LFButton } from "../ui/LFButton";
import { LFInput } from "../ui/LFInput";
import { LFTextarea } from "../ui/LFTextarea";
import { LFSelect } from "../ui/LFSelect";
import { LFBadge, LabelColor } from "../ui/LFBadge";
import { Upload, FileText, Tag, Settings } from "lucide-react";

const labelColorOptions: LabelColor[] = ["blue", "green", "red", "amber", "purple", "teal", "indigo"];

export function Step1Setup() {
  const navigate = useNavigate();
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [taskDescription, setTaskDescription] = useState("");
  const [labelInput, setLabelInput] = useState("");
  const [labels, setLabels] = useState<Array<{ name: string; color: LabelColor }>>([]);
  const [exportFormat, setExportFormat] = useState("JSON");
  const [confidenceThreshold, setConfidenceThreshold] = useState("0.85");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setUploadedFile(e.target.files[0]);
    }
  };

  const handleAddLabel = () => {
    if (labelInput.trim() && labels.length < 7) {
      const color = labelColorOptions[labels.length];
      setLabels([...labels, { name: labelInput.trim(), color }]);
      setLabelInput("");
    }
  };

  const handleRemoveLabel = (index: number) => {
    setLabels(labels.filter((_, i) => i !== index));
  };

  const handleNext = () => {
    navigate("/extract");
  };

  return (
    <div className="space-y-5">
      {/* Card 1: File Upload */}
      <LFCard header="Document Upload" accent="#3B82F6">
        <div className="space-y-4">
          <label
            className="flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-10 cursor-pointer hover:border-[var(--primary-blue)] hover:bg-[var(--label-blue)]/30 transition-all group"
            style={{ borderColor: "var(--border-color)" }}
          >
            <input
              type="file"
              className="hidden"
              onChange={handleFileChange}
              accept=".pdf,.txt,.docx"
            />
            <div className="w-14 h-14 rounded-full bg-[var(--label-blue)] flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <Upload className="w-7 h-7" style={{ color: "var(--primary-blue)" }} />
            </div>
            <span style={{ color: "var(--ink-dark)", fontSize: "15px", fontWeight: 500 }}>
              Click to upload or drag and drop
            </span>
            <span style={{ color: "var(--text-muted)", fontSize: "13px" }}>
              PDF, TXT, DOCX (max 10MB)
            </span>
          </label>
          {uploadedFile && (
            <div className="flex items-center gap-3 p-3 bg-[var(--label-blue)] rounded-lg border" style={{ borderColor: "var(--label-blue-border)" }}>
              <FileText className="w-5 h-5" style={{ color: "var(--primary-blue)" }} />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <LFBadge color="blue">{uploadedFile.name.split(".").pop()?.toUpperCase()}</LFBadge>
                  <span style={{ fontSize: "14px", fontWeight: 500 }}>{uploadedFile.name}</span>
                </div>
                <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                  {(uploadedFile.size / 1024).toFixed(1)} KB
                </span>
              </div>
            </div>
          )}
        </div>
      </LFCard>

      {/* Card 2: Task Description */}
      <LFCard header="Labeling Task Description" accent="#8B5CF6">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-[var(--label-purple)] flex items-center justify-center flex-shrink-0">
            <FileText className="w-5 h-5" style={{ color: "var(--accent-purple)" }} />
          </div>
          <LFTextarea
            rows={4}
            placeholder="Describe what you want to extract and label from the documents..."
            value={taskDescription}
            onChange={(e) => setTaskDescription(e.target.value)}
          />
        </div>
      </LFCard>

      {/* Card 3: Label Classes */}
      <LFCard header="Label Class Builder" accent="#14B8A6">
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-[var(--label-teal)] flex items-center justify-center flex-shrink-0">
              <Tag className="w-5 h-5" style={{ color: "var(--accent-teal)" }} />
            </div>
            <div className="flex-1 space-y-3">
              <div className="flex gap-2">
                <LFInput
                  placeholder="Enter label name (e.g., 'Invoice Number', 'Date')"
                  value={labelInput}
                  onChange={(e) => setLabelInput(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleAddLabel()}
                />
                <LFButton onClick={handleAddLabel} disabled={!labelInput.trim() || labels.length >= 7}>
                  Add
                </LFButton>
              </div>
              {labels.length > 0 && (
                <div className="flex flex-wrap gap-2 p-3 bg-gray-50 rounded-lg border" style={{ borderColor: "var(--border-color)" }}>
                  {labels.map((label, index) => (
                    <LFBadge
                      key={index}
                      color={label.color}
                      onRemove={() => handleRemoveLabel(index)}
                    >
                      {label.name}
                    </LFBadge>
                  ))}
                </div>
              )}
              {labels.length === 0 && (
                <p style={{ color: "var(--text-muted)", fontSize: "13px" }}>
                  No labels added yet. Add up to 7 label classes.
                </p>
              )}
            </div>
          </div>
        </div>
      </LFCard>

      {/* Card 4: Configuration */}
      <LFCard header="Export Configuration" accent="#F59E0B">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-[var(--label-amber)] flex items-center justify-center flex-shrink-0">
            <Settings className="w-5 h-5" style={{ color: "var(--warning-amber)" }} />
          </div>
          <div className="flex-1 grid grid-cols-2 gap-4">
            <div>
              <label
                className="block mb-2"
                style={{ fontSize: "13px", color: "var(--text-secondary)", fontWeight: 500 }}
              >
                Export Format
              </label>
              <LFSelect value={exportFormat} onChange={(e) => setExportFormat(e.target.value)}>
                <option>JSON</option>
                <option>CSV</option>
                <option>JSONL</option>
              </LFSelect>
            </div>
            <div>
              <label
                className="block mb-2"
                style={{ fontSize: "13px", color: "var(--text-secondary)", fontWeight: 500 }}
              >
                Confidence Threshold
              </label>
              <LFSelect
                value={confidenceThreshold}
                onChange={(e) => setConfidenceThreshold(e.target.value)}
              >
                <option value="0.75">0.75 - Permissive</option>
                <option value="0.85">0.85 - Balanced</option>
                <option value="0.95">0.95 - Strict</option>
              </LFSelect>
            </div>
          </div>
        </div>
      </LFCard>

      {/* Action Button */}
      <div className="flex justify-end pt-4">
        <LFButton onClick={handleNext}>Extract & Chunk Document →</LFButton>
      </div>
    </div>
  );
}