// Aquadify design tokens — replicates the existing web app's look:
// blue gradient brand, white rounded cards, friendly blue accent.

export const colors = {
  primary: "#3B82F6",
  primaryDark: "#2563EB",
  primaryLight: "#60A5FA",
  primarySoft: "#EAF2FE",

  gradTop: "#5BA4F5",
  gradMid: "#3B82F6",
  gradBottom: "#2F6FD0",

  bg: "#EEF4FB",
  card: "#FFFFFF",
  cardAlt: "#F5F9FE",

  text: "#0F172A",
  textSecondary: "#64748B",
  textMuted: "#94A3B8",

  border: "#E5EDF7",
  track: "#DCE9F8",

  success: "#22C55E",
  warning: "#F59E0B",
  danger: "#EF4444",
  gold: "#FBBF24",

  white: "#FFFFFF",
  overlay: "rgba(15,23,42,0.45)",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 40,
} as const;

export const radius = {
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  pill: 999,
} as const;

export const font = {
  hero: 40,
  h1: 28,
  h2: 22,
  h3: 18,
  body: 16,
  small: 14,
  tiny: 12,
} as const;

export const shadow = {
  card: {
    shadowColor: "#1E3A8A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 4,
  },
  soft: {
    shadowColor: "#1E3A8A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  button: {
    shadowColor: "#3B82F6",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 6,
  },
} as const;
