// Native-only AdMob banner. Shown ONLY for non-premium users on a real
// native build. Returns null in Expo Go and web (module unavailable there),
// so the app never crashes in preview/testing.
import Constants from "expo-constants";
import { useEffect, useState } from "react";
import { View } from "react-native";

import { useAuth } from "@/src/context/AuthContext";

const BANNER_UNIT_ID = "ca-app-pub-8009813538542789/9752960414";

export default function AdBanner() {
  const { user } = useAuth();
  const [Ads, setAds] = useState<any>(null);
  const isExpoGo = Constants.appOwnership === "expo";

  useEffect(() => {
    if (isExpoGo) return;
    try {
      const mod = require("react-native-google-mobile-ads");
      mod.default().initialize().catch(() => {});
      setAds(mod);
    } catch {
      setAds(null);
    }
  }, [isExpoGo]);

  if (isExpoGo) return null;
  if (!user || user.is_premium) return null;
  if (!Ads) return null;

  const { BannerAd, BannerAdSize, TestIds } = Ads;
  const unitId = __DEV__ ? TestIds.BANNER : BANNER_UNIT_ID;

  return (
    <View style={{ alignItems: "center", paddingVertical: 8 }} testID="ad-banner">
      <BannerAd unitId={unitId} size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER} />
    </View>
  );
}
