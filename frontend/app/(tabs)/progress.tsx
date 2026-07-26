import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { BarChart } from "react-native-gifted-charts";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api/client";
import AdBanner from "@/src/components/AdBanner";
import { fetchInsights, Insights } from "@/src/api/insights";
import { HEALTH_ENABLED, getHealthSnapshot } from "@/src/lib/healthkit";
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
  const { token, user } = useAuth();
  const router = useRouter();

  const [history, setHistory] = useState<any>(null);
  const [gam, setGam] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [insights, setInsights] = useState<Insights | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsError, setInsightsError] = useState(false);
  const insightsOnce = useRef(false);

  const loadInsights = useCallback(
    async (h: any, g: any) => {
      setInsightsLoading(true);
      setInsightsError(false);
      try {
        // Today's hydration (consumption, regularity, recency).
        let consumed = 0;
        let logsToday = 0;
        let lastIntakeHours: number | null = null;
        try {
          const today: any = await api.get("/hydration/today", token);
          consumed = today?.total_ml || 0;
          const logs: any[] = today?.logs || [];
          logsToday = logs.length;
          if (logs.length) {
            const times = logs
              .map((l) => new Date(l.timestamp).getTime())
              .filter((n) => !Number.isNaN(n));
            if (times.length) {
              lastIntakeHours =
                Math.round(((Date.now() - Math.max(...times)) / 3600000) * 10) / 10;
            }
          }
        } catch {
          // ignore — fall back to history-derived total below
        }

        // Apple Health snapshot (iOS native only; {} elsewhere).
        let health = {};
        try {
          if (HEALTH_ENABLED) health = await getHealthSnapshot();
        } catch {
          health = {};
        }

        const data = await fetchInsights({
          goal: user?.daily_goal_ml || 2000,
          consumed_today: consumed,
          logs_today: logsToday,
          last_intake_hours: lastIntakeHours,
          hour_of_day: new Date().getHours(),
          average: h?.average || 0,
          days_achieved: h?.days_achieved || 0,
          total_days: h?.total_days || 7,
          current_streak: g?.current_streak || 0,
          best_streak: g?.best_streak || 0,
          recent: (h?.data || []).slice(-7),
          activity_trend: [],
          health,
          language: lang,
        });
        if (data && !data.error && (data.summary || (data.tips || []).length || data.score != null)) {
          setInsights(data);
        } else if (data && data.score != null) {
          setInsights(data);
        } else {
          setInsightsError(true);
        }
      } catch {
        setInsightsError(true);
      } finally {
        setInsightsLoading(false);
      }
    },
    [user?.daily_goal_ml, lang, token],
  );

  const load = useCallback(async () => {
    try {
      const [h, g] = await Promise.all([
        api.get("/hydration/history", token),
        api.get("/gamification", token),
      ]);
      setHistory(h);
      setGam(g);
      if (!insightsOnce.current) {
        insightsOnce.current = true;
        loadInsights(h, g);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, loadInsights]);

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
  const premium = !!user?.is_premium;
  const visibleTips = insights ? (premium ? insights.tips : insights.tips.slice(0, 1)) : [];

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

        {/* AI insights (Premium) */}
        <View style={styles.section}>
          <View style={styles.insightHeader}>
            <View style={styles.insightTitleRow}>
              <View style={styles.insightIcon}>
                <Ionicons name="sparkles" size={16} color={colors.white} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionTitle}>{t("insights.title")}</Text>
                <Text style={styles.insightSub}>{t("insights.subtitle")}</Text>
              </View>
            </View>
            {premium && !!insights && (
              <Pressable
                testID="insights-refresh"
                onPress={() => loadInsights(history, gam)}
                hitSlop={8}
                style={styles.refreshBtn}
              >
                <Ionicons name="refresh" size={18} color={colors.primary} />
              </Pressable>
            )}
          </View>

          <View style={styles.insightCard} testID="insights-card">
            {insightsLoading && !insights ? (
              <View style={styles.insightLoading}>
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.insightMuted}>{t("insights.generating")}</Text>
              </View>
            ) : insightsError ? (
              <Text style={styles.insightMuted}>{t("insights.error")}</Text>
            ) : insights ? (
              <>
                {insights.score != null && (
                  <View style={styles.scoreRow} testID="insights-score">
                    <View
                      style={[
                        styles.scoreBadge,
                        {
                          backgroundColor:
                            insights.score >= 80
                              ? colors.success
                              : insights.score >= 50
                                ? colors.primary
                                : colors.warning,
                        },
                      ]}
                    >
                      <Text style={styles.scoreValue}>{insights.score}</Text>
                      <Text style={styles.scoreMax}>/100</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.scoreLabel}>{t("insights.scoreLabel")}</Text>
                      {!!insights.score_reasons?.length && (
                        <Text style={styles.scoreReasons} numberOfLines={2}>
                          {insights.score_reasons.join(" · ")}
                        </Text>
                      )}
                    </View>
                  </View>
                )}

                {!!insights.summary && <Text style={styles.insightSummary}>{insights.summary}</Text>}

                {visibleTips.map((tip, i) => (
                  <View key={i} style={styles.tipRow} testID={`insight-tip-${i}`}>
                    <Ionicons name="water" size={16} color={colors.primary} style={{ marginTop: 2 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.tipText}>{tip.text}</Text>
                      {!!tip.reason && <Text style={styles.tipReason}>{tip.reason}</Text>}
                    </View>
                  </View>
                ))}

                {premium && !!insights.prediction && (
                  <View style={styles.predictionBox} testID="insights-prediction">
                    <Ionicons name="trending-up" size={16} color={colors.primaryDark} style={{ marginTop: 2 }} />
                    <Text style={styles.predictionText}>{insights.prediction}</Text>
                  </View>
                )}

                {!premium && (
                  <Pressable testID="insights-unlock" onPress={() => router.push("/premium")} style={styles.lockedBox}>
                    <Ionicons name="lock-closed" size={18} color={colors.primary} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.lockedTitle}>{t("insights.lockedTitle")}</Text>
                      <Text style={styles.lockedBody}>{t("insights.lockedBody")}</Text>
                    </View>
                    <View style={styles.unlockBtn}>
                      <Text style={styles.unlockBtnText}>{t("insights.unlock")}</Text>
                    </View>
                  </Pressable>
                )}
              </>
            ) : null}
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

        <AdBanner />
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
  insightHeader: { flexDirection: "row", alignItems: "center", marginBottom: spacing.sm },
  insightTitleRow: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.sm },
  insightIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  insightSub: { fontSize: font.tiny, color: colors.textMuted, marginTop: 1 },
  refreshBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  insightCard: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, ...shadow.soft },
  insightLoading: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm },
  insightMuted: { color: colors.textMuted, fontSize: font.small },
  insightSummary: {
    fontSize: font.body,
    fontWeight: "700",
    color: colors.text,
    marginBottom: spacing.md,
    lineHeight: 22,
  },
  tipRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.sm },
  tipText: { flex: 1, fontSize: font.small, color: colors.text, lineHeight: 20, fontWeight: "600" },
  tipReason: { fontSize: font.tiny, color: colors.textMuted, lineHeight: 17, marginTop: 2 },
  scoreRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  scoreBadge: {
    width: 68,
    height: 68,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  scoreValue: { color: colors.white, fontSize: font.h2, fontWeight: "800", lineHeight: 28 },
  scoreMax: { color: "rgba(255,255,255,0.85)", fontSize: 10, fontWeight: "700", marginTop: -2 },
  scoreLabel: { fontSize: font.body, fontWeight: "800", color: colors.text },
  scoreReasons: { fontSize: font.tiny, color: colors.textMuted, marginTop: 2, lineHeight: 16 },
  predictionBox: {
    flexDirection: "row",
    gap: spacing.sm,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.xs,
  },
  predictionText: { flex: 1, fontSize: font.small, color: colors.primaryDark, lineHeight: 20, fontWeight: "600" },
  lockedBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.xs,
  },
  lockedTitle: { fontSize: font.small, fontWeight: "800", color: colors.primaryDark },
  lockedBody: { fontSize: font.tiny, color: colors.textSecondary, marginTop: 2 },
  unlockBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  unlockBtnText: { color: colors.white, fontSize: font.tiny, fontWeight: "800" },
});
