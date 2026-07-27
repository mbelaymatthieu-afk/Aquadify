// Native-only AdMob banner. Shown ONLY for non-premium users on a real
// native build. Returns null in Expo Go and web (module unavailable there),
// so the app never crashes in preview/testing.
import Constants from "expo-constants";
import { useEffect, useState } from "react";
import { Platform, View } from "react-native";

import { useAuth } from "@/src/context/AuthContext";

// Platform-specific production banner ad units (AdMob).
const BANNER_UNIT_IOS = "ca-app-pub-8009813538542789/9752960414";
const BANNER_UNIT_ANDROID = "ca-app-pub-8009813538542789/6405637532";

export default function AdBanner() {
  const { user } = useAuth();
  const [Ads, setAds] = useState<any>(null);
  const isExpoGo = Constants.appOwnership === "expo";

  useEffect(() => {
    if (isExpoGo) return;
    try {
      const mod = require("react-native-google-mobile-ads");
      mod
        .default()
        .initialize()
        .then((statuses: any) => {
          console.log("[AdMob] SDK initialized", JSON.stringify(statuses));
        })
        .catch((e: any) => {
          console.log("[AdMob] init failed:", e?.message || e);
        });
      setAds(mod);
    } catch (e: any) {
      console.log("[AdMob] module unavailable:", e?.message || e);
      setAds(null);
    }
  }, [isExpoGo]);

  if (isExpoGo) return null;
  if (!user || user.is_premium) return null; // no ads for Premium users
  if (!Ads) return null;

  const { BannerAd, BannerAdSize, TestIds } = Ads;
  const prodUnit = Platform.OS === "ios" ? BANNER_UNIT_IOS : BANNER_UNIT_ANDROID;
  // Google requires TEST ads during development to avoid policy strikes.
  const unitId = __DEV__ ? TestIds.BANNER : prodUnit;

  return (
    <View style={{ alignItems: "center", paddingVertical: 8 }} testID="ad-banner">
      <BannerAd
        unitId={unitId}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{ requestNonPersonalizedAdsOnly: false }}
        onAdLoaded={() => console.log("[AdMob] banner loaded", unitId)}
        onAdFailedToLoad={(error: any) =>
          console.log(
            "[AdMob] banner FAILED to load:",
            error?.code || "",
            error?.message || String(error),
          )
        }
      />
    </View>
  );
}
