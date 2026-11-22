import { useEffect, useState } from "react";
import { Platform, View } from "react-native";

import { useAuth } from "@/src/context/AuthContext";
import { AdsState, prepareAds } from "@/src/lib/ads";

const BANNER_UNIT_IOS = "ca-app-pub-8009813538542789/9752960414";
const BANNER_UNIT_ANDROID = "ca-app-pub-8009813538542789/6405637532";

export default function AdBanner() {
  const { user } = useAuth();
  const [ads, setAds] = useState<AdsState | null>(null);
  const showAds = !!user && !user.is_premium;

  useEffect(() => {
    if (!showAds) return;
    let alive = true;
    prepareAds().then((state) => {
      if (alive) setAds(state);
    });
    return () => {
      alive = false;
    };
  }, [showAds]);

  if (!showAds || !ads) return null;

  const { BannerAd, BannerAdSize, TestIds } = ads.mod;
  const unitId = __DEV__ ? TestIds.BANNER : Platform.OS === "ios" ? BANNER_UNIT_IOS : BANNER_UNIT_ANDROID;

  return (
    <View style={{ alignItems: "center", paddingVertical: 8 }} testID="ad-banner">
      <BannerAd
        unitId={unitId}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{ requestNonPersonalizedAdsOnly: !ads.personalized }}
      />
    </View>
  );
}
