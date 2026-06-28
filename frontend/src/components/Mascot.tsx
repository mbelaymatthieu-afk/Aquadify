import React from "react";
import { View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from "react-native-svg";

import { colors } from "@/src/theme";

// The friendly Aquadify water-drop mascot (matches the existing brand).
export function Mascot({ size = 120 }: { size?: number }) {
  const w = size;
  const h = size * 1.2;
  return (
    <View style={{ width: w, height: h }}>
      <Svg width={w} height={h} viewBox="0 0 100 120">
        <Defs>
          <LinearGradient id="dropGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.primaryLight} />
            <Stop offset="1" stopColor={colors.primaryDark} />
          </LinearGradient>
        </Defs>
        <Path
          d="M50 6 C50 6 14 50 14 78 C14 99 31 114 50 114 C69 114 86 99 86 78 C86 50 50 6 50 6 Z"
          fill="url(#dropGrad)"
          stroke={colors.white}
          strokeWidth={3}
        />
        {/* cheeks */}
        <Circle cx="33" cy="86" r="6" fill="rgba(244,114,182,0.55)" />
        <Circle cx="67" cy="86" r="6" fill="rgba(244,114,182,0.55)" />
        {/* eyes */}
        <Circle cx="40" cy="74" r="4.5" fill="#0F2A5C" />
        <Circle cx="60" cy="74" r="4.5" fill="#0F2A5C" />
        {/* smile */}
        <Path
          d="M41 86 Q50 96 59 86"
          stroke="#0F2A5C"
          strokeWidth={3.4}
          strokeLinecap="round"
          fill="none"
        />
      </Svg>
    </View>
  );
}
