import Constants from "expo-constants";
import { useEffect, useState } from "react";
import { Platform, View } from "react-native";

import { useAuth } from "@/src/context/AuthContext";

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
        .catch((error: any) => {
          console.log("[AdMob] Initialisation impossible", error);
        });

      setAds(mod);
    } catch (error: any) {
      console.log("[AdMob] Module indisponible", error);
      setAds(null);
    }
  }, [isExpoGo]);

  if (isExpoGo) return null;
  if (!user || user.is_premium) return null;
  if (!Ads) return null;

  const { BannerAd, BannerAdSize } = Ads;

  const unitId =
    Platform.OS === "ios"
      ? BANNER_UNIT_IOS
      : BANNER_UNIT_ANDROID;

  return (
    <View
      style={{ alignItems: "center", paddingVertical: 8 }}
      testID="ad-banner"
    >
      <BannerAd
        unitId={unitId}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{
          requestNonPersonalizedAdsOnly: false,
        }}
        onAdFailedToLoad={(error: any) => {
          console.log("[AdMob] Erreur bannière", error);
        }}
      />
    </View>
  );
}