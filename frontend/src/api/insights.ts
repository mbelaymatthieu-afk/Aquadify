// Premium AI hydration insights — served by the LOCAL backend (Emergent LLM).
// The enhanced endpoint computes a hydration score /100 and returns contextual,
// personalized tips (with reasons) + a same-day prediction, using Apple Health
// data when available. Deploy the same endpoint on the remote backend for prod.
import { INSIGHTS_BASE } from "@/src/config";
import type { HealthSnapshot } from "@/src/lib/healthkit";

const LOCAL = INSIGHTS_BASE;

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

export async function fetchInsights(payload: InsightsPayload): Promise<Insights> {
  const res = await fetch(`${LOCAL}/api/insights`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("insights failed");
  return res.json();
}
