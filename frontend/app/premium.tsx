import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Mascot } from "@/src/components/Mascot";
import { useToast } from "@/src/components/Toast";
import { api } from "@/src/api/client";
import { useAuth } from "@/src/context/AuthContext";
import { useI18n } from "@/src/i18n";
import { colors, font, radius, shadow, spacing } from "@/src/theme";

const ORIGIN = "https://drip-track-1.emergent.host";

export default function PremiumScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useI18n();
  const { token, refreshUser } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const pollStatus = async (sessionId: string) => {
    for (let i = 0; i < 6; i++) {
      try {
        const s = await api.get(`/payments/checkout/status/${sessionId}`, token);
        if (s.payment_status === "paid" || s.status === "complete") {
          await refreshUser();
          toast.show(t("premium.success"), "success");
          router.back();
          return;
        }
      } catch {
        // ignore
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
    toast.show(t("premium.failed"), "info");
  };

  const subscribe = async () => {
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

          <Pressable
            testID="premium-subscribe-button"
            onPress={subscribe}
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
        </View>
      </ScrollView>
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
