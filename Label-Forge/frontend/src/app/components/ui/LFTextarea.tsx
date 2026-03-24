import React from "react";

interface LFTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

export function LFTextarea({ className = "", ...props }: LFTextareaProps) {
  return (
    <textarea
      className={`w-full px-3.5 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-blue)]/30 focus:border-[var(--primary-blue)] transition-all shadow-sm ${className}`}
      style={{
        borderColor: "var(--border-color)",
        fontFamily: "var(--font-sans)",
      }}
      {...props}
    />
  );
}