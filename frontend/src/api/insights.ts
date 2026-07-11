// Premium AI hydration insights — served by the LOCAL backend (Emergent LLM),
// since the remote drip-track1 backend can't be modified.
import { INSIGHTS_BASE } from "@/src/config";

const LOCAL = INSIGHTS_BASE;

export type Insights = { summary: string; tips: string[]; error?: boolean };

export async function fetchInsights(payload: {
  goal: number;
  average: number;
  days_achieved: number;
  total_days: number;
  current_streak: number;
  best_streak: number;
  recent: { date: string; total: number; goal: number }[];
  language: string;
}): Promise<Insights> {
  const res = await fetch(`${LOCAL}/api/insights`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("insights failed");
  return res.json();
}
