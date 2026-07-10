import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import Svg, { ClipPath, Defs, LinearGradient, Path, Stop } from "react-native-svg";

import { colors, font } from "@/src/theme";

const DROP = "M50 4 C50 4 13 49 13 79 C13 100 30 116 50 116 C70 116 87 100 87 79 C87 49 50 4 50 4 Z";
const W = 100;
const H = 120;

const AnimatedPath = Animated.createAnimatedComponent(Path);

function buildWave(level: number, phase: number, amp: number, waves: number): string {
  "worklet";
  const lvl = Math.max(0, Math.min(1, level));
  const y = H - lvl * H;
  const steps = 14;
  let d = `M 0 ${y.toFixed(2)}`;
  for (let i = 0; i <= steps; i++) {
    const x = (W / steps) * i;
    const yy = y + amp * Math.sin((i / steps) * Math.PI * 2 * waves + phase);
    d += ` L ${x.toFixed(2)} ${yy.toFixed(2)}`;
  }
  d += ` L ${W} ${H} L 0 ${H} Z`;
  return d;
}

export function WaterDropProgress({
  progress,
  total,
  goal,
  size = 220,
}: {
  progress: number;
  total: number;
  goal: number;
  size?: number;
}) {
  const w = size;
  const h = size * 1.2;
  const clamped = Math.max(0, Math.min(1, progress));
  const pct = Math.round(clamped * 100);

  const level = useSharedValue(0);
  const phase = useSharedValue(0);
  const pop = useSharedValue(1);
  const first = useSharedValue(true);

  useEffect(() => {
    phase.value = withRepeat(withTiming(Math.PI * 2, { duration: 2200, easing: Easing.linear }), -1, false);
  }, [phase]);

  useEffect(() => {
    level.value = withTiming(clamped, { duration: 900, easing: Easing.out(Easing.cubic) });
    if (first.value) {
      first.value = false;
    } else {
      pop.value = withSequence(
        withTiming(1.06, { duration: 160, easing: Easing.out(Easing.quad) }),
        withTiming(1, { duration: 260, easing: Easing.inOut(Easing.quad) }),
      );
    }
  }, [clamped, level, pop, first]);

  const frontProps = useAnimatedProps(() => ({ d: buildWave(level.value, phase.value, 3.4, 2) }));
  const backProps = useAnimatedProps(() => ({
    d: buildWave(level.value, phase.value + Math.PI, 2.6, 1.6),
  }));

  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));

  return (
    <Animated.View style={[{ width: w, height: h, alignItems: "center", justifyContent: "center" }, popStyle]}>
      <Svg width={w} height={h} viewBox="0 0 100 120" style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="waterFront" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.primaryLight} />
            <Stop offset="1" stopColor={colors.primaryDark} />
          </LinearGradient>
          <LinearGradient id="waterBack" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#8FD4FB" />
            <Stop offset="1" stopColor={colors.primary} />
          </LinearGradient>
          <ClipPath id="dropClip">
            <Path d={DROP} />
          </ClipPath>
        </Defs>

        {/* empty track */}
        <Path d={DROP} fill={colors.track} />

        {/* water layers clipped to droplet */}
        <AnimatedPath animatedProps={backProps} fill="url(#waterBack)" opacity={0.55} clipPath="url(#dropClip)" />
        <AnimatedPath animatedProps={frontProps} fill="url(#waterFront)" clipPath="url(#dropClip)" />

        {/* outline */}
        <Path d={DROP} fill="none" stroke={colors.white} strokeWidth={3} />
      </Svg>

      <View style={styles.center}>
        <Text
          style={[styles.pct, { color: clamped > 0.42 ? colors.white : colors.primary }]}
          testID="today-progress-pct"
        >
          {pct}%
        </Text>
        <Text style={[styles.ml, { color: clamped > 0.5 ? "rgba(255,255,255,0.92)" : colors.textSecondary }]}>
          {total} / {goal} ml
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
  pct: { fontSize: 46, fontWeight: "800", letterSpacing: -1 },
  ml: { fontSize: font.small, fontWeight: "700", marginTop: 2 },
});
