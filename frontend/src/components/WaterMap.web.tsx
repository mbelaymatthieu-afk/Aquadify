import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import { colors, font, spacing } from "@/src/theme";

// Maps don't render on web preview — show a friendly placeholder.
export default function WaterMap() {
  return (
    <View style={styles.box}>
      <Ionicons name="map-outline" size={40} color={colors.primary} />
      <Text style={styles.text}>Carte disponible sur l&apos;application mobile.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.primarySoft,
  },
  text: { color: colors.textSecondary, fontSize: font.small, paddingHorizontal: spacing.lg, textAlign: "center" },
});
