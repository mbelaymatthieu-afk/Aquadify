import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
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
import { verifyIapPurchase, restoreIapPurchase } from "@/src/api/account";
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
  getRestorablePurchases,
  getSubscriptions,
  initIap,
  openManageSubscriptions,
  requestSubscription,
} from "@/src/lib/iap";
import { accountAppAccountToken } from "@/src/lib/appAccountToken";

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
  const { token, user, setUser, refreshUser, ensureValidSession } = useAuth();
  const toast = useToast();

  // Stable per-account Apple appAccountToken (UUID). Recomputed cheaply from the
  // authenticated account id; identical across devices/reinstalls.
  const appAccountToken = accountAppAccountToken(user?.id ?? null);

  const [busy, setBusy] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const [products, setProducts] = useState<IapProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(IAP_ENABLED);
  // Currently selected plan (defaults to the yearly "best value" offer).
  const [selectedId, setSelectedId] = useState<string>(SKU_YEARLY);

  const handledRef = useRef(false);

  // Premium is unlocked ONLY by the backend after it verifies the StoreKit
  // transaction (JWS) and binds it to the currently authenticated account.
  // If verification fails, we throw and NEVER grant Premium locally — the
  // backend is the sole source of truth.
  const unlockPremium = async (payload: {
    product_id: string;
    transaction_id?: string;
    jws?: string;
    appAccountToken?: string | null;
  }) => {
    const updated = await verifyIapPurchase(payload, token);
    setUser(updated);
    // Re-sync from the backend (source of truth) after verification.
    try {
      await refreshUser();
    } catch {
      // non-fatal — setUser(updated) already reflects the verified state
    }
    setShowSuccess(true);
  };

  // Extract StoreKit fields from a purchase and verify it against the backend.
  // Shared by both the requestPurchase return value (primary) and the
  // purchaseUpdatedListener (fallback). Throws if verification fails.
  const processPurchase = async (purchase: any) => {
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

    await unlockPremium({
      product_id: productId,
      transaction_id: transactionId,
      jws,
      // Prefer the token StoreKit echoed back on the transaction; fall back to
      // the stable per-account UUID we computed.
      appAccountToken:
        purchase?.appAccountToken ??
        appAccountToken,
    });

    // Only finish once the backend confirmed ownership.
    await finishPurchase(purchase);
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
        // Fallback path. The primary path is buy() using requestPurchase's
        // return value; this listener still catches replayed/deferred
        // transactions (e.g. Ask-to-Buy, restores). handledRef de-dupes so a
        // purchase is never verified twice.
        if (handledRef.current) return;

        handledRef.current = true;

        try {
          await processPurchase(purchase);
        } catch {
          // Backend not deployed yet / verification failed / not the owner:
          // never grant Premium locally. Fail safely with a clear message.
          toast.show(t("premium.verifyFailed"), "error");
        } finally {
          setBusy(false);
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

    if (busy) return;

    setBusy(true);
    handledRef.current = false;

    try {
      // Ensure the Bearer token is present & valid (7-day expiry) BEFORE we
      // start an Apple purchase, so the transaction can be attached server-side.
      if (!(await requireSession())) return;

      // PRIMARY path: on iOS requestPurchase resolves with the completed
      // transaction. We verify it directly here so we never depend on the
      // purchaseUpdatedListener (which StoreKit de-duplicates and can suppress
      // for replayed/unfinished transactions). setBusy(false) is guaranteed in
      // the finally block, so the spinner can no longer get stuck.
      const result = await requestSubscription(sku, appAccountToken);
      const purchase = Array.isArray(result) ? result[0] : result;

      if (purchase && !handledRef.current) {
        handledRef.current = true;
        await processPurchase(purchase);
      }
      // If no purchase was returned (deferred/Ask-to-Buy), the listener
      // fallback above will handle it when the transaction arrives.
    } catch (e: any) {
      const code = e?.code || "";

      if (
        code !== "E_USER_CANCELLED" &&
        code !== "user_cancelled"
      ) {
        toast.show(
          e?.message || t("premium.verifyFailed"),
          "error"
        );
      }
    } finally {
      setBusy(false);
    }
  };

  const restore = async () => {
    if (busy) return;

    setBusy(true);

    try {
      // Ensure a valid (non-expired) Bearer token before /iap/restore.
      if (!(await requireSession())) return;

      // Fetch the REAL Apple transactions for this device (each carries a
      // signed StoreKit 2 JWS). Never trust device-level booleans for Premium.
      const purchases = await getRestorablePurchases();

      if (!purchases || purchases.length === 0) {
        toast.show(t("premium.restoreNone"), "info");
        return;
      }

      let restored = false;
      let conflict = false;

      for (const p of purchases) {
        const jws =
          p?.purchaseToken ?? p?.jwsRepresentationIOS;
        if (!jws) continue;

        try {
          // POST /iap/restore with EXACTLY signedTransaction + appAccountToken.
          const updated = await restoreIapPurchase(
            {
              jws,
              appAccountToken:
                p?.appAccountToken ?? appAccountToken,
            },
            token,
          );
          if (updated) setUser(updated);
          restored = true;
        } catch (e: any) {
          // 409 => this subscription is bound to another Aquadify account.
          if (e?.status === 409) conflict = true;
          // keep trying any other transactions
        }
      }

      if (restored) {
        // Backend is the source of truth — re-sync, never set is_premium here.
        await refreshUser();
        setShowSuccess(true);
        toast.show(t("premium.restoreDone"), "success");
      } else if (conflict) {
        toast.show(t("premium.restoreConflict"), "error");
      } else {
        toast.show(t("premium.restoreUnavailable"), "info");
      }
    } catch {
      toast.show(t("premium.restoreUnavailable"), "info");
    } finally {
      setBusy(false);
    }
  };

  const manageSubscription = async () => {
    try {
      // Native Apple subscription management (works during a free trial too).
      await openManageSubscriptions();
    } catch (e: any) {
      toast.show(
        e?.message || t("premium.failed"),
        "error",
      );
    }
  };

  // Guarantees a valid (non-expired) session before hitting /iap/verify or
  // /iap/restore. Session tokens expire after 7 days; if invalid we stop and
  // route the user to sign in again rather than starting an Apple flow.
  const requireSession = async (): Promise<boolean> => {
    const ok = await ensureValidSession();
    if (!ok) {
      toast.show(t("premium.sessionExpired"), "error");
      router.replace("/auth");
    }
    return ok;
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

  // Show StoreKit's localized price ONLY when it is already in euros (real
  // French storefront). On a non-EUR account (e.g. a US sandbox tester) StoreKit
  // returns dollars — in that case fall back to the exact configured euro
  // amounts so the paywall always shows 4,99 € / 59,99 €.
  const displayEuroPrice = (p: IapProduct) => {
    if (p.displayPrice && p.displayPrice.includes("€")) return p.displayPrice;
    return isYearly(p.id) ? "59,99 €" : "4,99 €";
  };

  const selectedPlan =
    displayPlans.find((p) => p.id === selectedId) ?? displayPlans[0];

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
                  setSelectedId(p.id)
                }
                disabled={busy}
                style={({ pressed }) => [
                  styles.planRow,
                  p.id === selectedId &&
                    styles.planRowSelected,
                  pressed && {
                    opacity: 0.9,
                  },
                ]}
              >
                <Ionicons
                  name={
                    p.id === selectedId
                      ? "radio-button-on"
                      : "radio-button-off"
                  }
                  size={22}
                  color={
                    p.id === selectedId
                      ? colors.primary
                      : colors.border
                  }
                  style={{ marginRight: spacing.sm }}
                />

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
                    {displayEuroPrice(p)}
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

          {!(IAP_ENABLED && loadingProducts) && (
            <Pressable
              testID="premium-subscribe"
              onPress={() =>
                selectedPlan &&
                onSelectPlan(selectedPlan)
              }
              disabled={busy || !selectedPlan}
              style={({ pressed }) => [
                styles.subscribeBtn,
                (busy || !selectedPlan) && {
                  opacity: 0.6,
                },
                pressed && { opacity: 0.9 },
              ]}
            >
              <Text style={styles.subscribeBtnText}>
                {selectedPlan?.hasFreeTrial
                  ? t("premium.ctaTrial")
                  : t("premium.cta")}
              </Text>
            </Pressable>
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
            onPress={manageSubscription}
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

  planRowSelected: {
    borderColor: colors.primary,
    backgroundColor:
      colors.primarySoft,
    borderWidth: 2,
  },

  subscribeBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    minHeight: 54,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.sm,
    ...shadow.card,
  },

  subscribeBtnText: {
    color: colors.white,
    fontSize: font.body,
    fontWeight: "800",
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