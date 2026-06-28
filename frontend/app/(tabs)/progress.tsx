import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { BarChart } from "react-native-gifted-charts";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api/client";
import { useAuth } from "@/src/context/AuthContext";
import { useI18n } from "@/src/i18n";
import { colors, font, radius, shadow, spacing } from "@/src/theme";

const BADGE_ICON: Record<string, string> = {
  first_sip: "water",
  early_bird: "sunny",
  night_owl: "moon",
  streak_3: "flame",
  streak_7: "flame",
  perfect_week: "trophy",
  overflow: "rainy",
  big_gulp: "cafe",
  explorer: "compass",
  comeback: "refresh",
  weekend_hero: "star",
  zen: "leaf",
  centurion: "ribbon",
  streak_30: "medal",
};

export default function ProgressScreen() {
  const insets = useSafeAreaInsets();
  const { t, lang } = useI18n();
  const { token } = useAuth();

  const [history, setHistory] = useState<any>(null);
  const [gam, setGam] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [h, g] = await Promise.all([
        api.get("/hydration/history", token),
        api.get("/gamification", token),
      ]);
      setHistory(h);
      setGam(g);
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

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  const days: any[] = history?.data || [];
  const maxGoal = Math.max(...days.map((d) => d.goal || 2000), 2000);
  const chartW = Dimensions.get("window").width - spacing.lg * 2 - spacing.lg * 2;
  const barWidth = Math.max(14, chartW / 7 - 14);

  const barData = days.map((d) => {
    const achieved = d.total >= d.goal && d.goal > 0;
    const wd = new Date(d.date + "T00:00:00").toLocaleDateString(lang, { weekday: "short" });
    return {
      value: d.total,
      label: wd.slice(0, 2),
      frontColor: achieved ? colors.success : colors.primaryLight,
      labelTextStyle: { color: colors.textMuted, fontSize: 10 },
    };
  });

  const badges: any[] = gam?.badges || [];

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
        <LinearGradient
          colors={[colors.gradTop, colors.gradBottom]}
          style={[styles.header, { paddingTop: insets.top + spacing.md }]}
        >
          <Text style={styles.headerTitle}>{t("progress.title")}</Text>
          <Text style={styles.headerSub}>{t("progress.subtitle")}</Text>
        </LinearGradient>

        {/* chart */}
        <View style={styles.section}>
          <View style={styles.chartCard}>
            <BarChart
              data={barData}
              barWidth={barWidth}
              spacing={14}
              roundedTop
              noOfSections={4}
              maxValue={Math.ceil((maxGoal * 1.1) / 500) * 500}
              yAxisThickness={0}
              xAxisThickness={0}
              hideRules={false}
              rulesColor={colors.border}
              rulesType="dashed"
              yAxisTextStyle={{ color: colors.textMuted, fontSize: 9 }}
              height={150}
              initialSpacing={10}
              isAnimated
            />
          </View>

          <View style={styles.statRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{Math.round(history?.average || 0)}</Text>
              <Text style={styles.statUnit}>ml {t("progress.perDay")}</Text>
              <Text style={styles.statLabel}>{t("progress.average")}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>
                {history?.days_achieved || 0}
                <Text style={styles.statUnit}> / {history?.total_days || 7}</Text>
              </Text>
              <Text style={styles.statLabel}>{t("progress.daysAchieved")}</Text>
            </View>
          </View>
        </View>

        {/* streaks */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("progress.streak")}</Text>
          <View style={styles.statRow}>
            <View style={[styles.statCard, styles.streakCard]}>
              <Ionicons name="flame" size={26} color={colors.warning} />
              <Text style={styles.streakValue}>
                {gam?.current_streak || 0} <Text style={styles.statUnit}>{t("progress.days")}</Text>
              </Text>
              <Text style={styles.statLabel}>{t("progress.currentStreak")}</Text>
            </View>
            <View style={[styles.statCard, styles.streakCard]}>
              <Ionicons name="trophy" size={24} color={colors.gold} />
              <Text style={styles.streakValue}>
                {gam?.best_streak || 0} <Text style={styles.statUnit}>{t("progress.days")}</Text>
              </Text>
              <Text style={styles.statLabel}>{t("progress.bestStreak")}</Text>
            </View>
          </View>
        </View>

        {/* badges */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("progress.badges")}</Text>
          <View style={styles.badgeGrid}>
            {badges.map((b) => (
              <View
                key={b.id}
                testID={`badge-${b.id}`}
                style={[styles.badge, !b.earned && styles.badgeLocked]}
              >
                <View style={[styles.badgeIcon, b.earned && styles.badgeIconEarned]}>
                  <Ionicons
                    name={(BADGE_ICON[b.id] || "ribbon") as any}
                    size={24}
                    color={b.earned ? colors.white : colors.textMuted}
                  />
                </View>
                <Text style={[styles.badgeName, !b.earned && { color: colors.textMuted }]} numberOfLines={2}>
                  {t(`badges.${b.id}`)}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
  },
  headerTitle: { color: colors.white, fontSize: font.h1, fontWeight: "800" },
  headerSub: { color: "rgba(255,255,255,0.85)", fontSize: font.small, marginTop: 2 },
  section: { paddingHorizontal: spacing.lg, marginTop: spacing.lg },
  sectionTitle: { fontSize: font.h3, fontWeight: "800", color: colors.text, marginBottom: spacing.md },
  chartCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    paddingRight: spacing.lg,
    ...shadow.soft,
  },
  statRow: { flexDirection: "row", gap: spacing.md, marginTop: spacing.md },
  statCard: { flex: 1, backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, ...shadow.soft },
  streakCard: { alignItems: "flex-start", gap: 4 },
  statValue: { fontSize: font.h1, fontWeight: "800", color: colors.text },
  streakValue: { fontSize: font.h2, fontWeight: "800", color: colors.text },
  statUnit: { fontSize: font.small, fontWeight: "600", color: colors.textMuted },
  statLabel: { fontSize: font.tiny, color: colors.textSecondary, marginTop: 2, fontWeight: "600" },
  badgeGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  badge: {
    width: "31%",
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: "center",
    ...shadow.soft,
  },
  badgeLocked: { opacity: 0.6 },
  badgeIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.cardAlt,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xs,
  },
  badgeIconEarned: { backgroundColor: colors.primary },
  badgeName: { fontSize: font.tiny, fontWeight: "700", color: colors.text, textAlign: "center" },
});
