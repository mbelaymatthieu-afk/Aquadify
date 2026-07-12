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

  const provider = Platform.OS === "ios" ? "apple_health" : "google_fit";

  const connect = async () => {
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

  const disconnect = async () => {
    setBusy(true);
    try {
      const updated = await api.post("/health/disconnect", {}, token);
      setUser(updated);
      setConnected(false);
    } catch (e: any) {
      toast.show(e?.message || t("auth.errGeneric"), "error");
    } finally {
      setBusy(false);
    }
  };

  const benefits = [t("health.b1"), t("health.b2"), t("health.b3")];

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
        ) : connected ? (
          <View style={styles.card} testID="health-connected">
            <View style={styles.connectedRow}>
              <Ionicons name="fitness" size={22} color={colors.success} />
              <Text style={styles.connectedText}>{t("health.connected")}</Text>
            </View>
            <Text style={styles.note}>{t("health.connectedBody")}</Text>
            <Pressable testID="health-disconnect" onPress={disconnect} disabled={busy} style={styles.ghostBtn}>
              <Text style={styles.ghostBtnText}>{t("health.disconnect")}</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.card}>
            <Pressable testID="health-connect" onPress={connect} disabled={busy} style={styles.primaryBtn}>
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
  benefitRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm },
  benefitIcon: { width: 30, height: 30, borderRadius: radius.pill, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" },
  benefitText: { flex: 1, fontSize: font.small, color: colors.text, fontWeight: "600" },
  lockedCard: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, alignItems: "center", gap: spacing.sm, ...shadow.soft },
  lockedTitle: { fontSize: font.h3, fontWeight: "800", color: colors.text },
  primaryBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.primary, borderRadius: radius.pill, minHeight: 52, paddingHorizontal: spacing.lg, marginTop: spacing.sm, ...shadow.button },
  primaryBtnText: { color: colors.white, fontSize: font.body, fontWeight: "700" },
  connectedRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  connectedText: { fontSize: font.h3, fontWeight: "800", color: colors.text },
  note: { fontSize: font.tiny, color: colors.textMuted, marginTop: spacing.sm, lineHeight: 17 },
  ghostBtn: { marginTop: spacing.md, alignItems: "center", paddingVertical: spacing.sm },
  ghostBtnText: { color: colors.danger, fontWeight: "700", fontSize: font.small },
});
