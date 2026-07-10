// Evidence-based daily water (beverage) target in ml.
// Baseline ~30 ml per kg body weight, adjusted for sex, age, activity and climate.
// Kept realistic (users found previous values too high). Clamped 1200–4000 ml.
export type HydrationProfile = {
  weight: number; // kg
  age: number;
  sex: "male" | "female" | "other" | string;
  activity: "sedentary" | "moderate" | "intense" | string;
  climate: "cold" | "temperate" | "hot" | string;
};

export function computeDailyGoal(p: HydrationProfile): number {
  const weight = Math.max(30, Math.min(200, p.weight || 70));
  let goal = weight * 30; // ml/kg baseline for beverages

  // sex
  if (p.sex === "female") goal *= 0.9;
  else if (p.sex === "other") goal *= 0.95;

  // age (older adults slightly lower thirst/needs)
  if (p.age >= 65) goal *= 0.9;
  else if (p.age <= 17) goal *= 0.95;

  // activity — modest additive bonus
  if (p.activity === "moderate") goal += 250;
  else if (p.activity === "intense") goal += 500;

  // climate
  if (p.climate === "hot") goal += 300;
  else if (p.climate === "cold") goal -= 100;

  // round to nearest 50, clamp
  goal = Math.round(goal / 50) * 50;
  return Math.max(1200, Math.min(4000, goal));
}
