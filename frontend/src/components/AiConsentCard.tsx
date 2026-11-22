import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { api } from "@/src/api/client";
import { useToast } from "@/src/components/Toast";
import { useAuth } from "@/src/context/AuthContext";
import { useI18n } from "@/src/i18n";
import { colors, font, radius, spacing } from "@/src/theme";

export function AiConsentCard({ onAccepted }: { onAccepted?: () => void }) {
  const { t } = useI18n();
  const router = useRouter();
  const { token, setUser } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const accept = async () => {
    setBusy(true);
    try {
      setUser(await api.put("/settings", { ai_consent: true }, token));
      onAccepted?.();
    } catch (e: any) {
      toast.show(e?.message || t("auth.errGeneric"), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.card} testID="ai-consent-card">
      <View style={styles.titleRow}>
        <Ionicons name="shield-checkmark" size={20} color={colors.primary} />
        <Text style={styles.title}>{t("aiConsent.title")}</Text>
      </View>
      <Text style={styles.body}>{t("aiConsent.body")}</Text>
      <Pressable testID="ai-consent-accept" onPress={accept} disabled={busy} style={styles.button}>
        {busy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>{t("aiConsent.accept")}</Text>}
      </Pressable>
      <Pressable onPress={() => router.push("/privacy")} hitSlop={8}>
        <Text style={styles.link}>{t("aiConsent.privacy")}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm },
  titleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  title: { color: colors.text, fontSize: font.body, fontWeight: "800" },
  body: { color: colors.textMuted, fontSize: font.small, lineHeight: 20 },
  button: { minHeight: 46, alignItems: "center", justifyContent: "center", borderRadius: radius.pill, backgroundColor: colors.primary },
  buttonText: { color: colors.white, fontSize: font.body, fontWeight: "800" },
  link: { color: colors.primary, fontSize: font.small, fontWeight: "700", textAlign: "center" },
});
