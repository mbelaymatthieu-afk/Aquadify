import Constants from "expo-constants";

// Native-only AdMob initialization. Excluded from the web bundle via the
// .web.ts twin, and skipped in Expo Go where the native module is absent.
export function initAds() {
  if (Constants.appOwnership === "expo") return;
  try {
    require("react-native-google-mobile-ads").default().initialize();
  } catch {
    // module unavailable — safe to ignore
  }
}
