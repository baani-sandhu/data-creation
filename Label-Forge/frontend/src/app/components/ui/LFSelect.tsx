import React from "react";

interface LFSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  children: React.ReactNode;
}

export function LFSelect({ className = "", children, ...props }: LFSelectProps) {
  return (
    <select
      className={`w-full px-3.5 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-blue)]/30 focus:border-[var(--primary-blue)] transition-all bg-white shadow-sm ${className}`}
      style={{
        borderColor: "var(--border-color)",
        fontFamily: "var(--font-sans)",
      }}
      {...props}
    >
      {children}
    </select>
  );
}