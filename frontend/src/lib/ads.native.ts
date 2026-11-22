import Constants from "expo-constants";

import { requestTrackingPermission } from "@/src/lib/tracking";

export type AdsState = { mod: any; personalized: boolean };

let setup: Promise<AdsState | null> | null = null;

async function runSetup(): Promise<AdsState | null> {
  const mod = require("react-native-google-mobile-ads");
  const consent = await mod.AdsConsent.gatherConsent();
  if (!consent.canRequestAds) return null;
  const trackingAllowed = await requestTrackingPermission();
  await mod.default().initialize();
  const choices = await mod.AdsConsent.getUserChoices();
  return { mod, personalized: trackingAllowed && !!choices.selectPersonalisedAds };
}

// GDPR consent, then the iOS tracking prompt, then the AdMob SDK. Runs once.
export function prepareAds(): Promise<AdsState | null> {
  if (Constants.appOwnership === "expo") return Promise.resolve(null);
  setup = setup ?? runSetup().catch(() => {
    setup = null;
    return null;
  });
  return setup;
}
