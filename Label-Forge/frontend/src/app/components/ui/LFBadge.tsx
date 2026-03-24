import React from "react";

const labelColors = {
  blue: { bg: "var(--label-blue)", border: "var(--label-blue-border)" },
  green: { bg: "var(--label-green)", border: "var(--label-green-border)" },
  red: { bg: "var(--label-red)", border: "var(--label-red-border)" },
  amber: { bg: "var(--label-amber)", border: "var(--label-amber-border)" },
  purple: { bg: "var(--label-purple)", border: "var(--label-purple-border)" },
  teal: { bg: "var(--label-teal)", border: "var(--label-teal-border)" },
  indigo: { bg: "var(--label-indigo)", border: "var(--label-indigo-border)" },
};

export type LabelColor = keyof typeof labelColors;

interface LFBadgeProps {
  children: React.ReactNode;
  color: LabelColor;
  onRemove?: () => void;
}

export function LFBadge({ children, color, onRemove }: LFBadgeProps) {
  const colors = labelColors[color];
  
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border shadow-sm"
      style={{
        backgroundColor: colors.bg,
        borderColor: colors.border,
        fontFamily: "var(--font-mono)",
        fontSize: "11px",
        fontWeight: 600,
        letterSpacing: "0.01em",
      }}
    >
      {children}
      {onRemove && (
        <button
          onClick={onRemove}
          className="hover:opacity-70 transition-opacity ml-0.5"
          style={{ color: colors.border }}
        >
          ✕
        </button>
      )}
    </span>
  );
}