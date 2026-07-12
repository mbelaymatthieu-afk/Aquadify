import Constants from "expo-constants";
import { Platform } from "react-native";

// Apple HealthKit reads via @kingstinct/react-native-healthkit.
// iOS-only, native build only. Guarded everywhere; the .web.ts twin is a no-op.
export const HEALTH_ENABLED = Platform.OS === "ios" && Constants.appOwnership !== "expo";

export type TodayActivity = {
  steps: number;
  activeEnergyKcal: number;
  workouts: number;
};

const STEP_ID = "HKQuantityTypeIdentifierStepCount";
const ENERGY_ID = "HKQuantityTypeIdentifierActiveEnergyBurned";
const WORKOUT_ID = "HKWorkoutTypeIdentifier";

let _mod: any = null;
function hk() {
  if (!_mod) _mod = require("@kingstinct/react-native-healthkit");
  return _mod;
}

export function isAvailable(): boolean {
  if (!HEALTH_ENABLED) return false;
  try {
    return !!hk().isHealthDataAvailable();
  } catch {
    return false;
  }
}

export async function requestHealthAuth(): Promise<boolean> {
  if (!HEALTH_ENABLED) return false;
  try {
    const ok = await hk().requestAuthorization({
      toRead: [STEP_ID, ENERGY_ID, WORKOUT_ID],
    });
    return !!ok;
  } catch {
    return false;
  }
}

export async function getTodayActivity(): Promise<TodayActivity> {
  const empty: TodayActivity = { steps: 0, activeEnergyKcal: 0, workouts: 0 };
  if (!HEALTH_ENABLED) return empty;

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  const filter = { date: { startDate: start, endDate: end } };

  try {
    const [stepStats, energyStats] = await Promise.all([
      hk().queryStatisticsForQuantity(STEP_ID, ["cumulativeSum"], { unit: "count", filter }),
      hk().queryStatisticsForQuantity(ENERGY_ID, ["cumulativeSum"], { unit: "kcal", filter }),
    ]);

    let workouts = 0;
    try {
      const w = await hk().queryWorkoutSamples({ limit: 100, ascending: false, filter });
      workouts = Array.isArray(w) ? w.length : 0;
    } catch {
      workouts = 0;
    }

    return {
      steps: Math.round(stepStats?.sumQuantity?.quantity ?? 0),
      activeEnergyKcal: Math.round(energyStats?.sumQuantity?.quantity ?? 0),
      workouts,
    };
  } catch {
    return empty;
  }
}
