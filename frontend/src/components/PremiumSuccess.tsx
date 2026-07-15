import { Ionicons } from "@expo/vector-icons";
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { colors, font, radius, shadow, spacing } from "@/src/theme";

// Celebratory overlay shown right after Premium is unlocked.
export function PremiumSuccess({ message, onDone }: { message: string; onDone: () => void }) {
  const scale = useSharedValue(0);
  const ring = useSharedValue(0);
  const textOpacity = useSharedValue(0);

  useEffect(() => {
    scale.value = withSequence(
      withSpring(1.15, { damping: 6, stiffness: 140 }),
      withSpring(1, { damping: 8 }),
    );
    ring.value = withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) });
    textOpacity.value = withDelay(250, withTiming(1, { duration: 400 }));

    const timer = setTimeout(onDone, 2200);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const circleStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + ring.value * 1.6 }],
    opacity: 0.5 * (1 - ring.value),
  }));
  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
    transform: [{ translateY: (1 - textOpacity.value) * 12 }],
  }));

  return (
    <View style={styles.overlay} testID="premium-success">
      <View style={styles.badgeWrap}>
        <Animated.View style={[styles.ring, ringStyle]} />
        <Animated.View style={[styles.circle, circleStyle]}>
          <Ionicons name="checkmark" size={54} color={colors.white} />
        </Animated.View>
      </View>
      <Animated.Text style={[styles.title, textStyle]}>🎉</Animated.Text>
      <Animated.Text style={[styles.message, textStyle]}>{message}</Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15,23,42,0.92)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    zIndex: 20,
  },
  badgeWrap: { alignItems: "center", justifyContent: "center", marginBottom: spacing.lg },
  ring: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: radius.pill,
    backgroundColor: colors.success,
  },
  circle: {
    width: 120,
    height: 120,
    borderRadius: radius.pill,
    backgroundColor: colors.success,
    alignItems: "center",
    justifyContent: "center",
    ...shadow.button,
  },
  title: { fontSize: 40, textAlign: "center" },
  message: {
    color: colors.white,
    fontSize: font.h2,
    fontWeight: "800",
    textAlign: "center",
    marginTop: spacing.sm,
    lineHeight: 30,
  },
});
