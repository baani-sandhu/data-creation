import { Outlet, useLocation, useNavigate } from "react-router";
import { Check, Sparkles } from "lucide-react";

const steps = [
  { number: 1, title: "Setup", path: "/", color: "#3B82F6" },
  { number: 2, title: "Extract & Chunk", path: "/extract", color: "#8B5CF6" },
  { number: 3, title: "Sample Labeling", path: "/sample", color: "#14B8A6" },
  { number: 4, title: "LLM Generation", path: "/generate", color: "#F59E0B" },
  { number: 5, title: "Review & Route", path: "/review", color: "#EF4444" },
  { number: 6, title: "Export", path: "/export", color: "#10B981" },
];

export function Layout() {
  const location = useLocation();
  const navigate = useNavigate();

  const currentStepIndex = steps.findIndex((step) => step.path === location.pathname);
  const currentStep = steps[currentStepIndex];

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--base-bg)", fontFamily: "var(--font-sans)" }}>
      {/* Top Bar with gradient */}
      <div 
        className="sticky top-0 z-50 h-[60px] flex items-center px-8 shadow-sm" 
        style={{ 
          background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
        }}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "var(--gradient-primary)" }}>
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div className="flex items-baseline gap-3">
            <span className="text-white" style={{ fontFamily: "var(--font-sans)", fontSize: "20px", fontWeight: 700, letterSpacing: "-0.02em" }}>
              LabelForge
            </span>
            <span className="text-white/60" style={{ fontSize: "13px", fontWeight: 500 }}>
              ML Training Data Pipeline
            </span>
          </div>
        </div>
      </div>

      {/* Step Wizard Bar with color accents */}
      <div className="bg-white border-b shadow-sm" style={{ borderColor: "var(--border-color)" }}>
        <div className="max-w-[980px] mx-auto px-8">
          <div className="flex items-center justify-between py-5">
            {steps.map((step, index) => {
              const isActive = index === currentStepIndex;
              const isCompleted = index < currentStepIndex;
              const isClickable = index <= currentStepIndex;

              return (
                <div key={step.number} className="flex items-center flex-1">
                  <button
                    onClick={() => isClickable && navigate(step.path)}
                    disabled={!isClickable}
                    className="flex flex-col items-center gap-2 transition-all hover:scale-105"
                    style={{ opacity: isClickable ? 1 : 0.35 }}
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center border-2 transition-all shadow-sm"
                      style={{
                        background: isCompleted || isActive ? step.color : "transparent",
                        borderColor: isCompleted || isActive ? step.color : "var(--border-color)",
                        color: isCompleted || isActive ? "white" : "var(--text-muted)",
                        fontFamily: "var(--font-mono)",
                        fontSize: "13px",
                        fontWeight: 600,
                        boxShadow: isActive ? `0 4px 12px ${step.color}40` : "none",
                      }}
                    >
                      {isCompleted ? <Check className="w-5 h-5" strokeWidth={2.5} /> : step.number}
                    </div>
                    <div className="flex flex-col items-center">
                      <span
                        className="whitespace-nowrap"
                        style={{
                          fontSize: "12px",
                          fontWeight: isActive ? 600 : 500,
                          color: isActive ? step.color : "var(--text-muted)",
                        }}
                      >
                        {step.title}
                      </span>
                      {isActive && (
                        <div
                          className="mt-1.5 w-full h-1 rounded-full"
                          style={{ backgroundColor: step.color }}
                        />
                      )}
                    </div>
                  </button>
                  {index < steps.length - 1 && (
                    <div 
                      className="flex-1 h-[2px] mx-2 mt-[-28px]"
                      style={{ 
                        background: isCompleted 
                          ? `linear-gradient(to right, ${step.color}, ${steps[index + 1].color})`
                          : "var(--border-color)",
                        opacity: isCompleted ? 0.5 : 0.3
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-[980px] mx-auto px-8 py-8">
        <Outlet />
      </div>
    </div>
  );
}