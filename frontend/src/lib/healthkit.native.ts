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

// Rich snapshot consumed by Aquanalyse. Every field is optional — a metric is
// simply omitted when unavailable or unauthorized.
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

const ID = {
  steps: "HKQuantityTypeIdentifierStepCount",
  distance: "HKQuantityTypeIdentifierDistanceWalkingRunning",
  active: "HKQuantityTypeIdentifierActiveEnergyBurned",
  basal: "HKQuantityTypeIdentifierBasalEnergyBurned",
  flights: "HKQuantityTypeIdentifierFlightsClimbed",
  stand: "HKQuantityTypeIdentifierAppleStandTime",
  hr: "HKQuantityTypeIdentifierHeartRate",
  rhr: "HKQuantityTypeIdentifierRestingHeartRate",
  hrv: "HKQuantityTypeIdentifierHeartRateVariabilitySDNN",
  resp: "HKQuantityTypeIdentifierRespiratoryRate",
  spo2: "HKQuantityTypeIdentifierOxygenSaturation",
  weight: "HKQuantityTypeIdentifierBodyMass",
  bmi: "HKQuantityTypeIdentifierBodyMassIndex",
  workout: "HKWorkoutTypeIdentifier",
  sleep: "HKCategoryTypeIdentifierSleepAnalysis",
};

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
      toRead: [
        ID.steps,
        ID.distance,
        ID.active,
        ID.basal,
        ID.flights,
        ID.stand,
        ID.hr,
        ID.rhr,
        ID.hrv,
        ID.resp,
        ID.spo2,
        ID.weight,
        ID.bmi,
        ID.workout,
        ID.sleep,
      ],
    });
    return !!ok;
  } catch {
    return false;
  }
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

async function sum(id: string, unit: string, filter: any): Promise<number | undefined> {
  try {
    const r = await hk().queryStatisticsForQuantity(id, ["cumulativeSum"], { unit, filter });
    const q = r?.sumQuantity?.quantity;
    return typeof q === "number" ? q : undefined;
  } catch {
    return undefined;
  }
}

async function avg(id: string, unit: string, filter: any): Promise<number | undefined> {
  try {
    const r = await hk().queryStatisticsForQuantity(id, ["discreteAverage"], { unit, filter });
    const q = r?.averageQuantity?.quantity;
    return typeof q === "number" ? q : undefined;
  } catch {
    return undefined;
  }
}

async function latest(id: string, unit: string): Promise<number | undefined> {
  try {
    const samples = await hk().queryQuantitySamples(id, { limit: 1, ascending: false, unit });
    const q = Array.isArray(samples) ? samples[0]?.quantity : undefined;
    return typeof q === "number" ? q : undefined;
  } catch {
    return undefined;
  }
}

// Kept for health.tsx (goal adaptation): lightweight today activity.
export async function getTodayActivity(): Promise<TodayActivity> {
  const empty: TodayActivity = { steps: 0, activeEnergyKcal: 0, workouts: 0 };
  if (!HEALTH_ENABLED) return empty;
  const filter = { date: { startDate: startOfToday(), endDate: new Date() } };
  try {
    const [steps, active] = await Promise.all([
      sum(ID.steps, "count", filter),
      sum(ID.active, "kcal", filter),
    ]);
    let workouts = 0;
    try {
      const w = await hk().queryWorkoutSamples({ limit: 100, ascending: false, filter });
      workouts = Array.isArray(w) ? w.length : 0;
    } catch {
      workouts = 0;
    }
    return {
      steps: Math.round(steps ?? 0),
      activeEnergyKcal: Math.round(active ?? 0),
      workouts,
    };
  } catch {
    return empty;
  }
}

async function getSleepHours(): Promise<number | undefined> {
  try {
    // Look back 18h to capture last night's sleep.
    const end = new Date();
    const start = new Date(end.getTime() - 18 * 3600 * 1000);
    const samples = await hk().queryCategorySamples(ID.sleep, {
      filter: { date: { startDate: start, endDate: end } },
      limit: 400,
    });
    if (!Array.isArray(samples)) return undefined;
    // Sleep analysis values considered "asleep": 1 (unspecified), 3 (core), 4 (deep), 5 (REM).
    const asleep = new Set([1, 3, 4, 5]);
    let ms = 0;
    for (const s of samples) {
      if (asleep.has(s?.value)) {
        const a = new Date(s.startDate).getTime();
        const b = new Date(s.endDate).getTime();
        if (b > a) ms += b - a;
      }
    }
    return ms > 0 ? Math.round((ms / 3600000) * 10) / 10 : undefined;
  } catch {
    return undefined;
  }
}

async function getWorkouts(filter: any) {
  try {
    const w = await hk().queryWorkoutSamples({ limit: 100, ascending: false, filter });
    if (!Array.isArray(w) || w.length === 0) return { count: 0, minutes: 0, types: [] as string[] };
    let seconds = 0;
    const types = new Set<string>();
    for (const x of w) {
      seconds += x?.durationInSeconds ?? x?.duration?.quantity ?? x?.duration ?? 0;
      const tp = x?.workoutActivityType;
      if (tp != null) types.add(String(tp));
    }
    return { count: w.length, minutes: Math.round(seconds / 60), types: Array.from(types).slice(0, 5) };
  } catch {
    return { count: 0, minutes: 0, types: [] as string[] };
  }
}

// Full snapshot for Aquanalyse. Reads everything the user has authorized; each
// metric is independent and failure-tolerant.
export async function getHealthSnapshot(): Promise<HealthSnapshot> {
  if (!HEALTH_ENABLED) return {};
  const filter = { date: { startDate: startOfToday(), endDate: new Date() } };

  const [
    steps,
    distanceM,
    active,
    basal,
    flights,
    stand,
    hr,
    rhr,
    hrv,
    resp,
    spo2Raw,
    weight,
    bmi,
    sleep,
    workouts,
  ] = await Promise.all([
    sum(ID.steps, "count", filter),
    sum(ID.distance, "m", filter),
    sum(ID.active, "kcal", filter),
    sum(ID.basal, "kcal", filter),
    sum(ID.flights, "count", filter),
    sum(ID.stand, "min", filter),
    avg(ID.hr, "count/min", filter),
    avg(ID.rhr, "count/min", filter),
    avg(ID.hrv, "ms", filter),
    avg(ID.resp, "count/min", filter),
    avg(ID.spo2, "%", filter),
    latest(ID.weight, "kg"),
    latest(ID.bmi, "count"),
    getSleepHours(),
    getWorkouts(filter),
  ]);

  const snap: HealthSnapshot = {};
  if (steps != null) snap.steps = Math.round(steps);
  if (distanceM != null) snap.distance_km = Math.round((distanceM / 1000) * 100) / 100;
  if (active != null) snap.active_energy = Math.round(active);
  if (active != null || basal != null) snap.total_energy = Math.round((active ?? 0) + (basal ?? 0));
  if (hr != null) snap.heart_rate = Math.round(hr);
  if (rhr != null) snap.resting_heart_rate = Math.round(rhr);
  if (hrv != null) snap.hrv = Math.round(hrv);
  if (resp != null) snap.respiratory_rate = Math.round(resp * 10) / 10;
  if (spo2Raw != null) snap.spo2 = spo2Raw > 1 ? Math.round(spo2Raw) : Math.round(spo2Raw * 100);
  if (flights != null) snap.flights_climbed = Math.round(flights);
  if (stand != null) snap.stand_minutes = Math.round(stand);
  if (weight != null) snap.weight_kg = Math.round(weight * 10) / 10;
  if (bmi != null) snap.bmi = Math.round(bmi * 10) / 10;
  if (sleep != null) snap.sleep_hours = sleep;
  if (workouts.count > 0) {
    snap.workouts = workouts.count;
    snap.workout_minutes = workouts.minutes;
    snap.workout_types = workouts.types;
  }
  return snap;
}
