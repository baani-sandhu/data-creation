import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { LFCard } from "../ui/LFCard";
import { LFButton } from "../ui/LFButton";
import { LFInput } from "../ui/LFInput";
import { LFTextarea } from "../ui/LFTextarea";
import { LFSelect } from "../ui/LFSelect";
import { LFBadge, LabelColor } from "../ui/LFBadge";
import { Upload, FileText, Tag, Settings } from "lucide-react";
import { S, persistState } from "../../state";
import { getIdToken } from "../../lib/auth";
import { API_BASE_URL } from "../../lib/api";

const labelColorOptions: LabelColor[] = ["blue", "green", "red", "amber", "purple", "teal", "indigo"];

interface DocumentItem {
  _id: string;
  original_filename: string;
  file_type: string;
  chunk_count: number;
  created_at: string;
  file_path: string;
}

type SourceMode = "upload" | "saved" | "both";
type SavedDocSelection = Pick<DocumentItem, "_id" | "original_filename" | "file_path">;

export function Step1Setup() {
  const navigate = useNavigate();
  const [uploadedFiles, setUploadedFiles] = useState<File[]>(S.uploadedFiles);
  const [taskDescription, setTaskDescription] = useState("");
  const [labelInput, setLabelInput] = useState("");
  const [labels, setLabels] = useState<Array<{ name: string; color: LabelColor }>>([]);
  const [exportFormat, setExportFormat] = useState("CSV");
  const [confidenceThreshold, setConfidenceThreshold] = useState("0.85");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [isRefining, setIsRefining] = useState(false);
  const [refineError, setRefineError] = useState("");
  const [sourceMode, setSourceMode] = useState<SourceMode>("upload");
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [selectedSavedDocs, setSelectedSavedDocs] = useState<SavedDocSelection[]>([]);
  const [documentsError, setDocumentsError] = useState("");
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);
  const [documentsLoaded, setDocumentsLoaded] = useState(false);

  useEffect(() => {
    if (sourceMode !== "saved" && sourceMode !== "both") return;
    if (documentsLoaded || isLoadingDocuments) return;

    const fetchDocuments = async () => {
      setIsLoadingDocuments(true);
      setDocumentsError("");
      try {
        const token = await getIdToken();
        if (!token) {
          setDocumentsError("Please sign in to view saved documents.");
          return;
        }

        const response = await fetch(`${API_BASE_URL}/documents/`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) {
          throw new Error("Failed to load saved documents.");
        }

        const data = await response.json();
        setDocuments(data.documents || []);
        setDocumentsLoaded(true);
      } catch {
        setDocumentsError("Could not load saved documents right now.");
      } finally {
        setIsLoadingDocuments(false);
      }
    };

    fetchDocuments();
  }, [documentsLoaded, isLoadingDocuments, sourceMode]);

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

  const handleToggleSavedDoc = (document: DocumentItem) => {
    setSelectedSavedDocs((prev) => {
      const exists = prev.some((item) => item._id === document._id);
      const nextSelection = exists
        ? prev.filter((item) => item._id !== document._id)
        : [
        ...prev,
        {
          _id: document._id,
          original_filename: document.original_filename,
          file_path: document.file_path,
        },
      ];
      S.selectedDocumentId = nextSelection.length > 0 ? nextSelection[0]._id : null;
      persistState();
      return nextSelection;
    });
  };

  const handleRemoveSavedDoc = (documentId: string) => {
    setSelectedSavedDocs((prev) => {
      const nextSelection = prev.filter((item) => item._id !== documentId);
      S.selectedDocumentId = nextSelection.length > 0 ? nextSelection[0]._id : null;
      persistState();
      return nextSelection;
    });
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
      const response = await fetch(`${API_BASE_URL}/prompts/refine`, {
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
    const includesUpload = sourceMode === "upload" || sourceMode === "both";
    const includesSaved = sourceMode === "saved" || sourceMode === "both";

    if (sourceMode === "upload" && S.uploadedFiles.length === 0) {
      setError("Please upload at least one file.");
      return;
    }
    if (sourceMode === "saved" && selectedSavedDocs.length === 0) {
      setError("Please select at least one saved document.");
      return;
    }
    if (sourceMode === "both" && S.uploadedFiles.length === 0 && selectedSavedDocs.length === 0) {
      setError("Please upload at least one file or select at least one saved document.");
      return;
    }

    const effectiveLabels = labels.length === 0
      ? [
          { name: "question", color: labelColorOptions[0] },
          { name: "answer", color: labelColorOptions[1] },
        ]
      : labels;

    if (effectiveLabels.length < 2) {
      setError("Please add at least two fields.");
      return;
    }
    if (!taskDescription.trim()) {
      setError("Please provide a task description.");
      return;
    }

    setIsSubmitting(true);
    setLabels(effectiveLabels);
    try {
      const token = await getIdToken();
      if (!token) {
        throw new Error("Please sign in to create a job.");
      }

      const threshold = parseFloat(confidenceThreshold);
      const formData = new FormData();

      if (includesUpload) {
        S.uploadedFiles.forEach((file) => {
          formData.append("files", file);
        });
      }

      if (includesSaved) {
        for (const document of selectedSavedDocs) {
          const docResponse = await fetch(`${API_BASE_URL}/documents/${document._id}/file`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!docResponse.ok) {
            throw new Error(`Failed to load saved document: ${document.original_filename}`);
          }

          const blob = await docResponse.blob();
          const file = new File([blob], document.original_filename, { type: blob.type || "application/octet-stream" });
          formData.append("files", file);
        }
      }

      formData.append("fields", effectiveLabels.map((label) => label.name).join(","));
      formData.append("task_prompt", taskDescription);
      formData.append("output_format", exportFormat.toLowerCase());
      formData.append("confidence_threshold", String(Number.isNaN(threshold) ? 0.75 : threshold));

      const response = await fetch(`${API_BASE_URL}/jobs/`, {
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
      S.selectedDocumentId = null;
      persistState();

      navigate("/wizard/extract");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unexpected error creating job.";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div data-testid="step1-setup" className="space-y-5">
      <LFCard header="Document Upload" accent="#3B82F6">
        <div className="space-y-4">
          <div
            className="inline-flex rounded-lg border p-1"
            style={{ borderColor: "var(--border-color)", backgroundColor: "var(--card-bg)" }}
          >
            <button
              data-testid="tab-upload-new"
              onClick={() => setSourceMode("upload")}
              className="px-3 py-1.5 rounded-md text-sm transition-colors"
              style={{
                backgroundColor: sourceMode === "upload" ? "var(--label-blue)" : "transparent",
                color: "var(--ink-dark)",
                fontWeight: sourceMode === "upload" ? 600 : 500,
              }}
            >
              Upload New
            </button>
            <button
              data-testid="tab-saved-documents"
              onClick={() => setSourceMode("saved")}
              className="px-3 py-1.5 rounded-md text-sm transition-colors"
              style={{
                backgroundColor: sourceMode === "saved" ? "var(--label-blue)" : "transparent",
                color: "var(--ink-dark)",
                fontWeight: sourceMode === "saved" ? 600 : 500,
              }}
            >
              Saved Documents
            </button>
            <button
              data-testid="tab-both"
              onClick={() => setSourceMode("both")}
              className="px-3 py-1.5 rounded-md text-sm transition-colors"
              style={{
                backgroundColor: sourceMode === "both" ? "var(--label-blue)" : "transparent",
                color: "var(--ink-dark)",
                fontWeight: sourceMode === "both" ? 600 : 500,
              }}
            >
              Both
            </button>
          </div>

          {(sourceMode === "saved" || sourceMode === "both") && (
            <div data-testid="saved-docs-list" className="space-y-3">
              <p style={{ color: "var(--text-muted)", fontSize: "12px", fontWeight: 500 }}>
                Select one or more saved documents
              </p>
              {documentsError && (
                <p style={{ color: "var(--text-muted)", fontSize: "12px" }}>
                  {documentsError}
                </p>
              )}
              {isLoadingDocuments && (
                <p style={{ color: "var(--text-muted)", fontSize: "12px" }}>
                  Loading saved documents...
                </p>
              )}
              {!isLoadingDocuments && documents.length === 0 && (
                <p style={{ color: "var(--text-muted)", fontSize: "13px" }}>
                  No saved documents found.
                </p>
              )}
              {!isLoadingDocuments && documents.length > 0 && (
                <div className="space-y-2">
                  {documents.map((document) => {
                    const isChecked = selectedSavedDocs.some((item) => item._id === document._id);
                    return (
                      <label
                        key={document._id}
                        className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-white cursor-pointer"
                        style={{ borderColor: isChecked ? "var(--primary-blue)" : "var(--border-color)" }}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleSavedDoc(document)}
                          />
                          <span className="truncate" title={document.original_filename} style={{ fontSize: "14px", color: "var(--ink-dark)" }}>
                            {document.original_filename}
                          </span>
                        </div>
                        <LFBadge color="blue">{document.file_type.toUpperCase()}</LFBadge>
                      </label>
                    );
                  })}
                </div>
              )}
              {selectedSavedDocs.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {selectedSavedDocs.map((document) => (
                    <div
                      key={document._id}
                      className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-full border"
                      style={{ borderColor: "var(--label-blue-border)", backgroundColor: "var(--label-blue)" }}
                    >
                      <span style={{ fontSize: "12px", color: "var(--ink-dark)" }}>
                        {document.original_filename}
                      </span>
                      <button
                        onClick={() => handleRemoveSavedDoc(document._id)}
                        style={{ fontSize: "12px", color: "var(--primary-blue)" }}
                      >
                        X
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {(sourceMode === "upload" || sourceMode === "both") && (
            <div data-testid="upload-section">
              <label
                className="flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-10 cursor-pointer hover:border-[var(--primary-blue)] hover:bg-[var(--label-blue)]/30 transition-all group"
                style={{ borderColor: "var(--border-color)" }}
              >
                <input
                  type="file"
                  className="hidden"
                  onChange={handleFileChange}
                  accept=".pdf,.txt,.md,.csv,.pptx,.docx,.xlsx,.xls"
                  multiple
                />
                <div className="w-14 h-14 rounded-full bg-[var(--label-blue)] flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <Upload className="w-7 h-7" style={{ color: "var(--primary-blue)" }} />
                </div>
                <span style={{ color: "var(--ink-dark)", fontSize: "15px", fontWeight: 500 }}>
                  Click to upload or drag and drop
                </span>
                <span style={{ color: "var(--text-muted)", fontSize: "13px" }}>
                  PDF, TXT, MD, CSV, DOCX, PPTX, XLSX, XLS
                </span>
              </label>
              {uploadedFiles.length > 0 && (
                <div data-testid="file-list" className="space-y-2">
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
                        X
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </LFCard>

      <LFCard data-testid="task-prompt-section" header="Labeling Task Description" accent="#8B5CF6">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-[var(--label-purple)] flex items-center justify-center flex-shrink-0">
            <FileText className="w-5 h-5" style={{ color: "var(--accent-purple)" }} />
          </div>
          <div className="flex-1 space-y-2">
            <LFTextarea
              data-testid="task-prompt-input"
              rows={4}
              placeholder="Describe what you want to extract and label from the documents..."
              value={taskDescription}
              onChange={(e) => setTaskDescription(e.target.value)}
            />
            <div className="flex items-center gap-2">
              <LFButton
                data-testid="refine-prompt-button"
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

      <LFCard data-testid="fields-section" header="Label Class Builder" accent="#14B8A6">
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-[var(--label-teal)] flex items-center justify-center flex-shrink-0">
              <Tag className="w-5 h-5" style={{ color: "var(--accent-teal)" }} />
            </div>
            <div className="flex-1 space-y-3">
              <div className="flex gap-2">
                <LFInput
                  data-testid="field-input"
                  placeholder="Enter label name (e.g., 'Invoice Number', 'Date')"
                  value={labelInput}
                  onChange={(e) => setLabelInput(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleAddLabel()}
                />
                <LFButton data-testid="add-field-button" onClick={handleAddLabel} disabled={!labelInput.trim() || labels.length >= 7}>
                  Add
                </LFButton>
              </div>
              <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                If no labels are added, "question" and "answer" will be used by default.
              </p>
              {labels.length > 0 && (
                <div data-testid="fields-list" className="flex flex-wrap gap-2 p-3 bg-gray-50 rounded-lg border" style={{ borderColor: "var(--border-color)" }}>
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

      <LFCard data-testid="export-config-section" header="Export Configuration" accent="#F59E0B">
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

      <div className="flex justify-end pt-4">
        <LFButton data-testid="next-button" onClick={handleNext} disabled={isSubmitting}>
          {isSubmitting ? "Creating Job..." : "Extract & Chunk Document ->"}
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
