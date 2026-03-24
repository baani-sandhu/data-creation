import React from "react";

interface LFProgressProps {
  value: number; // 0-100
  thickness?: number;
  color?: string;
  animated?: boolean;
}

export function LFProgress({ value, thickness = 6, color = "var(--gradient-primary)", animated = true }: LFProgressProps) {
  return (
    <div
      className="w-full bg-gray-200 rounded-full overflow-hidden shadow-inner"
      style={{ height: `${thickness}px` }}
    >
      <div
        className={`h-full transition-all duration-500 rounded-full ${animated ? 'animate-pulse' : ''}`}
        style={{
          width: `${value}%`,
          background: color,
          boxShadow: color.includes('gradient') ? 'none' : `0 0 8px ${color}40`,
        }}
      />
    </div>
  );
}