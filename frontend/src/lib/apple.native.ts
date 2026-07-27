import { Platform } from "react-native";

// Native Sign in with Apple (iOS only) via expo-apple-authentication.
// The .web.ts twin is a full no-op so the web bundle never loads the module.

let _mod: any = null;
function apple() {
  if (!_mod) _mod = require("expo-apple-authentication");
  return _mod;
}

export type AppleCredential = {
  identityToken: string;
  fullName: string | null;
  email: string | null;
};

export async function isAppleAvailable(): Promise<boolean> {
  if (Platform.OS !== "ios") return false;
  try {
    return await apple().isAvailableAsync();
  } catch {
    return false;
  }
}

export async function signInWithApple(): Promise<AppleCredential | null> {
  if (Platform.OS !== "ios") return null;
  const A = apple();
  const cred = await A.signInAsync({
    requestedScopes: [
      A.AppleAuthenticationScope.FULL_NAME,
      A.AppleAuthenticationScope.EMAIL,
    ],
  });
  if (!cred?.identityToken) return null;
  const name = cred.fullName
    ? [cred.fullName.givenName, cred.fullName.familyName].filter(Boolean).join(" ").trim()
    : "";
  return {
    identityToken: cred.identityToken,
    fullName: name || null,
    email: cred.email ?? null,
  };
}

// User dismissed the native sheet — not a real error.
export function isAppleCancel(e: any): boolean {
  return e?.code === "ERR_REQUEST_CANCELED" || e?.code === "ERR_CANCELED";
}
