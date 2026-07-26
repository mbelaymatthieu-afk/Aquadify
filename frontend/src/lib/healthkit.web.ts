// Web / non-iOS no-op twin of healthkit.native.ts.
export const HEALTH_ENABLED = false;

export type TodayActivity = {
  steps: number;
  activeEnergyKcal: number;
  workouts: number;
};

export type HealthSnapshot = {
  steps?: number;
  distance_km?: number;
  active_energy?: number;
  total_energy?: number;
  heart_rate?: number;
  resting_heart_rate?: number;
  workouts?: number;
  workout_minutes?: number;
  workout_types?: string[];
  stand_minutes?: number;
  flights_climbed?: number;
  weight_kg?: number;
  bmi?: number;
  sleep_hours?: number;
  hrv?: number;
  respiratory_rate?: number;
  spo2?: number;
};

export function isAvailable(): boolean {
  return false;
}
export async function requestHealthAuth(): Promise<boolean> {
  return false;
}
export async function getTodayActivity(): Promise<TodayActivity> {
  return { steps: 0, activeEnergyKcal: 0, workouts: 0 };
}
export async function getHealthSnapshot(): Promise<HealthSnapshot> {
  return {};
}
