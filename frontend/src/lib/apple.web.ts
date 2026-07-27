// Web / non-iOS no-op twin of apple.native.ts. Keeps expo-apple-authentication
// out of the web bundle entirely so the preview never crashes.

export type AppleCredential = {
  identityToken: string;
  fullName: string | null;
  email: string | null;
};

export async function isAppleAvailable(): Promise<boolean> {
  return false;
}

export async function signInWithApple(): Promise<AppleCredential | null> {
  return null;
}

export function isAppleCancel(_e: any): boolean {
  return false;
}
