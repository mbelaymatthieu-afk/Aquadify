import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, {
  ClipPath,
  Defs,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from "react-native-svg";

import { colors, font } from "@/src/theme";

const DROP = "M50 6 C50 6 14 50 14 78 C14 99 31 114 50 114 C69 114 86 99 86 78 C86 50 50 6 50 6 Z";

// Big water-drop that fills with the day's progress.
export function WaterDropProgress({
  progress,
  total,
  goal,
  size = 220,
}: {
  progress: number; // 0..1
  total: number;
  goal: number;
  size?: number;
}) {
  const w = size;
  const h = size * 1.2;
  const clamped = Math.max(0, Math.min(1, progress));
  const fillTop = 120 - 120 * clamped;
  const pct = Math.round(clamped * 100);

  return (
    <View style={{ width: w, height: h, alignItems: "center", justifyContent: "center" }}>
      <Svg width={w} height={h} viewBox="0 0 100 120" style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="fillGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.primaryLight} />
            <Stop offset="1" stopColor={colors.primaryDark} />
          </LinearGradient>
          <ClipPath id="dropClip">
            <Path d={DROP} />
          </ClipPath>
        </Defs>
        {/* light track */}
        <Path d={DROP} fill={colors.track} />
        {/* fill */}
        <Rect
          x="0"
          y={fillTop}
          width="100"
          height={120 - fillTop}
          fill="url(#fillGrad)"
          clipPath="url(#dropClip)"
        />
        {/* outline */}
        <Path d={DROP} fill="none" stroke={colors.white} strokeWidth={3} />
      </Svg>
      <View style={styles.center}>
        <Text
          style={[styles.pct, { color: clamped > 0.45 ? colors.white : colors.primary }]}
          testID="today-progress-pct"
        >
          {pct}%
        </Text>
        <Text
          style={[styles.ml, { color: clamped > 0.55 ? "rgba(255,255,255,0.9)" : colors.textSecondary }]}
        >
          {total} / {goal} ml
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
  pct: { fontSize: 44, fontWeight: "800", letterSpacing: -1 },
  ml: { fontSize: font.small, fontWeight: "700", marginTop: 2 },
});
