import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useToast } from "@/src/components/Toast";
import { api } from "@/src/api/client";
import { useAuth } from "@/src/context/AuthContext";
import { useI18n } from "@/src/i18n";
import { HEALTH_ENABLED, TodayActivity, getTodayActivity, requestHealthAuth } from "@/src/lib/healthkit";
import { suggestedGoalWithActivity } from "@/src/lib/hydration";
import { colors, font, radius, shadow, spacing } from "@/src/theme";

export default function HealthScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useI18n();
  const { user, token, setUser } = useAuth();
  const toast = useToast();

  const premium = !!user?.is_premium;
  const [connected, setConnected] = useState<boolean>(!!(user as any)?.health_connected);
  const [busy, setBusy] = useState(false);
  const [activity, setActivity] = useState<TodayActivity | null>(null);

  const provider = Platform.OS === "ios" ? "apple_health" : "google_fit";
  const sectionTitle = Platform.OS === "ios" ? t("health.appleSection") : "Google Fit";
  const connectedLabel = Platform.OS === "ios" ? t("health.appleConnected") : t("health.connected");

  const profile = () => {
    const p = (user?.profile || {}) as any;
    return {
      weight: p.weight ?? 70,
      age: p.age ?? 30,
      sex: p.sex ?? "other",
      activity: p.activity ?? "moderate",
      climate: p.climate ?? "temperate",
    };
  };

  const suggested = activity ? suggestedGoalWithActivity(profile(), activity.steps, activity.activeEnergyKcal) : null;

  // Mocked backend connect flow (web / Android / Expo Go).
  const connectMock = async () => {
    setBusy(true);
    try {
      const updated = await api.post("/health/connect", { provider }, token);
      setUser(updated);
      setConnected(true);
      toast.show(t("health.connected"), "success");
    } catch (e: any) {
      toast.show(e?.message || t("auth.errGeneric"), "error");
    } finally {
      setBusy(false);
    }
  };

  // Real Apple HealthKit flow (iOS native build).
  const connectHealthKit = async () => {
    setBusy(true);
    try {
      const ok = await requestHealthAuth();
      if (!ok) {
        toast.show(t("health.permNeeded"), "error");
        return;
      }
      const data = await getTodayActivity();
      setActivity(data);
      setConnected(true);
      // Best-effort persist the "connected" flag (backend is mocked).
      try {
        const updated = await api.post("/health/connect", { provider }, token);
        setUser(updated);
      } catch {
        // ignore — connection still works locally
      }
      toast.show(t("health.connected"), "success");
    } catch (e: any) {
      toast.show(e?.message || t("auth.errGeneric"), "error");
    } finally {
      setBusy(false);
    }
  };

  const refresh = async () => {
    setBusy(true);
    try {
      const data = await getTodayActivity();
      setActivity(data);
    } finally {
      setBusy(false);
    }
  };

  const applyGoal = async () => {
    if (!suggested) return;
    setBusy(true);
    try {
      const updated = await api.put("/settings", { daily_goal_ml: suggested }, token);
      setUser(updated);
      toast.show(t("health.applied"), "success");
    } catch (e: any) {
      toast.show(e?.message || t("auth.errGeneric"), "error");
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setBusy(true);
    try {
      const updated = await api.post("/health/disconnect", {}, token);
      setUser(updated);
      setConnected(false);
      setActivity(null);
    } catch (e: any) {
      toast.show(e?.message || t("auth.errGeneric"), "error");
    } finally {
      setBusy(false);
    }
  };

  const benefits = [t("health.b1"), t("health.b2"), t("health.b3")];

  const StatCard = ({ icon, value, label }: { icon: any; value: string; label: string }) => (
    <View style={styles.statCard}>
      <Ionicons name={icon} size={20} color={colors.primary} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );

  return (
    <View style={[styles.flex, { backgroundColor: colors.bg }]}>
      <LinearGradient colors={[colors.gradTop, colors.gradBottom]} style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.headerRow}>
          <Pressable testID="health-back" onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={colors.white} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>{t("health.title")}</Text>
            <Text style={styles.headerSub}>{t("health.subtitle")}</Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}>
        <View style={styles.card}>
          {benefits.map((b, i) => (
            <View key={i} style={styles.benefitRow}>
              <View style={styles.benefitIcon}>
                <Ionicons name="checkmark" size={16} color={colors.primary} />
              </View>
              <Text style={styles.benefitText}>{b}</Text>
            </View>
          ))}
        </View>

        {!premium ? (
          <View style={styles.lockedCard} testID="health-locked">
            <Ionicons name="lock-closed" size={26} color={colors.primary} />
            <Text style={styles.lockedTitle}>{t("health.lockedTitle")}</Text>
            <Pressable testID="health-unlock" onPress={() => router.push("/premium")} style={styles.primaryBtn}>
              <Ionicons name="sparkles" size={18} color={colors.white} />
              <Text style={styles.primaryBtnText}>{t("health.unlock")}</Text>
            </Pressable>
          </View>
        ) : HEALTH_ENABLED && connected && activity ? (
          <View style={styles.card} testID="health-connected">
            <View style={styles.sectionHead}>
              <View style={styles.appleIcon}>
                <Ionicons name="heart" size={18} color="#FF2D55" />
              </View>
              <Text style={styles.sectionTitle}>{sectionTitle}</Text>
            </View>
            <View style={styles.connectedRow}>
              <Ionicons name="checkmark-circle" size={22} color={colors.success} />
              <Text style={styles.connectedText}>{connectedLabel}</Text>
            </View>

            <View style={styles.statsRow}>
              <StatCard icon="walk" value={`${activity.steps}`} label={t("health.steps")} />
              <StatCard icon="flame" value={`${activity.activeEnergyKcal}`} label={t("health.energy")} />
              <StatCard icon="barbell" value={`${activity.workouts}`} label={t("health.workouts")} />
            </View>

            {suggested != null && (
              <View style={styles.suggestBox}>
                <Text style={styles.suggestLabel}>{t("health.suggested")}</Text>
                <Text style={styles.suggestValue}>{suggested} ml</Text>
              </View>
            )}

            <Pressable testID="health-apply" onPress={applyGoal} disabled={busy} style={styles.primaryBtn}>
              {busy ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <>
                  <Ionicons name="checkmark-done" size={18} color={colors.white} />
                  <Text style={styles.primaryBtnText}>{t("health.apply")}</Text>
                </>
              )}
            </Pressable>

            <Pressable testID="health-refresh" onPress={refresh} disabled={busy} style={styles.ghostBtn}>
              <Text style={styles.ghostBtnPrimary}>{t("health.refresh")}</Text>
            </Pressable>
            <Pressable testID="health-disconnect" onPress={disconnect} disabled={busy} style={styles.ghostBtn}>
              <Text style={styles.ghostBtnText}>{t("health.disconnect")}</Text>
            </Pressable>
          </View>
        ) : connected ? (
          <View style={styles.card} testID="health-connected">
            <View style={styles.sectionHead}>
              <View style={styles.appleIcon}>
                <Ionicons name="heart" size={18} color="#FF2D55" />
              </View>
              <Text style={styles.sectionTitle}>{sectionTitle}</Text>
            </View>
            <View style={styles.connectedRow}>
              <Ionicons name="checkmark-circle" size={22} color={colors.success} />
              <Text style={styles.connectedText}>{connectedLabel}</Text>
            </View>
            <Text style={styles.note}>{t("health.connectedBody")}</Text>
            <Pressable testID="health-disconnect" onPress={disconnect} disabled={busy} style={styles.ghostBtn}>
              <Text style={styles.ghostBtnText}>{t("health.disconnect")}</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.card}>
            <View style={styles.sectionHead}>
              <View style={styles.appleIcon}>
                <Ionicons name={Platform.OS === "ios" ? "heart" : "fitness"} size={18} color={Platform.OS === "ios" ? "#FF2D55" : colors.primary} />
              </View>
              <Text style={styles.sectionTitle}>{sectionTitle}</Text>
            </View>
            <Text style={styles.note}>{t("health.appleExplain")}</Text>
            <Pressable
              testID="health-connect"
              onPress={HEALTH_ENABLED ? connectHealthKit : connectMock}
              disabled={busy}
              style={styles.primaryBtn}
            >
              {busy ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <>
                  <Ionicons name={Platform.OS === "ios" ? "heart" : "fitness"} size={18} color={colors.white} />
                  <Text style={styles.primaryBtnText}>
                    {Platform.OS === "ios" ? t("health.connectApple") : t("health.connectGoogle")}
                  </Text>
                </>
              )}
            </Pressable>
            <Text style={styles.note}>{t("health.note")}</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { paddingHorizontal: spacing.md, paddingBottom: spacing.md, borderBottomLeftRadius: radius.lg, borderBottomRightRadius: radius.lg },
  headerRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerTitle: { color: colors.white, fontSize: font.h2, fontWeight: "800" },
  headerSub: { color: "rgba(255,255,255,0.85)", fontSize: font.tiny },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md, ...shadow.soft },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm },
  appleIcon: { width: 34, height: 34, borderRadius: radius.pill, backgroundColor: colors.cardAlt, alignItems: "center", justifyContent: "center" },
  sectionTitle: { fontSize: font.h3, fontWeight: "800", color: colors.text },
  benefitRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm },
  benefitIcon: { width: 30, height: 30, borderRadius: radius.pill, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" },
  benefitText: { flex: 1, fontSize: font.small, color: colors.text, fontWeight: "600" },
  lockedCard: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, alignItems: "center", gap: spacing.sm, ...shadow.soft },
  lockedTitle: { fontSize: font.h3, fontWeight: "800", color: colors.text },
  primaryBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.primary, borderRadius: radius.pill, minHeight: 52, paddingHorizontal: spacing.lg, marginTop: spacing.sm, ...shadow.button },
  primaryBtnText: { color: colors.white, fontSize: font.body, fontWeight: "700" },
  connectedRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  connectedText: { fontSize: font.h3, fontWeight: "800", color: colors.text },
  statsRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  statCard: {
    flex: 1,
    backgroundColor: colors.cardAlt,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: "center",
    gap: 4,
  },
  statValue: { fontSize: font.h3, fontWeight: "800", color: colors.text },
  statLabel: { fontSize: font.tiny, color: colors.textMuted, fontWeight: "600" },
  suggestBox: {
    marginTop: spacing.md,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: "center",
  },
  suggestLabel: { fontSize: font.tiny, color: colors.primaryDark, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1 },
  suggestValue: { fontSize: font.hero, fontWeight: "800", color: colors.primaryDark, letterSpacing: -1 },
  note: { fontSize: font.tiny, color: colors.textMuted, marginTop: spacing.sm, lineHeight: 17 },
  ghostBtn: { marginTop: spacing.md, alignItems: "center", paddingVertical: spacing.sm },
  ghostBtnText: { color: colors.danger, fontWeight: "700", fontSize: font.small },
  ghostBtnPrimary: { color: colors.primary, fontWeight: "700", fontSize: font.small },
});
