import React from "react";

interface LFButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "success" | "warning";
  children: React.ReactNode;
}

export function LFButton({ variant = "primary", children, className = "", disabled, ...props }: LFButtonProps) {
  const baseStyles = "px-5 py-2.5 transition-all font-medium shadow-sm hover:shadow-md active:scale-[0.98]";
  const radiusStyles = "rounded-lg";
  
  let variantStyles = "";
  let inlineStyles: React.CSSProperties = {};
  
  if (variant === "primary") {
    variantStyles = "text-white border-0";
    inlineStyles = {
      background: disabled ? "#9CA3AF" : "var(--gradient-primary)",
    };
  } else if (variant === "secondary") {
    variantStyles = "bg-white border text-[var(--ink-dark)] hover:border-[var(--primary-blue)]";
    inlineStyles = {
      borderColor: "var(--border-color)",
    };
  } else if (variant === "ghost") {
    variantStyles = "border-0 bg-transparent text-[var(--text-muted)] hover:text-[var(--primary-blue)] hover:bg-[var(--label-blue)]";
  } else if (variant === "success") {
    variantStyles = "text-white border-0";
    inlineStyles = {
      background: disabled ? "#9CA3AF" : "var(--gradient-success)",
    };
  } else if (variant === "warning") {
    variantStyles = "text-white border-0";
    inlineStyles = {
      background: disabled ? "#9CA3AF" : "linear-gradient(135deg, #FBBF24 0%, #F59E0B 100%)",
    };
  }
  
  return (
    <button
      className={`${baseStyles} ${radiusStyles} ${variantStyles} ${className} ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
      style={inlineStyles}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}