import Constants from "expo-constants";

// API base URLs. In dev/preview the EXPO_PUBLIC_* env vars (from .env) win.
// In a production build .env is NOT bundled, so we fall back to app.json
// `extra`, which IS always shipped inside the binary. This prevents the
// "Network request failed" bug on TestFlight/App Store builds.
const extra = (Constants.expoConfig?.extra || {}) as Record<string, string>;

export const AQUADIFY_API =
  process.env.EXPO_PUBLIC_AQUADIFY_API || extra.aquadifyApiUrl;

export const INSIGHTS_BASE =
  process.env.EXPO_PUBLIC_BACKEND_URL || extra.insightsApiUrl;
