import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, font, radius, spacing } from "@/src/theme";

type Props = { children: React.ReactNode };
type State = { hasError: boolean };

// Global error boundary — prevents the white screen of death on unhandled
// render errors (App Store stability). Placed outside the app providers, so
// the fallback copy is static French (the app default language).
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.log("[ErrorBoundary]", error?.message);
  }

  reset = () => this.setState({ hasError: false });

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <View style={styles.container}>
        <Text style={styles.emoji}>💧</Text>
        <Text style={styles.title}>Oups, une erreur est survenue</Text>
        <Text style={styles.body}>
          L&apos;application a rencontré un problème inattendu. Réessayez, tout devrait rentrer dans l&apos;ordre.
        </Text>
        <Pressable onPress={this.reset} style={styles.btn}>
          <Text style={styles.btnText}>Réessayer</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    backgroundColor: colors.bg,
  },
  emoji: { fontSize: 48, marginBottom: spacing.md },
  title: { fontSize: font.h2, fontWeight: "800", color: colors.text, textAlign: "center" },
  body: {
    fontSize: font.body,
    color: colors.textMuted,
    textAlign: "center",
    marginTop: spacing.sm,
    lineHeight: 22,
  },
  btn: {
    marginTop: spacing.lg,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xl,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  btnText: { color: colors.white, fontSize: font.body, fontWeight: "800" },
});
