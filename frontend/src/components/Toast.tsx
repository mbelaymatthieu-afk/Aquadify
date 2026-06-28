import { Ionicons } from "@expo/vector-icons";
import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { Animated, StyleSheet, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, font, radius, shadow, spacing } from "@/src/theme";

type ToastType = "success" | "error" | "info";
type ToastValue = { show: (message: string, type?: ToastType) => void };

const ToastContext = createContext<ToastValue>({ show: () => {} });

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const [message, setMessage] = useState("");
  const [type, setType] = useState<ToastType>("info");
  const translateY = useRef(new Animated.Value(-120)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(
    (msg: string, t: ToastType = "info") => {
      setMessage(msg);
      setType(t);
      if (hideTimer.current) clearTimeout(hideTimer.current);
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: 8,
      }).start();
      hideTimer.current = setTimeout(() => {
        Animated.timing(translateY, {
          toValue: -120,
          duration: 250,
          useNativeDriver: true,
        }).start();
      }, 2400);
    },
    [translateY],
  );

  const icon =
    type === "success" ? "checkmark-circle" : type === "error" ? "alert-circle" : "information-circle";
  const tint = type === "success" ? colors.success : type === "error" ? colors.danger : colors.primary;

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <Animated.View
        pointerEvents="none"
        testID="app-toast"
        style={[
          styles.toast,
          { top: insets.top + spacing.sm, transform: [{ translateY }] },
        ]}
      >
        <Ionicons name={icon as any} size={20} color={tint} />
        <Text style={styles.text} numberOfLines={2}>
          {message}
        </Text>
      </Animated.View>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

const styles = StyleSheet.create({
  toast: {
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.card,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    ...shadow.card,
  },
  text: {
    flex: 1,
    color: colors.text,
    fontSize: font.small,
    fontWeight: "600",
  },
});
