import Constants from "expo-constants";
import { Platform } from "react-native";

// App Tracking Transparency prompt (iOS 14.5+). Required before AdMob for
// App Store compliance. Native build only; no-op in Expo Go / web (.web.ts twin).
export async function requestTrackingPermission(): Promise<boolean> {
  if (Platform.OS !== "ios" || Constants.appOwnership === "expo") return true;
  try {
    const mod = require("expo-tracking-transparency");
    const current = await mod.getTrackingPermissionsAsync();
    if (current.status === "undetermined" && current.canAskAgain) {
      const res = await mod.requestTrackingPermissionsAsync();
      return res.status === "granted";
    }
    return current.status === "granted";
  } catch {
    return false;
  }
}
