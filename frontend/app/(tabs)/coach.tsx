import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api/client";
import { useAuth } from "@/src/context/AuthContext";
import { useI18n } from "@/src/i18n";
import { colors, font, radius, shadow, spacing } from "@/src/theme";

type Msg = { role: string; text: string };

export default function CoachScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useI18n();
  const { token, user, refreshUser } = useAuth();

  const [messages, setMessages] = useState<Msg[]>([]);
  const [used, setUsed] = useState(0);
  const [limit, setLimit] = useState(2);
  const [isPremium, setIsPremium] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const load = useCallback(async () => {
    try {
      const data = await api.get("/coach/history", token);
      setMessages(data.messages || []);
      setUsed(data.used || 0);
      setLimit(data.limit || 2);
      setIsPremium(!!data.is_premium);
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 100);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Premium is unlocked if the backend says so OR the device holds an active
  // StoreKit subscription (merged into the auth user). Keeps Aquacoach unlimited
  // right after an in-app purchase, even before the backend /iap/verify deploy.
  const isPremiumEffective = isPremium || !!user?.is_premium;
  const limitReached = !isPremiumEffective && used >= limit;

  const send = async () => {
    const text = input.trim();
    if (!text || sending || limitReached) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text }]);
    setSending(true);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    try {
      const res = await api.post("/coach/chat", { message: text }, token);
      setMessages((m) => [...m, { role: "assistant", text: res.reply }]);
      setUsed(res.used ?? used + 1);
      setLimit(res.limit ?? limit);
      setIsPremium(!!res.is_premium);
      refreshUser();
    } catch (e: any) {
      setMessages((m) => [...m, { role: "assistant", text: e?.message || t("auth.errGeneric") }]);
    } finally {
      setSending(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    }
  };

  const left = Math.max(0, limit - used);

  return (
    <View style={[styles.flex, { backgroundColor: colors.bg }]}>
      <LinearGradient
        colors={[colors.gradTop, colors.gradBottom]}
        style={[styles.header, { paddingTop: insets.top + spacing.md }]}
      >
        <View style={styles.headerRow}>
          <View style={styles.coachAvatar}>
            <Ionicons name="sparkles" size={20} color={colors.white} />
          </View>
          <View>
            <Text style={styles.headerTitle}>{t("coach.title")}</Text>
            <Text style={styles.headerSub}>{t("coach.subtitle")}</Text>
          </View>
        </View>
      </LinearGradient>

      <KeyboardAvoidingView
        behavior="translate-with-padding"
        keyboardVerticalOffset={insets.bottom + (Platform.OS === "ios" ? 88 : 64)}
        style={styles.flex}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.messages}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
          ) : messages.length === 0 ? (
            <View style={styles.emptyBox}>
              <Ionicons name="chatbubbles-outline" size={36} color={colors.textMuted} />
              <Text style={styles.emptyText}>{t("coach.empty")}</Text>
            </View>
          ) : (
            messages.map((m, i) => {
              const mine = m.role === "user";
              return (
                <View
                  key={i}
                  testID={`coach-msg-${i}`}
                  style={[styles.bubbleRow, { justifyContent: mine ? "flex-end" : "flex-start" }]}
                >
                  <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleCoach]}>
                    <Text style={[styles.bubbleText, mine && { color: colors.white }]}>{m.text}</Text>
                  </View>
                </View>
              );
            })
          )}
          {sending && (
            <View style={[styles.bubbleRow, { justifyContent: "flex-start" }]}>
              <View style={[styles.bubble, styles.bubbleCoach]}>
                <Text style={[styles.bubbleText, { color: colors.textMuted }]}>{t("coach.thinking")}</Text>
              </View>
            </View>
          )}
        </ScrollView>

        {limitReached ? (
          <View style={[styles.upsell, { paddingBottom: insets.bottom + spacing.sm }]}>
            <Text style={styles.upsellText}>{t("coach.limitReached")}</Text>
            <Pressable
              testID="coach-upgrade-button"
              onPress={() => router.push("/premium")}
              style={styles.upsellBtn}
            >
              <Ionicons name="sparkles" size={16} color={colors.white} />
              <Text style={styles.upsellBtnText}>{t("coach.upgrade")}</Text>
            </Pressable>
          </View>
        ) : (
          <View style={[styles.inputBar, { paddingBottom: insets.bottom > 0 ? insets.bottom : spacing.sm }]}>
            {!isPremiumEffective && (
              <Text style={styles.left}>{t("coach.messagesLeft", { n: left })}</Text>
            )}
            <View style={styles.inputRow}>
              <TextInput
                testID="coach-input"
                value={input}
                onChangeText={setInput}
                placeholder={t("coach.placeholder")}
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                multiline
                onSubmitEditing={send}
              />
              <Pressable
                testID="coach-send-button"
                onPress={send}
                disabled={sending || !input.trim()}
                style={[styles.sendBtn, (!input.trim() || sending) && { opacity: 0.5 }]}
              >
                <Ionicons name="send" size={18} color={colors.white} />
              </Pressable>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
  },
  headerRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  coachAvatar: {
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    backgroundColor: "rgba(255,255,255,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { color: colors.white, fontSize: font.h2, fontWeight: "800" },
  headerSub: { color: "rgba(255,255,255,0.85)", fontSize: font.tiny },
  messages: { padding: spacing.md, paddingBottom: spacing.lg },
  emptyBox: { alignItems: "center", gap: spacing.sm, marginTop: spacing.xxl, paddingHorizontal: spacing.lg },
  emptyText: { color: colors.textMuted, fontSize: font.small, textAlign: "center" },
  bubbleRow: { flexDirection: "row", marginBottom: spacing.sm },
  bubble: { maxWidth: "82%", borderRadius: radius.lg, padding: spacing.md, ...shadow.soft },
  bubbleMine: { backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  bubbleCoach: { backgroundColor: colors.card, borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: font.small, color: colors.text, lineHeight: 21 },
  upsell: {
    backgroundColor: colors.card,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    alignItems: "center",
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  upsellText: { color: colors.textSecondary, fontSize: font.small, fontWeight: "600" },
  upsellBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    borderRadius: radius.pill,
    ...shadow.button,
  },
  upsellBtnText: { color: colors.white, fontWeight: "700", fontSize: font.small },
  inputBar: {
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  left: { color: colors.textMuted, fontSize: font.tiny, fontWeight: "600", marginBottom: 6, marginLeft: 4 },
  inputRow: { flexDirection: "row", alignItems: "flex-end", gap: spacing.sm },
  input: {
    flex: 1,
    backgroundColor: colors.cardAlt,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: font.body,
    color: colors.text,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sendBtn: {
    width: 46,
    height: 46,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
});
