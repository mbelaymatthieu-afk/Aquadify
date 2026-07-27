import * as AppleAuthentication from "expo-apple-authentication";
import { Platform, StyleSheet } from "react-native";

// Native "Sign in with Apple" button (App Store requirement — must use the
// system-rendered button). iOS only; renders nothing elsewhere.
export function AppleSignInButton({
  onPress,
  disabled,
}: {
  onPress: () => void;
  disabled?: boolean;
}) {
  if (Platform.OS !== "ios") return null;
  return (
    <AppleAuthentication.AppleAuthenticationButton
      buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
      buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
      cornerRadius={27}
      style={[styles.btn, disabled && styles.disabled]}
      onPress={() => {
        if (!disabled) onPress();
      }}
    />
  );
}

const styles = StyleSheet.create({
  btn: { width: "100%", height: 54, marginTop: 12 },
  disabled: { opacity: 0.6 },
});
