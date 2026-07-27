import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppleSignInButton } from "@/src/components/AppleSignInButton";
import { Mascot } from "@/src/components/Mascot";
import { useToast } from "@/src/components/Toast";
import { useAuth } from "@/src/context/AuthContext";
import { isAppleAvailable, isAppleCancel } from "@/src/lib/apple";
import { checkPassword, isStrongPassword } from "@/src/lib/password";
import { useI18n } from "@/src/i18n";
import { LANGS } from "@/src/i18n/translations";
import { colors, font, radius, shadow, spacing } from "@/src/theme";

export default function AuthScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t, lang, setLang } = useI18n();
  const { login, register, resendVerification, googleLogin, appleLogin } = useAuth();
  const toast = useToast();

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [showCgu, setShowCgu] = useState(true);
  const [appleReady, setAppleReady] = useState(false);

  useEffect(() => {
    isAppleAvailable().then(setAppleReady).catch(() => setAppleReady(false));
  }, []);

  const pwChecks = checkPassword(password);

  const submit = async () => {
    if (!email.trim() || !password || (mode === "signup" && !name.trim())) {
      toast.show(t("auth.errFields"), "error");
      return;
    }
    if (mode === "signup") {
      if (!isStrongPassword(password)) {
        toast.show(t("auth.errWeakPassword"), "error");
        return;
      }
      if (password !== confirm) {
        toast.show(t("auth.errPasswordMismatch"), "error");
        return;
      }
    }
    setBusy(true);
    try {
      if (mode === "signin") {
        await login(email.trim(), password);
        router.replace("/");
      } else {
        const res = await register(name.trim(), email.trim(), password);
        if (res.requiresVerification) {
          toast.show(t("auth.verifySent"), "success");
          router.push({ pathname: "/verify-email", params: { email: res.email } });
        } else {
          router.replace("/");
        }
      }
    } catch (e: any) {
      // Backend blocks login until email verified -> route to verification.
      if (e?.status === 403 || e?.data?.requires_verification) {
        try {
          await resendVerification(email.trim());
        } catch {
          // ignore
        }
        toast.show(t("auth.errNotVerified"), "info");
        router.push({ pathname: "/verify-email", params: { email: email.trim() } });
      } else {
        toast.show(e?.message || t("auth.errGeneric"), "error");
      }
    } finally {
      setBusy(false);
    }
  };

  const onGoogle = async () => {
    setBusy(true);
    try {
      const ok = await googleLogin();
      if (ok) router.replace("/");
    } catch (e: any) {
      toast.show(e?.message || t("auth.errGeneric"), "error");
    } finally {
      setBusy(false);
    }
  };

  const onApple = async () => {
    setBusy(true);
    try {
      const ok = await appleLogin();
      if (ok) router.replace("/");
    } catch (e: any) {
      if (!isAppleCancel(e)) {
        toast.show(e?.message || t("auth.errGeneric"), "error");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <LinearGradient colors={[colors.gradTop, colors.gradMid, colors.gradBottom]} style={styles.flex}>
      <KeyboardAwareScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + spacing.sm }]}
        bottomOffset={20}
        showsVerticalScrollIndicator={false}
      >
        {/* language switcher */}
        <View style={styles.langRow}>
          {LANGS.map((l) => (
            <Pressable
              key={l.code}
              testID={`lang-${l.code}`}
              onPress={() => setLang(l.code)}
              style={[styles.langChip, lang === l.code && styles.langChipActive]}
            >
              <Text style={styles.langFlag}>{l.flag}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.brand}>
          <Mascot size={120} />
          <Text style={styles.appName}>Aquadify</Text>
          <Text style={styles.tagline}>{t("common.tagline")}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.welcome}>{t("auth.welcome")}</Text>
          <Text style={styles.subtitle}>{t("auth.subtitle")}</Text>

          {mode === "signup" && (
            <View style={styles.field}>
              <Text style={styles.label}>{t("auth.name")}</Text>
              <TextInput
                testID="auth-name-input"
                value={name}
                onChangeText={setName}
                placeholder={t("auth.namePlaceholder")}
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                autoCapitalize="words"
              />
            </View>
          )}

          <View style={styles.field}>
            <Text style={styles.label}>{t("auth.email")}</Text>
            <TextInput
              testID="auth-email-input"
              value={email}
              onChangeText={setEmail}
              placeholder="you@email.com"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>{t("auth.password")}</Text>
            <TextInput
              testID="auth-password-input"
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              secureTextEntry
            />
          </View>

          {mode === "signup" && (
            <View style={styles.rulesBox} testID="password-rules">
              {[
                { ok: pwChecks.length, label: t("auth.ruleLength") },
                { ok: pwChecks.upper, label: t("auth.ruleUpper") },
                { ok: pwChecks.lower, label: t("auth.ruleLower") },
                { ok: pwChecks.digit, label: t("auth.ruleDigit") },
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
          )}

          {mode === "signup" && (
            <View style={styles.field}>
              <Text style={styles.label}>{t("auth.confirmPassword")}</Text>
              <TextInput
                testID="auth-confirm-input"
                value={confirm}
                onChangeText={setConfirm}
                placeholder="••••••••"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                secureTextEntry
              />
              {confirm.length > 0 && confirm !== password && (
                <Text style={styles.fieldError}>{t("auth.errPasswordMismatch")}</Text>
              )}
            </View>
          )}

          {mode === "signin" && (
            <Pressable
              testID="auth-forgot-link"
              onPress={() => router.push("/forgot-password")}
              style={styles.forgot}
            >
              <Text style={styles.forgotText}>{t("auth.forgot")}</Text>
            </Pressable>
          )}

          <Pressable
            testID="auth-submit-button"
            onPress={submit}
            disabled={busy}
            style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
          >
            {busy ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.primaryBtnText}>
                {mode === "signin" ? t("auth.signin") : t("auth.signup")}
              </Text>
            )}
          </Pressable>

          <View style={styles.divider}>
            <View style={styles.line} />
            <Text style={styles.orText}>{t("auth.or")}</Text>
            <View style={styles.line} />
          </View>

          <Pressable
            testID="auth-google-button"
            onPress={onGoogle}
            disabled={busy}
            style={({ pressed }) => [styles.googleBtn, pressed && styles.pressed]}
          >
            <Image
              source={{ uri: "https://developers.google.com/identity/images/g-logo.png" }}
              style={styles.googleLogo}
            />
            <Text style={styles.googleText}>{t("auth.google")}</Text>
          </Pressable>

          {appleReady && <AppleSignInButton onPress={onApple} disabled={busy} />}

          <Pressable
            testID="auth-toggle-mode"
            onPress={() => setMode(mode === "signin" ? "signup" : "signin")}
            style={styles.toggle}
          >
            <Text style={styles.toggleText}>
              {mode === "signin" ? t("auth.noAccount") : t("auth.haveAccount")}
            </Text>
          </Pressable>
        </View>
      </KeyboardAwareScrollView>

      {/* CGU disclaimer gate */}
      <Modal visible={showCgu} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.cguCard, { paddingBottom: insets.bottom + spacing.lg }]} testID="cgu-gate">
            <View style={styles.cguIcon}>
              <Ionicons name="water" size={28} color={colors.white} />
            </View>
            <Text style={styles.cguTitle}>{t("auth.cguTitle")}</Text>
            <Text style={styles.cguWelcome}>{t("auth.cguWelcome")}</Text>
            <View style={styles.cguBodyBox}>
              <Ionicons name="shield-checkmark" size={18} color={colors.success} />
              <Text style={styles.cguBody}>{t("auth.cguBody")}</Text>
            </View>
            <Pressable
              testID="cgu-accept-button"
              onPress={() => setShowCgu(false)}
              style={({ pressed }) => [styles.primaryBtn, { width: "100%" }, pressed && styles.pressed]}
            >
              <Text style={styles.primaryBtnText}>{t("auth.cguAccept")}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  langRow: { flexDirection: "row", justifyContent: "flex-end", gap: spacing.xs },
  langChip: {
    width: 40,
    height: 32,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  langChipActive: { backgroundColor: "rgba(255,255,255,0.95)" },
  langFlag: { fontSize: 16 },
  brand: { alignItems: "center", marginTop: spacing.sm, marginBottom: spacing.lg },
  appName: {
    color: colors.white,
    fontSize: font.hero,
    fontWeight: "800",
    letterSpacing: -1,
    marginTop: spacing.xs,
  },
  tagline: { color: "rgba(255,255,255,0.92)", fontSize: font.small, marginTop: spacing.xs },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    ...shadow.card,
  },
  welcome: { fontSize: font.h2, fontWeight: "800", color: colors.text },
  subtitle: { fontSize: font.small, color: colors.textSecondary, marginTop: 4, marginBottom: spacing.md },
  field: { marginBottom: spacing.md },
  label: {
    fontSize: font.tiny,
    fontWeight: "700",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 6,
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
  rulesBox: { marginTop: -spacing.xs, marginBottom: spacing.md, gap: 4, paddingHorizontal: spacing.xs },
  ruleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  ruleText: { fontSize: font.tiny, color: colors.textMuted },
  fieldError: { color: colors.danger, fontSize: font.tiny, marginTop: 4 },
  forgot: { alignSelf: "flex-end", paddingVertical: spacing.xs, marginBottom: spacing.xs },
  forgotText: { color: colors.white, fontSize: font.small, fontWeight: "700", textDecorationLine: "underline" },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    minHeight: 54,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.xs,
    ...shadow.button,
  },
  primaryBtnText: { color: colors.white, fontSize: font.body, fontWeight: "700" },
  pressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  divider: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginVertical: spacing.md },
  line: { flex: 1, height: 1, backgroundColor: colors.border },
  orText: { color: colors.textMuted, fontSize: font.tiny, fontWeight: "700", textTransform: "uppercase" },
  googleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radius.pill,
    minHeight: 54,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  googleLogo: { width: 20, height: 20 },
  googleText: { color: colors.text, fontSize: font.body, fontWeight: "700" },
  toggle: { alignItems: "center", marginTop: spacing.md },
  toggleText: { color: colors.primary, fontSize: font.small, fontWeight: "700" },
  modalOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: "flex-end" },
  cguCard: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    alignItems: "center",
  },
  cguIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  cguTitle: { fontSize: font.h2, fontWeight: "800", color: colors.text },
  cguWelcome: { fontSize: font.body, fontWeight: "700", color: colors.primary, marginVertical: spacing.xs },
  cguBodyBox: {
    flexDirection: "row",
    gap: spacing.sm,
    backgroundColor: colors.cardAlt,
    borderRadius: radius.md,
    padding: spacing.md,
    marginVertical: spacing.md,
  },
  cguBody: { flex: 1, fontSize: font.small, color: colors.textSecondary, lineHeight: 20 },
});
