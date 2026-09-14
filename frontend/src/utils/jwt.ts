// Minimal JWT helpers. These DO NOT verify the signature (the backend does
// that) — they only read the `exp` claim so the app can detect an expired
// session locally before making sensitive calls (e.g. /iap/verify, /iap/restore).
// Session tokens expire after 7 days.

const B64 =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

// Dependency-free base64 decode (atob polyfill) — safe on Hermes/React Native.
function base64Decode(input: string): string {
  const str = input.replace(/=+$/, "");
  let output = "";
  let bc = 0;
  let bs = 0;

  for (let i = 0; i < str.length; i++) {
    const c = B64.indexOf(str[i]);
    if (c === -1) continue;
    bs = bc % 4 ? bs * 64 + c : c;
    if (bc++ % 4) {
      output += String.fromCharCode(
        255 & (bs >> ((-2 * bc) & 6)),
      );
    }
  }

  return output;
}

export function getJwtExp(token?: string | null): number | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length < 2) return null;

  try {
    const b64url = parts[1]
      .replace(/-/g, "+")
      .replace(/_/g, "/");
    const payload = JSON.parse(base64Decode(b64url));
    return typeof payload?.exp === "number"
      ? payload.exp
      : null;
  } catch {
    return null;
  }
}

// True only when we can positively determine the token is past its exp
// (with a small clock-skew margin). If exp can't be read, we DON'T block —
// the backend remains the authority and will reject a truly invalid token.
export function isJwtExpired(
  token?: string | null,
  skewSeconds = 60,
): boolean {
  const exp = getJwtExp(token);
  if (!exp) return false;
  return Date.now() >= (exp - skewSeconds) * 1000;
}
