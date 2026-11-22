// AI hydration insights, served by the authenticated Aquadify backend.
// Apple Health values only feed the server-side score and never reach an AI provider.
import { api } from "@/src/api/client";
import type { HealthSnapshot } from "@/src/lib/healthkit";

export type InsightTip = { text: string; reason?: string };

export type Insights = {
  score?: number;
  adjusted_goal?: number;
  score_reasons?: string[];
  summary: string;
  tips: InsightTip[];
  prediction?: string;
  error?: boolean;
};

export type InsightsPayload = {
  goal: number;
  consumed_today: number;
  logs_today: number;
  last_intake_hours?: number | null;
  hour_of_day: number;
  average: number;
  days_achieved: number;
  total_days: number;
  current_streak: number;
  best_streak: number;
  recent: { date: string; total: number; goal: number }[];
  activity_trend?: { date: string; steps?: number; active_energy?: number }[];
  health?: HealthSnapshot | null;
  language: string;
};

export function fetchInsights(payload: InsightsPayload, token: string | null): Promise<Insights> {
  return api.post<Insights>("/insights", payload, token);
}
