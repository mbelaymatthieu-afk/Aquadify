import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useToast } from "@/src/components/Toast";
import AdBanner from "@/src/components/AdBanner";
import { api } from "@/src/api/client";
import { useAuth } from "@/src/context/AuthContext";
import { useI18n } from "@/src/i18n";
import { LANGS } from "@/src/i18n/translations";
import { ensureNotificationPermission, scheduleHydrationReminders } from "@/src/lib/reminders";
import { colors, font, radius, shadow, spacing } from "@/src/theme";

const INTERVALS = [60, 90, 120, 180];
const START_HOURS = [6, 7, 8, 9];
const END_HOURS = [20, 21, 22, 23];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t, lang, setLang } = useI18n();
  const { user, setUser, token, logout } = useAuth();
  const toast = useToast();

  const [goal, setGoal] = useState(user?.daily_goal_ml || 2000);
  const [saving, setSaving] = useState(false);

  if (!user) return null;

  const save = async (patch: any, successMsg?: string) => {
    setSaving(true);
    try {
      const updated = await api.put("/settings", patch, token);
      setUser(updated);
      if (successMsg) toast.show(successMsg, "success");
      return updated;
    } catch (e: any) {
      toast.show(e?.message || t("auth.errGeneric"), "error");
    } finally {
      setSaving(false);
    }
  };

  const changeGoal = (delta: number) => {
    const next = Math.max(500, Math.min(6000, goal + delta));
    setGoal(next);
    save({ daily_goal_ml: next });
  };

  const changeLang = (code: any) => {
    setLang(code);
    save({ language: code });
  };

  const reschedule = async (s: any) => {
    await scheduleHydrationReminders(
      {
        reminders_enabled: s.reminders_enabled,
        reminder_interval: s.reminder_interval,
        reminder_start: s.reminder_start,
        reminder_end: s.reminder_end,
      },
      t("today.subtitle"),
    );
  };

  const toggleReminders = async (val: boolean) => {
    if (val) {
      const perm = await ensureNotificationPermission();
      if (!perm.granted) {
        toast.show(t("profile.permBody"), "error");
        if (!perm.canAskAgain && Platform.OS !== "web") {
          setTimeout(() => Linking.openSettings(), 600);
        }
        return;
      }
    }
    const updated = await save({ reminders_enabled: val });
    if (updated) reschedule(updated);
  };

  const setInterval = async (n: number) => {
    const updated = await save({ reminder_interval: n });
    if (updated && updated.reminders_enabled) reschedule(updated);
  };

  const setWindow = async (patch: any) => {
    const updated = await save(patch);
    if (updated && updated.reminders_enabled) reschedule(updated);
  };

  return (
    <View style={[styles.flex, { backgroundColor: colors.bg }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxl }} showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={[colors.gradTop, colors.gradBottom]}
          style={[styles.header, { paddingTop: insets.top + spacing.lg }]}
        >
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(user.name || "?").charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={styles.name}>{user.name}</Text>
          <Text style={styles.email}>{user.email}</Text>
          {user.is_premium && (
            <View style={styles.premiumBadge}>
              <Ionicons name="sparkles" size={14} color={colors.gold} />
              <Text style={styles.premiumBadgeText}>{t("profile.premiumActive")}</Text>
            </View>
          )}
        </LinearGradient>

        {/* daily goal */}
        <Section title={t("profile.dailyGoal")}>
          <View style={styles.goalRow}>
            <Pressable testID="goal-minus" onPress={() => changeGoal(-100)} style={styles.stepBtn}>
              <Ionicons name="remove" size={22} color={colors.primary} />
            </Pressable>
            <View style={styles.goalCenter}>
              <Text style={styles.goalValue}>{goal}</Text>
              <Text style={styles.goalUnit}>{t("profile.goalUnit")}</Text>
            </View>
            <Pressable testID="goal-plus" onPress={() => changeGoal(100)} style={styles.stepBtn}>
              <Ionicons name="add" size={22} color={colors.primary} />
            </Pressable>
          </View>
        </Section>

        {/* language */}
        <Section title={t("profile.language")}>
          <View style={styles.langRow}>
            {LANGS.map((l) => (
              <Pressable
                key={l.code}
                testID={`profile-lang-${l.code}`}
                onPress={() => changeLang(l.code)}
                style={[styles.langChip, lang === l.code && styles.chipActive]}
              >
                <Text style={styles.langFlag}>{l.flag}</Text>
                <Text style={[styles.chipText, lang === l.code && styles.chipTextActive]}>{l.label}</Text>
              </Pressable>
            ))}
          </View>
        </Section>

        {/* reminders */}
        <Section title={t("profile.reminders")}>
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>{t("profile.remindersEnabled")}</Text>
              <Text style={styles.rowHint}>{t("profile.remindersHint")}</Text>
            </View>
            <Switch
              testID="reminders-switch"
              value={user.reminders_enabled}
              onValueChange={toggleReminders}
              trackColor={{ true: colors.primary, false: colors.border }}
              thumbColor={colors.white}
            />
          </View>

          {user.reminders_enabled && (
            <>
              <Text style={styles.subLabel}>{t("profile.interval")}</Text>
              <View style={styles.chipsWrap}>
                {INTERVALS.map((n) => (
                  <Pressable
                    key={n}
                    testID={`interval-${n}`}
                    onPress={() => setInterval(n)}
                    style={[styles.smallChip, user.reminder_interval === n && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, user.reminder_interval === n && styles.chipTextActive]}>
                      {t("profile.everyMin", { n })}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.subLabel}>{t("profile.window")}</Text>
              <View style={styles.windowRow}>
                <Text style={styles.windowLabel}>{t("profile.from")}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hChips}>
                  {START_HOURS.map((h) => {
                    const val = `${String(h).padStart(2, "0")}:00`;
                    return (
                      <Pressable
                        key={h}
                        testID={`start-${h}`}
                        onPress={() => setWindow({ reminder_start: val })}
                        style={[styles.timeChip, user.reminder_start === val && styles.chipActive]}
                      >
                        <Text style={[styles.chipText, user.reminder_start === val && styles.chipTextActive]}>
                          {val}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
              <View style={styles.windowRow}>
                <Text style={styles.windowLabel}>{t("profile.to")}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hChips}>
                  {END_HOURS.map((h) => {
                    const val = `${String(h).padStart(2, "0")}:00`;
                    return (
                      <Pressable
                        key={h}
                        testID={`end-${h}`}
                        onPress={() => setWindow({ reminder_end: val })}
                        style={[styles.timeChip, user.reminder_end === val && styles.chipActive]}
                      >
                        <Text style={[styles.chipText, user.reminder_end === val && styles.chipTextActive]}>
                          {val}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            </>
          )}
        </Section>

        {/* premium */}
        <View style={styles.section}>
          {user.is_premium ? (
            <View style={[styles.card, styles.premiumActiveCard]}>
              <Ionicons name="sparkles" size={22} color={colors.gold} />
              <View style={{ flex: 1 }}>
                <Text style={styles.rowLabel}>{t("profile.premiumActive")}</Text>
                <Text style={styles.rowHint}>{t("profile.premiumHint")}</Text>
              </View>
            </View>
          ) : (
            <Pressable testID="profile-premium-button" onPress={() => router.push("/premium")} style={styles.premiumCta}>
              <Ionicons name="sparkles" size={20} color={colors.white} />
              <View style={{ flex: 1 }}>
                <Text style={styles.premiumCtaTitle}>{t("profile.getPremium")}</Text>
                <Text style={styles.premiumCtaSub}>{t("profile.premiumHint")}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.white} />
            </Pressable>
          )}
        </View>

        {/* more */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("profile.preferences")}</Text>
          <View style={styles.card}>
            <Pressable testID="link-health" onPress={() => router.push("/health")} style={styles.linkRow}>
              <Ionicons name="fitness-outline" size={20} color={colors.primary} />
              <Text style={styles.linkText}>{t("health.title")}</Text>
              {!user.is_premium && <Ionicons name="lock-closed" size={14} color={colors.textMuted} />}
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>
            <Pressable testID="link-waterpoints" onPress={() => router.push("/water-points")} style={styles.linkRow}>
              <Ionicons name="location-outline" size={20} color={colors.primary} />
              <Text style={styles.linkText}>{t("waterPoints.title")}</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>
            <Pressable
              testID="link-privacy"
              onPress={() => router.push("/privacy")}
              style={[styles.linkRow, { borderBottomWidth: 0 }]}
            >
              <Ionicons name="shield-checkmark-outline" size={20} color={colors.primary} />
              <Text style={styles.linkText}>{t("privacy.title")}</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>
          </View>
        </View>

        {/* logout */}
        <View style={styles.section}>
          <Pressable
            testID="logout-button"
            onPress={async () => {
              await logout();
              router.replace("/auth");
            }}
            style={styles.logoutBtn}
          >
            <Ionicons name="log-out-outline" size={20} color={colors.danger} />
            <Text style={styles.logoutText}>{t("profile.logout")}</Text>
          </Pressable>
        </View>

        <AdBanner />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
    alignItems: "center",
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: radius.pill,
    backgroundColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.5)",
  },
  avatarText: { color: colors.white, fontSize: font.h1, fontWeight: "800" },
  name: { color: colors.white, fontSize: font.h2, fontWeight: "800", marginTop: spacing.sm },
  email: { color: "rgba(255,255,255,0.85)", fontSize: font.small },
  premiumBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    marginTop: spacing.sm,
  },
  premiumBadgeText: { color: colors.white, fontSize: font.tiny, fontWeight: "700" },
  section: { paddingHorizontal: spacing.lg, marginTop: spacing.lg },
  sectionTitle: {
    fontSize: font.tiny,
    fontWeight: "800",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, ...shadow.soft },
  goalRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  stepBtn: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  goalCenter: { alignItems: "center" },
  goalValue: { fontSize: font.hero, fontWeight: "800", color: colors.text, letterSpacing: -1 },
  goalUnit: { fontSize: font.small, color: colors.textMuted, fontWeight: "600" },
  langRow: { flexDirection: "row", gap: spacing.sm },
  langChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: radius.md,
    backgroundColor: colors.cardAlt,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  langFlag: { fontSize: 15 },
  chipActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  chipText: { fontSize: font.tiny, fontWeight: "700", color: colors.textSecondary },
  chipTextActive: { color: colors.primaryDark },
  switchRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  rowLabel: { fontSize: font.body, fontWeight: "700", color: colors.text },
  rowHint: { fontSize: font.tiny, color: colors.textMuted, marginTop: 2 },
  subLabel: {
    fontSize: font.tiny,
    fontWeight: "700",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  smallChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.cardAlt,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  windowRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.xs },
  windowLabel: { width: 28, fontSize: font.small, color: colors.textSecondary, fontWeight: "700" },
  hChips: { gap: spacing.sm, paddingRight: spacing.md },
  timeChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.cardAlt,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  premiumActiveCard: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  premiumCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    padding: spacing.md,
    ...shadow.button,
  },
  premiumCtaTitle: { color: colors.white, fontSize: font.body, fontWeight: "800" },
  premiumCtaSub: { color: "rgba(255,255,255,0.85)", fontSize: font.tiny, marginTop: 2 },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    ...shadow.soft,
  },
  logoutText: { color: colors.danger, fontSize: font.body, fontWeight: "700" },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  linkText: { flex: 1, fontSize: font.body, color: colors.text, fontWeight: "600" },
});
