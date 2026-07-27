import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Mascot } from "@/src/components/Mascot";
import { useToast } from "@/src/components/Toast";
import { useAuth } from "@/src/context/AuthContext";
import { checkPassword, isStrongPassword } from "@/src/lib/password";
import { useI18n } from "@/src/i18n";
import { colors, font, radius, shadow, spacing } from "@/src/theme";

export default function ForgotPasswordScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useI18n();
  const { forgotPassword, resetPassword } = useAuth();
  const toast = useToast();

  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const pw = checkPassword(password);

  const requestCode = async () => {
    if (!email.trim()) {
      toast.show(t("auth.errFields"), "error");
      return;
    }
    setBusy(true);
    try {
      await forgotPassword(email.trim());
      toast.show(t("auth.resetSent"), "success");
      setStep(2);
    } catch (e: any) {
      toast.show(e?.message || t("auth.errGeneric"), "error");
    } finally {
      setBusy(false);
    }
  };

  const doReset = async () => {
    if (code.trim().length < 6) {
      toast.show(t("auth.errCode"), "error");
      return;
    }
    if (!isStrongPassword(password)) {
      toast.show(t("auth.errWeakPassword"), "error");
      return;
    }
    if (password !== confirm) {
      toast.show(t("auth.errPasswordMismatch"), "error");
      return;
    }
    setBusy(true);
    try {
      await resetPassword(email.trim(), code.trim(), password);
      toast.show(t("auth.resetDone"), "success");
      router.replace("/auth");
    } catch (e: any) {
      toast.show(e?.message || t("auth.errCode"), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <LinearGradient colors={[colors.gradTop, colors.gradMid, colors.gradBottom]} style={styles.flex}>
      <View style={[styles.wrap, { paddingTop: insets.top + spacing.lg }]}>
        <Pressable testID="forgot-back" onPress={() => router.replace("/auth")} style={styles.back} hitSlop={10}>
          <Ionicons name="chevron-back" size={26} color={colors.white} />
        </Pressable>

        <View style={styles.brand}>
          <Mascot size={80} />
          <Text style={styles.title}>{t("auth.forgotTitle")}</Text>
          <Text style={styles.subtitle}>{step === 1 ? t("auth.forgotBody") : t("auth.resetBody")}</Text>
        </View>

        <View style={styles.card}>
          {step === 1 ? (
            <>
              <Text style={styles.label}>{t("auth.email")}</Text>
              <TextInput
                testID="forgot-email-input"
                value={email}
                onChangeText={setEmail}
                placeholder="email@exemple.com"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                autoCapitalize="none"
                keyboardType="email-address"
              />
              <Pressable testID="forgot-submit" onPress={requestCode} disabled={busy} style={styles.primaryBtn}>
                {busy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryBtnText}>{t("auth.sendCode")}</Text>}
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.label}>{t("auth.code")}</Text>
              <TextInput
                testID="reset-code-input"
                value={code}
                onChangeText={(v) => setCode(v.replace(/[^0-9]/g, "").slice(0, 6))}
                placeholder="______"
                placeholderTextColor={colors.textMuted}
                style={styles.codeInput}
                keyboardType="number-pad"
                maxLength={6}
              />
              <Text style={styles.label}>{t("auth.newPassword")}</Text>
              <TextInput
                testID="reset-password-input"
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                secureTextEntry
              />
              <View style={styles.rulesBox}>
                {[
                  { ok: pw.length, label: t("auth.ruleLength") },
                  { ok: pw.upper, label: t("auth.ruleUpper") },
                  { ok: pw.lower, label: t("auth.ruleLower") },
                  { ok: pw.digit, label: t("auth.ruleDigit") },
                ].map((r, i) => (
                  <View key={i} style={styles.ruleRow}>
                    <Ionicons
                      name={r.ok ? "checkmark-circle" : "ellipse-outline"}
                      size={15}
                      color={r.ok ? colors.success : colors.textMuted}
                    />
                    <Text style={[styles.ruleText, r.ok && { color: colors.success }]}>{r.label}</Text>
                  </View>
                ))}
              </View>
              <Text style={styles.label}>{t("auth.confirmPassword")}</Text>
              <TextInput
                testID="reset-confirm-input"
                value={confirm}
                onChangeText={setConfirm}
                placeholder="••••••••"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                secureTextEntry
              />
              <Pressable testID="reset-submit" onPress={doReset} disabled={busy} style={styles.primaryBtn}>
                {busy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryBtnText}>{t("auth.resetCta")}</Text>}
              </Pressable>
            </>
          )}
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  wrap: { flex: 1, paddingHorizontal: spacing.lg },
  back: { alignSelf: "flex-start", padding: spacing.xs },
  brand: { alignItems: "center", marginTop: spacing.md, marginBottom: spacing.lg },
  title: { color: colors.white, fontSize: font.h1, fontWeight: "800", marginTop: spacing.sm, textAlign: "center" },
  subtitle: { color: "rgba(255,255,255,0.9)", fontSize: font.small, marginTop: spacing.xs, textAlign: "center", lineHeight: 20 },
  card: { backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.lg, ...shadow.card },
  label: { fontSize: font.small, fontWeight: "700", color: colors.text, marginBottom: spacing.sm },
  input: {
    backgroundColor: colors.cardAlt,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    fontSize: font.body,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  codeInput: {
    backgroundColor: colors.cardAlt,
    borderRadius: radius.md,
    paddingVertical: 14,
    fontSize: 24,
    letterSpacing: 10,
    textAlign: "center",
    color: colors.text,
    fontWeight: "800",
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  rulesBox: { marginTop: -spacing.xs, marginBottom: spacing.md, gap: 4, paddingHorizontal: spacing.xs },
  ruleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  ruleText: { fontSize: font.tiny, color: colors.textMuted },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    minHeight: 54,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.xs,
    ...shadow.button,
  },
  primaryBtnText: { color: colors.white, fontSize: font.body, fontWeight: "800" },
});
