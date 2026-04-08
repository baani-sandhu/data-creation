const getEnv = (viteKey: string, legacyKey: string) =>
  import.meta.env[viteKey] ?? import.meta.env[legacyKey];

const apiBaseUrl = getEnv("VITE_API_BASE_URL", "NEXT_PUBLIC_API_BASE_URL");

if (!apiBaseUrl) {
  throw new Error("Missing API base URL. Set VITE_API_BASE_URL.");
}

export const API_BASE_URL = apiBaseUrl.replace(/\/$/, "");
