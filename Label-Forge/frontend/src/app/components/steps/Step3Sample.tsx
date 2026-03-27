import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { LFCard } from "../ui/LFCard";
import { LFButton } from "../ui/LFButton";
import { LFBadge } from "../ui/LFBadge";
import { S, ChunkData, ExampleCreate } from "../../state";

const highlightColors = ["#dbeafe", "#dcfce7", "#fef9c3", "#f3e8ff"];

type Assignment = {
  field: string;
  start: number;
  end: number;
  text: string;
  color: string;
};

type SelectionState = {
  start: number;
  end: number;
  text: string;
  rect: DOMRect;
};

type SavedPair = {
  id: string;
  values: Record<string, string>;
  example: ExampleCreate;
};

const getFieldColor = (index: number) => highlightColors[index % highlightColors.length];

export function Step3Sample() {
  const navigate = useNavigate();
  const [fields, setFields] = useState<string[]>(S.jobData?.fields ?? []);
  const [chunks, setChunks] = useState<ChunkData[]>(S.chunks ?? []);
  const [currentIndex, setCurrentIndex] = useState(S.currentChunkIndex ?? 0);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [savedPairs, setSavedPairs] = useState<SavedPair[]>([]);
  const [selection, setSelection] = useState<SelectionState | null>(null);
  const selectionRef = useRef<SelectionState | null>(null);
  const isTooltipInteraction = useRef(false);

  const [isSaving, setIsSaving] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const API_BASE = "http://localhost:8001";

  const textRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const setSelectionState = (next: SelectionState | null) => {
    selectionRef.current = next;
    setSelection(next);
  };

  useEffect(() => {
    setFields(S.jobData?.fields ?? []);
    setChunks(S.chunks ?? []);
    setCurrentIndex(S.currentChunkIndex ?? 0);
    setSavedPairs(
      (S.userExamples ?? []).map((example) => ({
        id: `pair_${example.chunk_id}_${example.chunk_index}`,
        values: example.pairs.reduce<Record<string, string>>((acc, pair) => {
          acc[pair.field] = pair.text;
          return acc;
        }, {}),
        example,
      }))
    );
  }, []);

  const currentChunk = chunks[currentIndex];
  const minPairsRequired = 1;
  const canGenerate = savedPairs.length >= minPairsRequired;

  const clearCurrent = () => {
    setAssignments([]);
    setFieldValues({});
    setSelectionState(null);
    window.getSelection()?.removeAllRanges();
  };

  const handleNextChunk = async () => {
    setError("");
    setIsAdvancing(true);
    try {
      if (currentIndex < chunks.length - 1) {
        const nextIndex = currentIndex + 1;
        setCurrentIndex(nextIndex);
        S.currentChunkIndex = nextIndex;
      }
      clearCurrent();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to advance chunk.";
      setError(message);
    } finally {
      setIsAdvancing(false);
    }
  };

  const handleSavePair = async () => {
    setError("");
    setIsSaving(true);
    try {
      if (!currentChunk || fields.length === 0) {
        setError("No chunk or fields available.");
        return;
      }

      const hasAnyValue = fields.some((field) => fieldValues[field]);
      if (!hasAnyValue) return;

      const example: ExampleCreate = {
        chunk_id: currentChunk._id,
        chunk_index: currentChunk.chunk_index,
        source_filename: currentChunk.source_filename,
        pairs: fields.map((field) => ({
          field,
          text: fieldValues[field] || "",
        })),
      };

      const newPair: SavedPair = {
        id: `pair_${Date.now()}`,
        values: { ...fieldValues },
        example,
      };

      setSavedPairs((prev) => {
        const updated = [...prev, newPair];
        S.userExamples = updated.map((pair) => pair.example);
        return updated;
      });
      clearCurrent();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to save pair.";
      setError(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleClear = async () => {
    setIsClearing(true);
    try {
      clearCurrent();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to clear selection.";
      setError(message);
    } finally {
      setIsClearing(false);
    }
  };

  const handleGenerate = async () => {
    setError("");
    if (!canGenerate || !S.jobId) return;

    setIsGenerating(true);
    try {
      const response = await fetch(`${API_BASE}/jobs/${S.jobId}/examples`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ examples: S.userExamples }),
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Failed to save examples.");
      }

      navigate("/generate");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to generate.";
      setError(message);
    } finally {
      setIsGenerating(false);
    }
  };

  const removeSavedPair = async (id: string) => {
    setRemovingId(id);
    try {
      setSavedPairs((prev) => {
        const updated = prev.filter((pair) => pair.id !== id);
        S.userExamples = updated.map((pair) => pair.example);
        return updated;
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to remove pair.";
      setError(message);
    } finally {
      setRemovingId(null);
    }
  };

  const getTextOffset = (container: HTMLElement, node: Node, offset: number) => {
    const range = document.createRange();
    range.setStart(container, 0);
    range.setEnd(node, offset);
    return range.toString().length;
  };

  const updateSelectionFromRange = (range: Range, selectionObj: Selection) => {
    const container = textRef.current;
    if (!container) return;
    if (!container.contains(range.commonAncestorContainer)) {
      setSelectionState(null);
      return;
    }

    const selectedText = selectionObj.toString().trim();
    if (!selectedText) {
      setSelectionState(null);
      return;
    }

    const start = getTextOffset(container, range.startContainer, range.startOffset);
    const end = getTextOffset(container, range.endContainer, range.endOffset);
    const normalizedStart = Math.min(start, end);
    const normalizedEnd = Math.max(start, end);

    if (normalizedEnd - normalizedStart < 2) {
      setSelectionState(null);
      return;
    }

    const rect = range.getBoundingClientRect();
    const fallbackRect = range.getClientRects()[0];
    const finalRect = rect.width === 0 && fallbackRect ? fallbackRect : rect;
    if (!finalRect || (finalRect.width === 0 && finalRect.height === 0)) {
      setSelectionState(null);
      return;
    }

    setSelectionState({
      start: normalizedStart,
      end: normalizedEnd,
      text: selectedText,
      rect: finalRect,
    });
  };

  const handleMouseUp = () => {
    const selectionObj = window.getSelection();
    if (!selectionObj || selectionObj.rangeCount === 0) {
      setSelectionState(null);
      return;
    }
    const range = selectionObj.getRangeAt(0);
    updateSelectionFromRange(range, selectionObj);
  };

  const handleAssign = (field: string) => {
    const activeSelection = selection ?? selectionRef.current;
    if (!activeSelection) return;
    const fieldIndex = fields.indexOf(field);
    const color = getFieldColor(fieldIndex);

    setAssignments((prev) => {
      const updated = prev.filter((assignment) => assignment.field !== field);
      updated.push({
        field,
        start: activeSelection.start,
        end: activeSelection.end,
        text: activeSelection.text,
        color,
      });
      return updated.sort((a, b) => a.start - b.start);
    });

    setFieldValues((prev) => ({
      ...prev,
      [field]: activeSelection.text,
    }));

    setSelectionState(null);
    window.getSelection()?.removeAllRanges();
  };

  useEffect(() => {
    const handleSelectionChange = () => {
      const selectionObj = window.getSelection();
      if (!selectionObj || selectionObj.rangeCount === 0 || selectionObj.isCollapsed) {
        if (isTooltipInteraction.current) return;
        setSelectionState(null);
        return;
      }
      const range = selectionObj.getRangeAt(0);
      updateSelectionFromRange(range, selectionObj);
    };

    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (tooltipRef.current?.contains(target)) return;
      if (textRef.current?.contains(target)) return;
      setSelectionState(null);
    };

    document.addEventListener("selectionchange", handleSelectionChange);
    document.addEventListener("mousedown", handleOutsideClick);
    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange);
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, []);

  const annotatedNodes = useMemo(() => {
    const text = currentChunk?.text || "";
    if (assignments.length === 0) return text;

    const sorted = assignments
      .filter((assignment) => assignment.start >= 0 && assignment.end <= text.length)
      .sort((a, b) => a.start - b.start);

    const nodes: Array<string | JSX.Element> = [];
    let cursor = 0;

    sorted.forEach((assignment, index) => {
      if (assignment.start < cursor) return;
      if (assignment.start > cursor) {
        nodes.push(text.slice(cursor, assignment.start));
      }
      nodes.push(
        <span
          key={`${assignment.field}-${assignment.start}-${index}`}
          style={{
            backgroundColor: assignment.color,
            borderRadius: "6px",
            padding: "0 4px",
          }}
        >
          {text.slice(assignment.start, assignment.end)}
        </span>
      );
      cursor = assignment.end;
    });

    if (cursor < text.length) {
      nodes.push(text.slice(cursor));
    }

    return nodes;
  }, [assignments, currentChunk?.text]);

  if (!currentChunk) {
    return (
      <div className="space-y-4">
        <LFCard>
          <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>
            No chunks available. Please return to extraction.
          </p>
        </LFCard>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div
        className="rounded-[12px] border px-4 py-3"
        style={{
          borderColor: "#f6c453",
          backgroundColor: "#fffbeb",
        }}
      >
        <p style={{ fontSize: "13px", color: "#92400e" }}>
          Label all relevant training pairs from this chunk carefully. The pairs you create here are used as examples to
          guide the AI in extracting pairs from the rest of your document. The more accurate and thorough you are here,
          the better the results will be.
        </p>
      </div>
      <div className="flex items-center justify-between">
        <div
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border"
          style={{
            borderColor: "var(--border-color)",
            backgroundColor: "var(--card-header)",
            fontFamily: "var(--font-mono)",
            fontSize: "12px",
          }}
        >
          <span>Chunk {currentIndex + 1}</span>
          <span style={{ color: "var(--text-muted)" }}>of {chunks.length}</span>
        </div>
        <div className="flex items-center gap-2">
          <LFBadge color="amber">{savedPairs.length} pairs saved</LFBadge>
          <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
            Minimum {minPairsRequired} required
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <LFCard className="lg:col-span-3">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "12px",
                  color: "var(--text-muted)",
                }}
              >
                Field Legend:
              </span>
              {fields.map((field, index) => (
                <div key={field} className="flex items-center gap-2">
                  <span
                    className="inline-block w-3 h-3 rounded-sm"
                    style={{ backgroundColor: getFieldColor(index) }}
                  />
                  <span style={{ fontSize: "12px" }}>{field}</span>
                </div>
              ))}
            </div>

            <div
              ref={textRef}
              onMouseUp={handleMouseUp}
              className="relative p-5 rounded-[10px] border"
              style={{
                borderColor: "var(--border-color)",
                backgroundColor: "#ffffff",
                minHeight: "360px",
                lineHeight: "1.8",
                fontSize: "15px",
                userSelect: "text",
                cursor: "text",
              }}
            >
              {annotatedNodes}

              {selection && (
                <div
                  ref={tooltipRef}
                  className="fixed z-50"
                  onMouseDown={() => {
                    isTooltipInteraction.current = true;
                  }}
                  onMouseUp={() => {
                    setTimeout(() => {
                      isTooltipInteraction.current = false;
                    }, 0);
                  }}
                  style={{
                    top: `${selection.rect.top - 8}px`,
                    left: `${selection.rect.left + selection.rect.width / 2}px`,
                    transform: "translate(-50%, -100%)",
                  }}
                >
                  <div
                    className="flex flex-wrap gap-2 px-3 py-2 rounded-[10px] border shadow-lg"
                    style={{
                      backgroundColor: "#ffffff",
                      borderColor: "var(--border-color)",
                    }}
                  >
                    {fields.map((field, index) => {
                      const isFilled = Boolean(fieldValues[field]);
                      return (
                        <button
                          key={field}
                          onMouseDown={(event) => {
                            event.preventDefault();
                            handleAssign(field);
                          }}
                          className="px-3 py-1 rounded-full border text-xs font-medium transition-all hover:opacity-80"
                          style={{
                            borderColor: "var(--border-color)",
                            backgroundColor: getFieldColor(index),
                            fontFamily: "var(--font-mono)",
                          }}
                        >
                          {isFilled ? `✓ ${field}` : field}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>
              Try to label every extractable pair in this chunk before moving to Generate.
            </p>
          </div>
        </LFCard>

        <LFCard className="lg:col-span-2">
          <div className="space-y-4">
            <div className="space-y-3">
              {fields.map((field, index) => (
                <div
                  key={field}
                  className="border rounded-[10px] p-3"
                  style={{ borderColor: "var(--border-color)" }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "12px",
                        color: "var(--text-muted)",
                      }}
                    >
                      {field}
                    </span>
                    <span
                      className="inline-block w-3 h-3 rounded-sm"
                      style={{ backgroundColor: getFieldColor(index) }}
                    />
                  </div>
                  <div
                    className="min-h-[54px] rounded-[8px] px-3 py-2"
                    style={{
                      backgroundColor: "var(--card-header)",
                      fontSize: "13px",
                      color: fieldValues[field] ? "var(--ink-dark)" : "var(--text-muted)",
                    }}
                  >
                    {fieldValues[field] || "Highlight text to assign"}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              <LFButton onClick={handleSavePair} disabled={isSaving}>
                {isSaving ? "Saving..." : "Save Pair"}
              </LFButton>
              <LFButton variant="ghost" onClick={handleClear} disabled={isClearing}>
                {isClearing ? "Clearing..." : "Clear"}
              </LFButton>
              <LFButton variant="ghost" onClick={handleNextChunk} disabled={isAdvancing}>
                {isAdvancing ? "Loading..." : "Next Chunk →"}
              </LFButton>
            </div>

            <LFButton onClick={handleGenerate} disabled={!canGenerate || isGenerating}>
              {isGenerating ? "Generating..." : "Generate →"}
            </LFButton>

            <div className="border-t pt-4" style={{ borderColor: "var(--border-color)" }}>
              <div className="flex items-center justify-between mb-3">
                <span style={{ fontWeight: 600 }}>Saved Pairs</span>
                <span
                  className="px-2 py-1 rounded-full"
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "11px",
                    backgroundColor: "var(--card-header)",
                    color: "var(--text-muted)",
                  }}
                >
                  {savedPairs.length} pairs saved
                </span>
              </div>

              <div className="space-y-2 max-h-[260px] overflow-y-auto">
                {savedPairs.length === 0 && (
                  <div
                    className="p-3 rounded-[8px] text-center"
                    style={{ backgroundColor: "var(--card-header)", color: "var(--text-muted)", fontSize: "12px" }}
                  >
                    No pairs saved yet.
                  </div>
                )}
                {savedPairs.map((pair) => (
                  <div
                    key={pair.id}
                    className="border rounded-[10px] p-3 space-y-2"
                    style={{ borderColor: "var(--border-color)" }}
                  >
                    {fields.map((field) => (
                      <div key={field} style={{ fontSize: "12px" }}>
                        <span
                          style={{
                            fontFamily: "var(--font-mono)",
                            color: "var(--text-muted)",
                            marginRight: "6px",
                          }}
                        >
                          {field}:
                        </span>
                        <span>{pair.values[field] || "—"}</span>
                      </div>
                    ))}
                    <button
                      onClick={() => removeSavedPair(pair.id)}
                      className="text-xs font-medium"
                      style={{ color: "var(--error-red)" }}
                      disabled={removingId === pair.id}
                    >
                      {removingId === pair.id ? "Removing..." : "Remove"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </LFCard>
      </div>

      {error && (
        <p style={{ color: "var(--error-red)", fontSize: "12px" }}>
          {error}
        </p>
      )}
    </div>
  );
}
