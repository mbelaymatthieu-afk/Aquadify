import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useToast } from "@/src/components/Toast";
import { api } from "@/src/api/client";
import { useAuth } from "@/src/context/AuthContext";
import { computeDailyGoal } from "@/src/lib/hydration";
import { useI18n } from "@/src/i18n";
import { colors, font, radius, shadow, spacing } from "@/src/theme";

function Option({
  label,
  active,
  onPress,
  testID,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  testID: string;
}) {
  return (
    <Pressable testID={testID} onPress={onPress} style={[styles.option, active && styles.optionActive]}>
      <Text style={[styles.optionText, active && styles.optionTextActive]}>{label}</Text>
    </Pressable>
  );
}

export default function Onboarding() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useI18n();
  const { token, setUser } = useAuth();
  const toast = useToast();

  const [weight, setWeight] = useState("70");
  const [age, setAge] = useState("30");
  const [sex, setSex] = useState("male");
  const [activity, setActivity] = useState("moderate");
  const [climate, setClimate] = useState("temperate");
  const [busy, setBusy] = useState(false);

  const finish = async () => {
    setBusy(true);
    try {
      const w = parseFloat(weight) || 70;
      const a = parseInt(age, 10) || 30;
      await api.put("/profile", { weight: w, age: a, sex, activity, climate }, token);
      // Override the backend goal with our realistic, evidence-based value.
      const goal = computeDailyGoal({ weight: w, age: a, sex, activity, climate });
      const updated = await api.put("/settings", { daily_goal_ml: goal }, token);
      setUser(updated);
      router.replace("/(tabs)");
    } catch (e: any) {
      toast.show(e?.message || t("auth.errGeneric"), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <LinearGradient colors={[colors.gradTop, colors.gradBottom]} style={styles.flex}>
      <KeyboardAwareScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + spacing.xl }]}
        bottomOffset={20}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.iconBubble}>
          <Ionicons name="water" size={30} color={colors.white} />
        </View>
        <Text style={styles.title}>{t("onboarding.title")}</Text>
        <Text style={styles.subtitle}>{t("onboarding.subtitle")}</Text>

        <View style={styles.card}>
          <View style={styles.rowFields}>
            <View style={styles.half}>
              <Text style={styles.label}>
                {t("onboarding.weight")} ({t("onboarding.kg")})
              </Text>
              <TextInput
                testID="onb-weight-input"
                value={weight}
                onChangeText={setWeight}
                keyboardType="numeric"
                style={styles.input}
              />
            </View>
            <View style={styles.half}>
              <Text style={styles.label}>
                {t("onboarding.age")} ({t("onboarding.years")})
              </Text>
              <TextInput
                testID="onb-age-input"
                value={age}
                onChangeText={setAge}
                keyboardType="numeric"
                style={styles.input}
              />
            </View>
          </View>

          <Text style={styles.label}>{t("onboarding.sex")}</Text>
          <View style={styles.optionRow}>
            {(["male", "female", "other"] as const).map((v) => (
              <Option
                key={v}
                testID={`onb-sex-${v}`}
                label={t(`onboarding.${v}`)}
                active={sex === v}
                onPress={() => setSex(v)}
              />
            ))}
          </View>

          <Text style={styles.label}>{t("onboarding.activity")}</Text>
          <View style={styles.optionRow}>
            {(["sedentary", "moderate", "intense"] as const).map((v) => (
              <Option
                key={v}
                testID={`onb-activity-${v}`}
                label={t(`onboarding.${v}`)}
                active={activity === v}
                onPress={() => setActivity(v)}
              />
            ))}
          </View>

          <Text style={styles.label}>{t("onboarding.climate")}</Text>
          <View style={styles.optionRow}>
            {(["cold", "temperate", "hot"] as const).map((v) => (
              <Option
                key={v}
                testID={`onb-climate-${v}`}
                label={t(`onboarding.${v}`)}
                active={climate === v}
                onPress={() => setClimate(v)}
              />
            ))}
          </View>
        </View>

        <Pressable
          testID="onb-finish-button"
          onPress={finish}
          disabled={busy}
          style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.9 }]}
        >
          {busy ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Text style={styles.primaryBtnText}>{t("onboarding.finish")}</Text>
          )}
        </Pressable>
      </KeyboardAwareScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, alignItems: "center" },
  iconBubble: {
    width: 60,
    height: 60,
    borderRadius: radius.lg,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    color: colors.white,
    fontSize: font.h1,
    fontWeight: "800",
    marginTop: spacing.md,
    textAlign: "center",
  },
  subtitle: {
    color: "rgba(255,255,255,0.9)",
    fontSize: font.small,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
    textAlign: "center",
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    width: "100%",
    ...shadow.card,
  },
  rowFields: { flexDirection: "row", gap: spacing.md },
  half: { flex: 1 },
  label: {
    fontSize: font.tiny,
    fontWeight: "700",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 6,
    marginTop: spacing.sm,
  },
  input: {
    backgroundColor: colors.cardAlt,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    fontSize: font.body,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionRow: { flexDirection: "row", gap: spacing.sm },
  option: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radius.md,
    backgroundColor: colors.cardAlt,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: "center",
  },
  optionActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  optionText: { fontSize: font.small, fontWeight: "700", color: colors.textSecondary },
  optionTextActive: { color: colors.primaryDark },
  primaryBtn: {
    backgroundColor: colors.white,
    borderRadius: radius.pill,
    minHeight: 56,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.lg,
    width: "100%",
    ...shadow.card,
  },
  primaryBtnText: { color: colors.primary, fontSize: font.body, fontWeight: "800" },
});
