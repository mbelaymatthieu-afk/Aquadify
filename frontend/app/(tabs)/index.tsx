import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { WaterDropProgress } from "@/src/components/WaterDropProgress";
import { useToast } from "@/src/components/Toast";
import { api } from "@/src/api/client";
import { useAuth } from "@/src/context/AuthContext";
import { useI18n } from "@/src/i18n";
import { colors, font, radius, shadow, spacing } from "@/src/theme";

type Log = { id: string; amount_ml: number; container: string; timestamp: string };

const CONTAINER_ICON: Record<string, string> = {
  glass: "cup-outline",
  cup: "coffee-outline",
  bottle: "bottle-soda-outline",
  large_bottle: "bottle-tonic-outline",
};

export default function TodayScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const { token, user } = useAuth();
  const toast = useToast();
  const router = useRouter();

  const [total, setTotal] = useState(0);
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [customVal, setCustomVal] = useState("");

  const goal = user?.daily_goal_ml || 2000;

  const load = useCallback(async () => {
    try {
      const data = await api.get("/hydration/today", token);
      setTotal(data.total_ml || 0);
      setLogs(data.logs || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const addWater = async (amount: number, label: string) => {
    if (adding) return;
    setAdding(true);
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await api.post("/hydration/log", { amount_ml: amount, label }, token);
      toast.show(t("today.addedToast", { ml: amount }), "success");
      await load();
    } catch (e: any) {
      toast.show(e?.message || t("auth.errGeneric"), "error");
    } finally {
      setAdding(false);
    }
  };

  const deleteLog = async (id: string) => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await api.del(`/hydration/log/${id}`, token);
      toast.show(t("today.deletedToast"), "info");
      await load();
    } catch (e: any) {
      toast.show(e?.message || t("auth.errGeneric"), "error");
    }
  };

  const confirmCustom = async () => {
    const v = parseInt(customVal, 10);
    if (!v || v <= 0) return;
    setCustomOpen(false);
    setCustomVal("");
    await addWater(v, "custom");
  };

  const progress = goal > 0 ? total / goal : 0;
  const remaining = Math.max(0, goal - total);
  const reached = total >= goal;

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={[styles.flex, { backgroundColor: colors.bg }]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: spacing.xxl }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={colors.primary}
          />
        }
      >
        {/* header */}
        <LinearGradient
          colors={[colors.gradTop, colors.gradBottom]}
          style={[styles.header, { paddingTop: insets.top + spacing.md }]}
        >
          <Text style={styles.hello}>
            {t("today.hello")}, {user?.name?.split(" ")[0] || ""} 👋
          </Text>
          <Text style={styles.headerSub}>{t("today.subtitle")}</Text>

          <View style={styles.dropWrap}>
            <WaterDropProgress progress={progress} total={total} goal={goal} size={210} />
          </View>

          <View style={styles.statusPill}>
            <Ionicons
              name={reached ? "checkmark-circle" : "water"}
              size={16}
              color={reached ? colors.success : colors.white}
            />
            <Text style={styles.statusText}>
              {reached ? t("today.goalReached") : t("today.remaining", { ml: remaining })}
            </Text>
          </View>
        </LinearGradient>

        {/* quick add */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("today.quickAdd")}</Text>
          <View style={styles.grid}>
            {(user?.containers || []).map((c) => (
              <Pressable
                key={c.label}
                testID={`quick-add-${c.label}`}
                onPress={() => addWater(c.amount, c.label)}
                style={({ pressed }) => [styles.containerBtn, pressed && styles.pressed]}
              >
                <View style={styles.containerIcon}>
                  <MaterialCommunityIcons
                    name={(CONTAINER_ICON[c.label] || "cup-water") as any}
                    size={26}
                    color={colors.primary}
                  />
                </View>
                <Text style={styles.containerLabel}>{t(`today.${c.label}`)}</Text>
                <Text style={styles.containerAmount}>{c.amount} ml</Text>
              </Pressable>
            ))}
            <Pressable
              testID="quick-add-custom"
              onPress={() => setCustomOpen(true)}
              style={({ pressed }) => [styles.containerBtn, styles.customBtn, pressed && styles.pressed]}
            >
              <View style={[styles.containerIcon, { backgroundColor: colors.primarySoft }]}>
                <Ionicons name="add" size={28} color={colors.primary} />
              </View>
              <Text style={styles.containerLabel}>{t("today.custom")}</Text>
              <Text style={styles.containerAmount}>ml</Text>
            </Pressable>
          </View>
        </View>

        {/* water points entry */}
        <View style={styles.section}>
          <Pressable testID="today-waterpoints" onPress={() => router.push("/water-points")} style={styles.wpCard}>
            <View style={styles.wpCardIcon}>
              <Ionicons name="location" size={22} color={colors.white} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.wpCardTitle}>{t("waterPoints.title")}</Text>
              <Text style={styles.wpCardSub}>{t("waterPoints.subtitle")}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </Pressable>
        </View>

        {/* today's logs */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("today.todayLogs")}</Text>
          {logs.length === 0 ? (
            <View style={styles.emptyBox}>
              <Ionicons name="water-outline" size={32} color={colors.textMuted} />
              <Text style={styles.emptyText}>{t("today.noLogs")}</Text>
            </View>
          ) : (
            logs
              .slice()
              .reverse()
              .map((log) => (
                <View key={log.id} testID={`log-row-${log.id}`} style={styles.logRow}>
                  <View style={styles.logIcon}>
                    <MaterialCommunityIcons
                      name={(CONTAINER_ICON[log.container] || "cup-water") as any}
                      size={20}
                      color={colors.primary}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.logAmount}>{log.amount_ml} ml</Text>
                    <Text style={styles.logTime}>
                      {new Date(log.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Text>
                  </View>
                  <Pressable
                    testID={`log-delete-${log.id}`}
                    onPress={() => deleteLog(log.id)}
                    hitSlop={10}
                    style={styles.deleteBtn}
                  >
                    <Ionicons name="close" size={18} color={colors.danger} />
                  </Pressable>
                </View>
              ))
          )}
        </View>
      </ScrollView>

      {/* custom amount modal */}
      <Modal visible={customOpen} transparent animationType="fade" onRequestClose={() => setCustomOpen(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <View style={styles.modalCard} testID="custom-amount-modal">
            <Text style={styles.modalTitle}>{t("today.customTitle")}</Text>
            <TextInput
              testID="custom-amount-input"
              value={customVal}
              onChangeText={setCustomVal}
              keyboardType="numeric"
              placeholder={t("today.customAmount")}
              placeholderTextColor={colors.textMuted}
              style={styles.modalInput}
              autoFocus
            />
            <View style={styles.modalRow}>
              <Pressable
                testID="custom-cancel"
                onPress={() => setCustomOpen(false)}
                style={[styles.modalBtn, styles.modalBtnGhost]}
              >
                <Text style={styles.modalBtnGhostText}>{t("common.cancel")}</Text>
              </Pressable>
              <Pressable testID="custom-confirm" onPress={confirmCustom} style={[styles.modalBtn, styles.modalBtnPrimary]}>
                <Text style={styles.modalBtnPrimaryText}>{t("today.add")}</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
    alignItems: "center",
  },
  hello: { color: colors.white, fontSize: font.h2, fontWeight: "800", alignSelf: "flex-start" },
  headerSub: { color: "rgba(255,255,255,0.85)", fontSize: font.small, alignSelf: "flex-start", marginTop: 2 },
  dropWrap: { marginTop: spacing.sm },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
    marginTop: spacing.sm,
  },
  statusText: { color: colors.white, fontSize: font.small, fontWeight: "700" },
  section: { paddingHorizontal: spacing.lg, marginTop: spacing.lg },
  sectionTitle: { fontSize: font.h3, fontWeight: "800", color: colors.text, marginBottom: spacing.md },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  containerBtn: {
    width: "31%",
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: "center",
    ...shadow.soft,
  },
  customBtn: { borderWidth: 1.5, borderColor: colors.primarySoft, borderStyle: "dashed" },
  containerIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.cardAlt,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xs,
  },
  containerLabel: { fontSize: font.tiny, fontWeight: "700", color: colors.text, textAlign: "center" },
  containerAmount: { fontSize: font.tiny, color: colors.textMuted, marginTop: 2 },
  pressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },
  emptyBox: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: "center",
    gap: spacing.sm,
    ...shadow.soft,
  },
  emptyText: { color: colors.textMuted, fontSize: font.small, textAlign: "center" },
  wpCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, ...shadow.soft },
  wpCardIcon: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  wpCardTitle: { fontSize: font.body, fontWeight: "800", color: colors.text },
  wpCardSub: { fontSize: font.tiny, color: colors.textMuted, marginTop: 2 },
  logRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadow.soft,
  },
  logIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  logAmount: { fontSize: font.body, fontWeight: "700", color: colors.text },
  logTime: { fontSize: font.tiny, color: colors.textMuted },
  deleteBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
  },
  modalOverlay: { flex: 1, backgroundColor: colors.overlay, alignItems: "center", justifyContent: "center", padding: spacing.lg },
  modalCard: { backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.lg, width: "100%", ...shadow.card },
  modalTitle: { fontSize: font.h3, fontWeight: "800", color: colors.text, marginBottom: spacing.md },
  modalInput: {
    backgroundColor: colors.cardAlt,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    fontSize: font.h3,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    textAlign: "center",
  },
  modalRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  modalBtn: { flex: 1, minHeight: 50, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  modalBtnGhost: { backgroundColor: colors.cardAlt },
  modalBtnGhostText: { color: colors.textSecondary, fontWeight: "700" },
  modalBtnPrimary: { backgroundColor: colors.primary },
  modalBtnPrimaryText: { color: colors.white, fontWeight: "700" },
});
