// Stable, deterministic Apple `appAccountToken` (RFC 4122 formatted UUID) for
// an Aquadify account.
//
// StoreKit's appAccountToken must be a UUID. We derive it DETERMINISTICALLY from
// the Aquadify account id so it is identical across devices and reinstalls, and
// so the backend can cross-check that a StoreKit transaction belongs to the
// currently authenticated account. No secret material is exposed (the account
// id is already known to the client), and this never grants Premium by itself —
// the backend remains the source of truth.

function fnv1a(str: string, seed: number): number {
  let h = seed >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    // 32-bit FNV prime multiply
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

function toHex8(n: number): string {
  return (n >>> 0).toString(16).padStart(8, "0");
}

// Variant nibble must be one of 8, 9, a, b (RFC 4122 "10xx").
const VARIANT: Record<string, string> = {
  "0": "8", "1": "9", "2": "a", "3": "b",
  "4": "8", "5": "9", "6": "a", "7": "b",
  "8": "8", "9": "9", a: "a", b: "b",
  c: "8", d: "9", e: "a", f: "b",
};

/**
 * Returns a stable UUID string (8-4-4-4-12) for the given Aquadify account id,
 * or null when there is no account id.
 */
export function accountAppAccountToken(
  accountId?: string | null,
): string | null {
  if (!accountId) return null;

  const a = toHex8(fnv1a(accountId, 0x811c9dc5));
  const b = toHex8(fnv1a(accountId, 0x01234567));
  const c = toHex8(fnv1a(accountId, 0x9e3779b9));
  const d = toHex8(fnv1a(accountId, 0x85ebca6b));

  const chars = (a + b + c + d).slice(0, 32).split("");
  // Force a valid version (5) and variant so it parses as a real UUID.
  chars[12] = "5";
  chars[16] = VARIANT[chars[16]] || "8";

  const h = chars.join("");
  return (
    `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-` +
    `${h.slice(16, 20)}-${h.slice(20, 32)}`
  );
}
