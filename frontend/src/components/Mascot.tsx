import React from "react";
import { View } from "react-native";
import Svg, { Defs, Ellipse, LinearGradient, Path, Stop } from "react-native-svg";

// Premium Aquadify brand mark: a glossy water droplet with an inner wave and
// a soft highlight. Sleeker/more premium than the old cartoon droplet.
export function Mascot({ size = 120 }: { size?: number }) {
  const w = size;
  const h = size * 1.2;
  const DROP = "M50 6 C50 6 15 49 15 78 C15 99 31 114 50 114 C69 114 85 99 85 78 C85 49 50 6 50 6 Z";
  return (
    <View style={{ width: w, height: h }}>
      <Svg width={w} height={h} viewBox="0 0 100 120">
        <Defs>
          <LinearGradient id="mBody" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#7FE3F0" />
            <Stop offset="0.5" stopColor="#3BA9F5" />
            <Stop offset="1" stopColor="#1E5FD0" />
          </LinearGradient>
          <LinearGradient id="mWave" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#2E7FE0" />
            <Stop offset="1" stopColor="#134FBE" />
          </LinearGradient>
        </Defs>
        {/* body */}
        <Path d={DROP} fill="url(#mBody)" stroke="rgba(255,255,255,0.85)" strokeWidth={2} />
        {/* inner wave */}
        <Path
          d="M22 80 C33 72 40 88 51 82 C61 77 70 88 79 82 L79 100 C74 110 62 114 50 114 C36 114 24 108 21 98 Z"
          fill="url(#mWave)"
          opacity={0.9}
        />
        <Path
          d="M24 76 C34 70 41 83 51 78 C61 73 69 83 78 78"
          stroke="rgba(255,255,255,0.75)"
          strokeWidth={2}
          fill="none"
          strokeLinecap="round"
        />
        {/* glossy highlight */}
        <Ellipse cx="40" cy="46" rx="9" ry="15" fill="rgba(255,255,255,0.55)" transform="rotate(-18 40 46)" />
      </Svg>
    </View>
  );
}
