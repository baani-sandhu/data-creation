import { useState, type FormEvent } from "react";
import { LFButton } from "./ui/LFButton";
import { LFInput } from "./ui/LFInput";
import {
  getFirebaseAuthErrorMessage,
  signInWithEmail,
  signInWithGoogle,
  signUpWithEmail,
} from "../lib/auth";

type AuthMode = "sign-in" | "sign-up";

export function LoginPage() {
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleGoogleSignIn = async () => {
    setError("");
    setIsSubmitting(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      const message = getFirebaseAuthErrorMessage(err, "Unable to sign in with Google.");
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");

    if (mode === "sign-up" && password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setIsSubmitting(true);
    try {
      if (mode === "sign-up") {
        await signUpWithEmail(email, password);
      } else {
        await signInWithEmail(email, password);
      }
    } catch (err) {
      const fallback =
        mode === "sign-up" ? "Unable to create your account." : "Unable to sign in with email.";
      const message = getFirebaseAuthErrorMessage(err, fallback);
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-6"
      style={{ backgroundColor: "#F7F6F2", fontFamily: "'IBM Plex Sans', var(--font-sans)" }}
    >
      <div className="w-full max-w-[420px] space-y-5">
        <div className="text-center space-y-2">
          <div style={{ fontSize: "26px", fontWeight: 700, color: "var(--ink-dark)" }}>LabelForge</div>
          <div style={{ fontSize: "14px", color: "var(--text-muted)" }}>
            {mode === "sign-up"
              ? "Create your account to start labeling."
              : "Sign in to continue your labeling session."}
          </div>
        </div>

        <div
          className="grid grid-cols-2 gap-2 rounded-lg p-1"
          style={{ backgroundColor: "white", border: "1px solid var(--border-color)" }}
        >
          <button
            type="button"
            onClick={() => {
              setMode("sign-in");
              setError("");
            }}
            className="rounded-md px-3 py-2 text-sm font-medium transition-all"
            style={{
              background: mode === "sign-in" ? "var(--gradient-primary)" : "transparent",
              color: mode === "sign-in" ? "white" : "var(--text-muted)",
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("sign-up");
              setError("");
            }}
            className="rounded-md px-3 py-2 text-sm font-medium transition-all"
            style={{
              background: mode === "sign-up" ? "var(--gradient-primary)" : "transparent",
              color: mode === "sign-up" ? "white" : "var(--text-muted)",
            }}
          >
            Sign Up
          </button>
        </div>

        {mode === "sign-in" && (
          <>
            <LFButton
              onClick={handleGoogleSignIn}
              className="w-full justify-center"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Signing in..." : "Sign in with Google"}
            </LFButton>

            <div className="text-center" style={{ fontSize: "12px", color: "var(--text-muted)" }}>
              or
            </div>
          </>
        )}

        <form className="space-y-3" onSubmit={handleSubmit}>
          <LFInput
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <LFInput
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {mode === "sign-up" && (
            <LFInput
              type="password"
              placeholder="Confirm password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          )}
          <LFButton type="submit" className="w-full justify-center" disabled={isSubmitting}>
            {isSubmitting
              ? mode === "sign-up"
                ? "Creating account..."
                : "Signing in..."
              : mode === "sign-up"
                ? "Create Account"
                : "Sign in"}
          </LFButton>
        </form>

        {error && (
          <div style={{ fontSize: "12px", color: "var(--error-red)" }}>
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
