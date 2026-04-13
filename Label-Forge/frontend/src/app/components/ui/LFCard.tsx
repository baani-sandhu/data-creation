import React from "react";

interface LFCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  header?: string;
  className?: string;
  accent?: string; // Optional accent color for the header
}

export function LFCard({ children, header, className = "", accent, ...props }: LFCardProps) {
  return (
    <div
      className={`bg-white border rounded-lg shadow-sm hover:shadow-md transition-shadow ${className}`}
      style={{ borderColor: "var(--border-color)" }}
      {...props}
    >
      {header && (
        <div
          className="px-5 py-3 border-b relative overflow-hidden"
          style={{
            background: "linear-gradient(135deg, #F8F9FF 0%, #F0EDE6 100%)",
            borderColor: "var(--border-color)",
          }}
        >
          {accent && (
            <div 
              className="absolute left-0 top-0 bottom-0 w-1"
              style={{ backgroundColor: accent }}
            />
          )}
          <span
            className="uppercase tracking-wider"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              fontWeight: 600,
              color: "var(--ink-dark)",
              letterSpacing: "0.05em",
            }}
          >
            {header}
          </span>
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}
