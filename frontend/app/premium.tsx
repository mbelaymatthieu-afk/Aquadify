import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Mascot } from "@/src/components/Mascot";
import { PremiumSuccess } from "@/src/components/PremiumSuccess";
import { useToast } from "@/src/components/Toast";
import { api } from "@/src/api/client";
import { verifyIapPurchase } from "@/src/api/account";
import { useAuth } from "@/src/context/AuthContext";
import { useI18n } from "@/src/i18n";
import { colors, font, radius, shadow, spacing } from "@/src/theme";
import {
  IAP_ENABLED,
  IapProduct,
  SKU_MONTHLY,
  SKU_YEARLY,
  addPurchaseListeners,
  finishPurchase,
  getSubscriptions,
  initIap,
  requestSubscription,
  restoreAndCheck,
} from "@/src/lib/iap";

const ORIGIN = "https://drip-track-1.emergent.host";

const FALLBACK_PLANS: IapProduct[] = [
  {
    id: SKU_MONTHLY,
    title: "Mensuel",
    displayPrice: "4,99 €",
    // App Store Connect: the MONTHLY plan has a 7-day free trial.
    hasFreeTrial: true,
    raw: null,
  },
  {
    id: SKU_YEARLY,
    title: "Annuel",
    displayPrice: "59,99 €",
    // App Store Connect: the YEARLY plan has NO free trial. Never simulate
    // trial eligibility locally — StoreKit remains the source of truth.
    hasFreeTrial: false,
    raw: null,
  },
];

export default function PremiumScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useI18n();
  const { token, user, setUser, refreshUser } = useAuth();
  const toast = useToast();

  const [busy, setBusy] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const [products, setProducts] = useState<IapProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(IAP_ENABLED);

  const handledRef = useRef(false);

  // Premium is unlocked ONLY by the backend after it verifies the StoreKit
  // transaction (JWS) and binds it to the currently authenticated account.
  // If verification fails, we throw and NEVER grant Premium locally — the
  // backend is the sole source of truth.
  const unlockPremium = async (payload: {
    product_id: string;
    transaction_id?: string;
    jws?: string;
  }) => {
    const updated = await verifyIapPurchase(payload, token);
    setUser(updated);
    setShowSuccess(true);
  };

  useEffect(() => {
    if (!IAP_ENABLED) return;

    let mounted = true;

    (async () => {
      const connected = await initIap();

      if (!mounted) return;

      if (!connected) {
        setLoadingProducts(false);
        return;
      }

      try {
        const subs = await getSubscriptions();

        if (!mounted) return;

        setProducts(subs);
        setLoadingProducts(false);
      } catch {
        if (!mounted) return;

        setLoadingProducts(false);
      }
    })();

    const unsub = addPurchaseListeners(
      async (purchase: any) => {
        if (handledRef.current) return;

        handledRef.current = true;

        const productId =
          purchase?.productId ??
          purchase?.id ??
          purchase?.ids?.[0] ??
          "";

        const transactionId =
          purchase?.transactionId ??
          purchase?.id;

        const jws =
          purchase?.purchaseToken ??
          purchase?.jwsRepresentationIOS;

        try {
          // Backend verifies the JWS and binds the subscription to THIS account.
          await unlockPremium({
            product_id: productId,
            transaction_id: transactionId,
            jws,
          });

          // Only finish the transaction once the backend confirmed ownership.
          await finishPurchase(purchase);
        } catch {
          // Backend not deployed yet / verification failed / not the owner:
          // never grant Premium locally. Fail safely with a clear message.
          toast.show(t("premium.verifyFailed"), "error");
        } finally {
          setBusy(false);
          handledRef.current = false;
        }
      },

      (err: any) => {
        setBusy(false);

        const code = err?.code || "";
        const message =
          err?.message || t("premium.failed");

        if (
          code !== "E_USER_CANCELLED" &&
          code !== "user_cancelled"
        ) {
          toast.show(message, "error");
        }
      }
    );

    return () => {
      mounted = false;
      unsub();
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const buy = async (sku: string) => {
    if (!IAP_ENABLED) {
      toast.show(t("premium.iapNeedsBuild"), "info");
      return;
    }

    setBusy(true);

    try {
      await requestSubscription(sku);
    } catch (e: any) {
      setBusy(false);

      toast.show(
        e?.message || t("premium.failed"),
        "error"
      );
    }
  };

  const restore = async () => {
    setBusy(true);

    try {
      // Trigger the native StoreKit restore. Restored transactions are emitted
      // through the purchase listener above, which forwards each JWS to the
      // backend (/iap/verify) with the current account's Bearer token so the
      // backend can validate the transaction and check ownership.
      // NOTE: restoreAndCheck() returns a DEVICE-LEVEL boolean — it is
      // intentionally IGNORED here and never used to grant Premium.
      await restoreAndCheck();

      // Let the listener-driven backend verification settle, then trust ONLY
      // the backend's account-level answer.
      await new Promise((r) => setTimeout(r, 1500));

      let confirmed = false;
      try {
        const me = await api.get<typeof user>("/auth/me", token);
        if (me) setUser(me as any);
        confirmed = !!me?.is_premium;
      } catch {
        confirmed = false;
      }

      if (confirmed) {
        setShowSuccess(true);
        toast.show(t("premium.restoreDone"), "success");
      } else {
        // Secure failure: never unlock Premium locally.
        toast.show(t("premium.restoreUnavailable"), "info");
      }
    } finally {
      setBusy(false);
    }
  };

  const pollStatus = async (sessionId: string) => {
    for (let i = 0; i < 6; i++) {
      try {
        const s = await api.get(
          `/payments/checkout/status/${sessionId}`,
          token
        );

        if (
          s.payment_status === "paid" ||
          s.status === "complete"
        ) {
          await refreshUser();
          setShowSuccess(true);
          return;
        }
      } catch {
        // ignore
      }

      await new Promise((r) =>
        setTimeout(r, 2000)
      );
    }

    toast.show(t("premium.failed"), "info");
  };

  const subscribeStripe = async () => {
    setBusy(true);

    try {
      const res = await api.post(
        "/payments/checkout/session",
        {
          kind: "premium",
          origin_url: ORIGIN,
        },
        token
      );

      if (res.url) {
        await WebBrowser.openBrowserAsync(res.url);
        await pollStatus(res.session_id);
      }
    } catch (e: any) {
      toast.show(
        e?.message || t("auth.errGeneric"),
        "error"
      );
    } finally {
      setBusy(false);
    }
  };

  const features = [
    {
      icon: "infinite",
      text: t("premium.f1"),
    },
    {
      icon: "stats-chart",
      text: t("premium.f2"),
    },
    {
      icon: "trophy",
      text: t("premium.f3"),
    },
    {
      icon: "heart",
      text: t("premium.f4"),
    },
  ];

  const isYearly = (id: string) =>
    id.toLowerCase().includes("year");

  const displayPlans =
    IAP_ENABLED && products.length > 0
      ? products
      : FALLBACK_PLANS;

  const onSelectPlan = (p: IapProduct) => {
    if (Platform.OS === "ios") {
      return buy(p.id);
    }

    return subscribeStripe();
  };

  return (
    <LinearGradient
      colors={[
        colors.gradTop,
        colors.gradBottom,
      ]}
      style={styles.flex}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          {
            paddingTop:
              insets.top + spacing.md,
          },
        ]}
      >
        <Pressable
          testID="premium-close"
          onPress={() => router.back()}
          style={styles.close}
          hitSlop={10}
        >
          <Ionicons
            name="close"
            size={26}
            color={colors.white}
          />
        </Pressable>

        <View style={styles.brand}>
          <Mascot size={96} />

          <Text style={styles.title}>
            {t("premium.title")}
          </Text>

          <Text style={styles.subtitle}>
            {t("premium.subtitle")}
          </Text>
        </View>

        <View style={styles.card}>
          {features.map((f) => (
            <View
              key={f.icon}
              style={styles.featureRow}
            >
              <View
                style={styles.featureIcon}
              >
                <Ionicons
                  name={f.icon as any}
                  size={20}
                  color={colors.primary}
                />
              </View>

              <Text style={styles.featureText}>
                {f.text}
              </Text>
            </View>
          ))}

          <Text style={styles.planLabel}>
            {t("premium.choosePlan")}
          </Text>

          {displayPlans.some(
            (p) => p.hasFreeTrial
          ) && (
            <View
              style={styles.trialHero}
              testID="premium-trial-hero"
            >
              <Ionicons
                name="gift"
                size={20}
                color={colors.white}
              />

              <Text style={styles.trialHeroText}>
                {t("premium.trialHero")}
              </Text>
            </View>
          )}

          {IAP_ENABLED && loadingProducts ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator
                color={colors.primary}
              />

              <Text style={styles.loadingText}>
                {t("premium.loadingProducts")}
              </Text>
            </View>
          ) : (
            displayPlans.map((p) => (
              <Pressable
                key={p.id}
                testID={`premium-plan-${
                  isYearly(p.id)
                    ? "yearly"
                    : "monthly"
                }`}
                onPress={() =>
                  onSelectPlan(p)
                }
                disabled={busy}
                style={({ pressed }) => [
                  styles.planRow,
                  isYearly(p.id) &&
                    styles.planRowBest,
                  pressed && {
                    opacity: 0.9,
                  },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.planTitle}>
                    {isYearly(p.id)
                      ? t("premium.yearly")
                      : t("premium.monthly")}
                  </Text>

                  <View style={styles.badgeRow}>
                    {isYearly(p.id) && (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>
                          {t("premium.bestValue")}
                        </Text>
                      </View>
                    )}

                    {p.hasFreeTrial && (
                      <View style={styles.trialBadge}>
                        <Text style={styles.trialBadgeText}>
                          {t("premium.trialBadge")}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>

                <View style={styles.planPriceCol}>
                  <Text style={styles.planPrice}>
                    {p.displayPrice}
                  </Text>

                  <Text style={styles.planPeriod}>
                    {isYearly(p.id)
                      ? t("premium.perYear")
                      : t("premium.perMonth")}
                  </Text>
                </View>
              </Pressable>
            ))
          )}

          {busy && (
            <ActivityIndicator
              style={{
                marginTop: spacing.md,
              }}
              color={colors.primary}
            />
          )}

          {displayPlans.some(
            (p) => p.hasFreeTrial
          ) && (
            <Text style={styles.trialNote}>
              {t("premium.trialNote")}
            </Text>
          )}

          <Text style={styles.cancelNote}>
            {t("premium.cancelNote")}
          </Text>
        </View>

        {IAP_ENABLED && user?.is_premium && (
          <Pressable
            testID="premium-manage"
            onPress={() =>
              Linking.openURL(
                "https://apps.apple.com/account/subscriptions"
              ).catch(() => {})
            }
            style={({ pressed }) => [
              styles.manageBtn,
              pressed && {
                opacity: 0.9,
              },
            ]}
          >
            <Ionicons
              name="settings-outline"
              size={18}
              color={colors.white}
            />

            <Text style={styles.manageBtnText}>
              {t("premium.manage")}
            </Text>
          </Pressable>
        )}

        {IAP_ENABLED && (
          <Pressable
            testID="premium-restore"
            onPress={restore}
            disabled={busy}
            style={styles.restoreBtnBottom}
          >
            <Text style={styles.restoreTextBottom}>
              {t("premium.restore")}
            </Text>
          </Pressable>
        )}
      </ScrollView>

      {showSuccess && (
        <PremiumSuccess
          message={t("premium.congrats")}
          onDone={() => router.back()}
        />
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },

  scroll: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },

  close: {
    alignSelf: "flex-end",
    padding: spacing.xs,
  },

  brand: {
    alignItems: "center",
    marginBottom: spacing.lg,
  },

  title: {
    color: colors.white,
    fontSize: font.h1,
    fontWeight: "800",
    marginTop: spacing.sm,
    textAlign: "center",
  },

  subtitle: {
    color: "rgba(255,255,255,0.9)",
    fontSize: font.small,
    marginTop: spacing.xs,
    textAlign: "center",
  },

  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    ...shadow.card,
  },

  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.md,
  },

  featureIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor:
      colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },

  featureText: {
    flex: 1,
    fontSize: font.body,
    fontWeight: "600",
    color: colors.text,
  },

  planLabel: {
    fontSize: font.tiny,
    fontWeight: "800",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },

  loadingBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },

  loadingText: {
    fontSize: font.small,
    color: colors.textMuted,
    paddingVertical: spacing.sm,
  },

  planRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent:
      "space-between",
    backgroundColor:
      colors.cardAlt,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: spacing.md,
    minHeight: 60,
    marginBottom: spacing.sm,
  },

  planRowBest: {
    borderColor: colors.primary,
    backgroundColor:
      colors.primarySoft,
  },

  planTitle: {
    fontSize: font.body,
    fontWeight: "800",
    color: colors.text,
  },

  badge: {
    alignSelf: "flex-start",
    backgroundColor:
      colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal:
      spacing.sm,
    paddingVertical: 2,
    marginTop: 4,
  },

  badgeText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: "800",
  },

  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 4,
  },

  trialBadge: {
    alignSelf: "flex-start",
    backgroundColor:
      colors.success,
    borderRadius: radius.pill,
    paddingHorizontal:
      spacing.sm,
    paddingVertical: 2,
  },

  trialBadgeText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: "800",
  },

  trialNote: {
    fontSize: font.tiny,
    color:
      colors.textSecondary,
    marginTop: spacing.md,
    lineHeight: 17,
    textAlign: "center",
  },

  cancelNote: {
    fontSize: font.tiny,
    color: colors.textMuted,
    marginTop: spacing.sm,
    lineHeight: 16,
    textAlign: "center",
  },

  planPrice: {
    fontSize: font.h3,
    fontWeight: "800",
    color: colors.primaryDark,
  },

  planPriceCol: {
    alignItems: "flex-end",
  },

  planPeriod: {
    fontSize: font.tiny,
    color: colors.textMuted,
    fontWeight: "600",
  },

  restoreBtnBottom: {
    alignSelf: "center",
    marginTop: spacing.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal:
      spacing.md,
  },

  restoreTextBottom: {
    color:
      "rgba(255,255,255,0.75)",
    fontSize: font.tiny,
    fontWeight: "600",
    textDecorationLine:
      "underline",
  },

  manageBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor:
      "rgba(255,255,255,0.18)",
    borderRadius: radius.pill,
    minHeight: 50,
    marginTop: spacing.lg,
    borderWidth: 1,
    borderColor:
      "rgba(255,255,255,0.35)",
  },

  manageBtnText: {
    color: colors.white,
    fontSize: font.small,
    fontWeight: "700",
  },

  trialHero: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor:
      colors.success,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal:
      spacing.md,
    marginBottom: spacing.sm,
  },

  trialHeroText: {
    flex: 1,
    color: colors.white,
    fontSize: font.small,
    fontWeight: "800",
  },
});