import { useState } from "react";
import { useNavigate } from "react-router";
import { LFCard } from "../ui/LFCard";
import { LFButton } from "../ui/LFButton";
import { LFInput } from "../ui/LFInput";
import { LFTextarea } from "../ui/LFTextarea";
import { LFSelect } from "../ui/LFSelect";
import { LFBadge, LabelColor } from "../ui/LFBadge";
import { Upload, FileText, Tag, Settings } from "lucide-react";
import { S } from "../../state";
import { getIdToken } from "../../lib/auth";

const labelColorOptions: LabelColor[] = ["blue", "green", "red", "amber", "purple", "teal", "indigo"];

export function Step1Setup() {
  const navigate = useNavigate();
  const [uploadedFiles, setUploadedFiles] = useState<File[]>(S.uploadedFiles);
  const [taskDescription, setTaskDescription] = useState("");
  const [labelInput, setLabelInput] = useState("");
  const [labels, setLabels] = useState<Array<{ name: string; color: LabelColor }>>([]);
  const [exportFormat, setExportFormat] = useState("JSON");
  const [confidenceThreshold, setConfidenceThreshold] = useState("0.85");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [isRefining, setIsRefining] = useState(false);
  const [refineError, setRefineError] = useState("");

  const API_BASE = "http://localhost:8001";

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextFiles = e.target.files ? Array.from(e.target.files) : [];
    if (!nextFiles.length) return;

    const existingNames = new Set(S.uploadedFiles.map((file) => file.name));
    const newFiles = nextFiles.filter((file) => !existingNames.has(file.name));
    const updated = [...S.uploadedFiles, ...newFiles];
    S.uploadedFiles = updated;
    setUploadedFiles(updated);
    e.target.value = "";
  };

  const handleRemoveFile = (name: string) => {
    const updated = S.uploadedFiles.filter((file) => file.name !== name);
    S.uploadedFiles = updated;
    setUploadedFiles(updated);
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

  const handleRefinePrompt = async () => {
    setRefineError("");
    if (!taskDescription.trim()) {
      setRefineError("Enter a prompt to refine.");
      return;
    }

    setIsRefining(true);
    try {
      const token = await getIdToken();
      if (!token) {
        throw new Error("Please sign in to refine prompts.");
      }
      const response = await fetch(`${API_BASE}/prompts/refine`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ prompt: taskDescription }),
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Failed to refine prompt.");
      }

      const data = await response.json();
      const refined = data?.refined_prompt?.toString() ?? "";
      if (!refined.trim()) {
        throw new Error("No refined prompt returned.");
      }

      setTaskDescription(refined.trim());
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to refine prompt.";
      setRefineError(message);
    } finally {
      setIsRefining(false);
    }
  };

  const handleNext = async () => {
    setError("");
    if (S.uploadedFiles.length === 0) {
      setError("Please upload at least one file.");
      return;
    }
    if (labels.length < 2) {
      setError("Please add at least two fields.");
      return;
    }
    if (!taskDescription.trim()) {
      setError("Please provide a task description.");
      return;
    }

    setIsSubmitting(true);
    try {
      const token = await getIdToken();
      if (!token) {
        throw new Error("Please sign in to create a job.");
      }
      const formData = new FormData();
      S.uploadedFiles.forEach((file) => {
        formData.append("files", file);
      });
      formData.append("fields", labels.map((label) => label.name).join(","));
      formData.append("task_prompt", taskDescription);
      formData.append("output_format", exportFormat.toLowerCase());
      formData.append("confidence_threshold", "0.75");

      const response = await fetch(`${API_BASE}/jobs/`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Failed to create job.");
      }

      const data = await response.json();
      S.jobId = data.job_id;
      S.jobData = data;
      S.chunks = [];
      S.currentChunkIndex = 0;
      S.userExamples = [];

      navigate("/wizard/extract");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unexpected error creating job.";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
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
              multiple
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
          {uploadedFiles.length > 0 && (
            <div className="space-y-2">
              {uploadedFiles.map((file) => (
                <div
                  key={file.name}
                  className="flex items-center gap-3 p-3 bg-[var(--label-blue)] rounded-lg border"
                  style={{ borderColor: "var(--label-blue-border)" }}
                >
                  <FileText className="w-5 h-5" style={{ color: "var(--primary-blue)" }} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <LFBadge color="blue">{file.name.split(".").pop()?.toUpperCase()}</LFBadge>
                      <span style={{ fontSize: "14px", fontWeight: 500 }}>{file.name}</span>
                    </div>
                    <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                      {(file.size / 1024).toFixed(1)} KB
                    </span>
                  </div>
                  <button
                    onClick={() => handleRemoveFile(file.name)}
                    className="hover:opacity-70 transition-opacity"
                    style={{ color: "var(--primary-blue)", fontSize: "14px" }}
                  >
                    ✕
                  </button>
                </div>
              ))}
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
          <div className="flex-1 space-y-2">
            <LFTextarea
              rows={4}
              placeholder="Describe what you want to extract and label from the documents..."
              value={taskDescription}
              onChange={(e) => setTaskDescription(e.target.value)}
            />
            <div className="flex items-center gap-2">
              <LFButton
                variant="ghost"
                onClick={handleRefinePrompt}
                disabled={isRefining}
              >
                {isRefining ? "Refining..." : "Refine with AI"}
              </LFButton>
              {refineError && (
                <span style={{ color: "var(--error-red)", fontSize: "12px" }}>
                  {refineError}
                </span>
              )}
            </div>
          </div>
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
        <LFButton onClick={handleNext} disabled={isSubmitting}>
          {isSubmitting ? "Creating Job..." : "Extract & Chunk Document →"}
        </LFButton>
      </div>
      {error && (
        <p style={{ color: "var(--error-red)", fontSize: "12px" }}>
          {error}
        </p>
      )}
    </div>
  );
}
