import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
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
  addPurchaseListeners,
  finishPurchase,
  getSubscriptions,
  initIap,
  requestSubscription,
  restoreAndCheck,
} from "@/src/lib/iap";

const ORIGIN = "https://drip-track-1.emergent.host";

export default function PremiumScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useI18n();
  const { token, user, setUser, refreshUser } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // --- StoreKit (iOS) ---
  const [products, setProducts] = useState<IapProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(IAP_ENABLED);
  const handledRef = useRef(false);

  const unlockPremium = async (payload: {
    product_id: string;
    transaction_id?: string;
    jws?: string;
  }) => {
    try {
      const updated = await verifyIapPurchase(payload, token);
      setUser(updated);
    } catch {
      // Backend /iap/verify not deployed yet — unlock optimistically so the
      // user isn't blocked. Source of truth becomes the backend once deployed.
      if (user) setUser({ ...user, is_premium: true });
    }
    setShowSuccess(true);
  };

  useEffect(() => {
    if (!IAP_ENABLED) return;
    let mounted = true;
    (async () => {
      await initIap();
      const subs = await getSubscriptions();
      if (mounted) {
        setProducts(subs);
        setLoadingProducts(false);
      }
    })();

    const unsub = addPurchaseListeners(
      async (purchase: any) => {
        if (handledRef.current) return;
        handledRef.current = true;
        const productId = purchase?.productId ?? purchase?.id ?? purchase?.ids?.[0] ?? "";
        const transactionId = purchase?.transactionId ?? purchase?.id;
        const jws = purchase?.purchaseToken ?? purchase?.jwsRepresentationIOS;
        await unlockPremium({ product_id: productId, transaction_id: transactionId, jws });
        await finishPurchase(purchase);
        setBusy(false);
        handledRef.current = false;
      },
      (err: any) => {
        setBusy(false);
        const code = err?.code || "";
        if (code !== "E_USER_CANCELLED" && code !== "user_cancelled") {
          toast.show(t("premium.failed"), "info");
        }
      },
    );

    return () => {
      mounted = false;
      unsub();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const buy = async (sku: string) => {
    setBusy(true);
    try {
      await requestSubscription(sku);
    } catch {
      setBusy(false);
      toast.show(t("premium.failed"), "info");
    }
  };

  const restore = async () => {
    setBusy(true);
    try {
      const ok = await restoreAndCheck();
      if (ok) {
        await unlockPremium({ product_id: "restore" });
        toast.show(t("premium.restoreDone"), "success");
      } else {
        toast.show(t("premium.restoreNone"), "info");
      }
    } finally {
      setBusy(false);
    }
  };

  // --- Stripe fallback (web / Android) ---
  const pollStatus = async (sessionId: string) => {
    for (let i = 0; i < 6; i++) {
      try {
        const s = await api.get(`/payments/checkout/status/${sessionId}`, token);
        if (s.payment_status === "paid" || s.status === "complete") {
          await refreshUser();
          setShowSuccess(true);
          return;
        }
      } catch {
        // ignore
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
    toast.show(t("premium.failed"), "info");
  };

  const subscribeStripe = async () => {
    setBusy(true);
    try {
      const res = await api.post("/payments/checkout/session", { kind: "premium", origin_url: ORIGIN }, token);
      if (res.url) {
        await WebBrowser.openBrowserAsync(res.url);
        await pollStatus(res.session_id);
      }
    } catch (e: any) {
      toast.show(e?.message || t("auth.errGeneric"), "error");
    } finally {
      setBusy(false);
    }
  };

  const features = [
    { icon: "infinite", text: t("premium.f1") },
    { icon: "stats-chart", text: t("premium.f2") },
    { icon: "trophy", text: t("premium.f3") },
    { icon: "heart", text: t("premium.f4") },
  ];

  const isYearly = (id: string) => id.toLowerCase().includes("year");

  return (
    <LinearGradient colors={[colors.gradTop, colors.gradBottom]} style={styles.flex}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + spacing.md }]}>
        <Pressable testID="premium-close" onPress={() => router.back()} style={styles.close} hitSlop={10}>
          <Ionicons name="close" size={26} color={colors.white} />
        </Pressable>

        <View style={styles.brand}>
          <Mascot size={96} />
          <Text style={styles.title}>{t("premium.title")}</Text>
          <Text style={styles.subtitle}>{t("premium.subtitle")}</Text>
        </View>

        <View style={styles.card}>
          {features.map((f) => (
            <View key={f.icon} style={styles.featureRow}>
              <View style={styles.featureIcon}>
                <Ionicons name={f.icon as any} size={20} color={colors.primary} />
              </View>
              <Text style={styles.featureText}>{f.text}</Text>
            </View>
          ))}

          {IAP_ENABLED ? (
            <>
              <Text style={styles.planLabel}>{t("premium.choosePlan")}</Text>
              {loadingProducts ? (
                <View style={styles.loadingBox}>
                  <ActivityIndicator color={colors.primary} />
                  <Text style={styles.loadingText}>{t("premium.loadingProducts")}</Text>
                </View>
              ) : products.length === 0 ? (
                <Text style={styles.loadingText}>{t("premium.iapUnavailable")}</Text>
              ) : (
                products.map((p) => (
                  <Pressable
                    key={p.id}
                    testID={`premium-plan-${isYearly(p.id) ? "yearly" : "monthly"}`}
                    onPress={() => buy(p.id)}
                    disabled={busy}
                    style={({ pressed }) => [
                      styles.planRow,
                      isYearly(p.id) && styles.planRowBest,
                      pressed && { opacity: 0.9 },
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.planTitle}>
                        {isYearly(p.id) ? t("premium.yearly") : t("premium.monthly")}
                      </Text>
                      {isYearly(p.id) && (
                        <View style={styles.badge}>
                          <Text style={styles.badgeText}>{t("premium.bestValue")}</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.planPriceCol}>
                      <Text style={styles.planPrice}>{p.displayPrice}</Text>
                      <Text style={styles.planPeriod}>
                        {isYearly(p.id) ? t("premium.perYear") : t("premium.perMonth")}
                      </Text>
                    </View>
                  </Pressable>
                ))
              )}

              {busy && <ActivityIndicator style={{ marginTop: spacing.md }} color={colors.primary} />}
            </>
          ) : (
            <Pressable
              testID="premium-subscribe-button"
              onPress={subscribeStripe}
              disabled={busy}
              style={({ pressed }) => [styles.cta, pressed && { opacity: 0.9 }]}
            >
              {busy ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <>
                  <Ionicons name="sparkles" size={18} color={colors.white} />
                  <Text style={styles.ctaText}>{t("premium.cta")}</Text>
                </>
              )}
            </Pressable>
          )}
        </View>

        {IAP_ENABLED && (
          <Pressable testID="premium-restore" onPress={restore} disabled={busy} style={styles.restoreBtnBottom}>
            <Text style={styles.restoreTextBottom}>{t("premium.restore")}</Text>
          </Pressable>
        )}
      </ScrollView>

      {showSuccess && <PremiumSuccess message={t("premium.congrats")} onDone={() => router.back()} />}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  close: { alignSelf: "flex-end", padding: spacing.xs },
  brand: { alignItems: "center", marginBottom: spacing.lg },
  title: { color: colors.white, fontSize: font.h1, fontWeight: "800", marginTop: spacing.sm, textAlign: "center" },
  subtitle: { color: "rgba(255,255,255,0.9)", fontSize: font.small, marginTop: spacing.xs, textAlign: "center" },
  card: { backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.lg, ...shadow.card },
  featureRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.md },
  featureIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  featureText: { flex: 1, fontSize: font.body, fontWeight: "600", color: colors.text },
  planLabel: {
    fontSize: font.tiny,
    fontWeight: "800",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  loadingBox: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.md },
  loadingText: { fontSize: font.small, color: colors.textMuted, paddingVertical: spacing.sm },
  planRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.cardAlt,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: spacing.md,
    minHeight: 60,
    marginBottom: spacing.sm,
  },
  planRowBest: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  planTitle: { fontSize: font.body, fontWeight: "800", color: colors.text },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    marginTop: 4,
  },
  badgeText: { color: colors.white, fontSize: 10, fontWeight: "800" },
  planPrice: { fontSize: font.h3, fontWeight: "800", color: colors.primaryDark },
  planPriceCol: { alignItems: "flex-end" },
  planPeriod: { fontSize: font.tiny, color: colors.textMuted, fontWeight: "600" },
  restoreBtnBottom: {
    alignSelf: "center",
    marginTop: spacing.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  restoreTextBottom: {
    color: "rgba(255,255,255,0.75)",
    fontSize: font.tiny,
    fontWeight: "600",
    textDecorationLine: "underline",
  },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    minHeight: 56,
    marginTop: spacing.md,
    ...shadow.button,
  },
  ctaText: { color: colors.white, fontSize: font.body, fontWeight: "800" },
});
