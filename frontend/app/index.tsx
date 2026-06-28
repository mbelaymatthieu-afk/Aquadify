import { LinearGradient } from "expo-linear-gradient";
import { Redirect } from "expo-router";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { Mascot } from "@/src/components/Mascot";
import { useAuth } from "@/src/context/AuthContext";
import { colors, font, spacing } from "@/src/theme";

export default function Index() {
  const { loading, user } = useAuth();

  if (loading) {
    return (
      <LinearGradient colors={[colors.gradTop, colors.gradBottom]} style={styles.container}>
        <Mascot size={110} />
        <Text style={styles.title}>Aquadify</Text>
        <ActivityIndicator color={colors.white} style={{ marginTop: spacing.lg }} />
      </LinearGradient>
    );
  }

  if (!user) return <Redirect href="/auth" />;
  if (!user.onboarded) return <Redirect href="/onboarding" />;
  return <Redirect href="/(tabs)" />;
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center" },
  title: {
    color: colors.white,
    fontSize: font.hero,
    fontWeight: "800",
    marginTop: spacing.md,
    letterSpacing: -1,
  },
});
