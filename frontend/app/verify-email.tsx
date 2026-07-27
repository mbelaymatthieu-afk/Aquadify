import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Mascot } from "@/src/components/Mascot";
import { useToast } from "@/src/components/Toast";
import { useAuth } from "@/src/context/AuthContext";
import { useI18n } from "@/src/i18n";
import { colors, font, radius, shadow, spacing } from "@/src/theme";

export default function VerifyEmailScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useI18n();
  const { verifyEmail, resendVerification } = useAuth();
  const toast = useToast();
  const params = useLocalSearchParams<{ email?: string }>();
  const email = (params.email || "").toString();

  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const verify = async () => {
    if (code.trim().length < 6) {
      toast.show(t("auth.errCode"), "error");
      return;
    }
    setBusy(true);
    try {
      const loggedIn = await verifyEmail(email, code.trim());
      toast.show(t("auth.verified"), "success");
      router.replace(loggedIn ? "/" : "/auth");
    } catch (e: any) {
      toast.show(e?.status === 404 ? t("auth.errGeneric") : e?.message || t("auth.errCode"), "error");
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    if (cooldown > 0) return;
    setCooldown(30); // start cooldown regardless to avoid spamming
    try {
      await resendVerification(email);
      toast.show(t("auth.verifySent"), "success");
    } catch (e: any) {
      toast.show(e?.status === 404 ? t("auth.errGeneric") : e?.message || t("auth.errGeneric"), "error");
    }
  };

  return (
    <LinearGradient colors={[colors.gradTop, colors.gradMid, colors.gradBottom]} style={styles.flex}>
      <View style={[styles.wrap, { paddingTop: insets.top + spacing.lg }]}>
        <Pressable testID="verify-back" onPress={() => router.replace("/auth")} style={styles.back} hitSlop={10}>
          <Ionicons name="chevron-back" size={26} color={colors.white} />
        </Pressable>

        <View style={styles.brand}>
          <Mascot size={84} />
          <Text style={styles.title}>{t("auth.verifyTitle")}</Text>
          <Text style={styles.subtitle}>{t("auth.verifyBody")}</Text>
          {!!email && <Text style={styles.email}>{email}</Text>}
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>{t("auth.code")}</Text>
          <TextInput
            testID="verify-code-input"
            value={code}
            onChangeText={(v) => setCode(v.replace(/[^0-9]/g, "").slice(0, 6))}
            placeholder="______"
            placeholderTextColor={colors.textMuted}
            style={styles.codeInput}
            keyboardType="number-pad"
            maxLength={6}
          />

          <Pressable testID="verify-submit" onPress={verify} disabled={busy} style={styles.primaryBtn}>
            {busy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryBtnText}>{t("auth.verifyCta")}</Text>}
          </Pressable>

          <Pressable testID="verify-resend" onPress={resend} disabled={cooldown > 0} style={styles.resend}>
            <Text style={[styles.resendText, cooldown > 0 && { color: colors.textMuted }]}>
              {cooldown > 0 ? t("auth.resendIn", { n: cooldown }) : t("auth.resend")}
            </Text>
          </Pressable>
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
  email: { color: colors.white, fontSize: font.small, fontWeight: "800", marginTop: spacing.xs },
  card: { backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.lg, ...shadow.card },
  label: { fontSize: font.small, fontWeight: "700", color: colors.text, marginBottom: spacing.sm },
  codeInput: {
    backgroundColor: colors.cardAlt,
    borderRadius: radius.md,
    paddingVertical: 16,
    fontSize: 28,
    letterSpacing: 12,
    textAlign: "center",
    color: colors.text,
    fontWeight: "800",
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    minHeight: 54,
    alignItems: "center",
    justifyContent: "center",
    ...shadow.button,
  },
  primaryBtnText: { color: colors.white, fontSize: font.body, fontWeight: "800" },
  resend: { alignItems: "center", paddingVertical: spacing.md, marginTop: spacing.xs },
  resendText: { color: colors.primary, fontSize: font.small, fontWeight: "700" },
});
