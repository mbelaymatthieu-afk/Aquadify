// Account deletion + IAP entitlement verification against the remote
// drip-track1 backend. These endpoints must be deployed on the production
// backend (see backend/DEPLOY_TO_REMOTE.md).
import { api } from "@/src/api/client";

export async function deleteAccount(token: string | null): Promise<void> {
  await api.del("/account", token);
}

// Verify a StoreKit purchase server-side and unlock Premium.
// Returns the updated user on success. Throws if the endpoint is missing
// (not yet deployed) or verification fails.
export async function verifyIapPurchase(
  payload: {
    product_id: string;
    transaction_id?: string;
    jws?: string;
    appAccountToken?: string | null;
  },
  token: string | null,
): Promise<any> {
  // The deployed backend requires the StoreKit 2 signed transaction JWS under
  // the key `signedTransaction`. Map our jws to it (extra keys are ignored).
  // `appAccountToken` (stable per-account UUID) is also sent so the backend can
  // bind the subscription to the authenticated Aquadify account.
  const body = {
    signedTransaction: payload.jws,
    appAccountToken: payload.appAccountToken ?? undefined,
    product_id: payload.product_id,
    transaction_id: payload.transaction_id,
    jws: payload.jws,
  };
  return api.post("/iap/verify", body, token);
}

// Restore a StoreKit purchase server-side. Sends EXACTLY the signed transaction
// JWS + the stable per-account appAccountToken. Returns the updated user on
// success. Throws (incl. 409 when the subscription belongs to another account)
// so the caller can handle it — Premium is NEVER granted locally.
export async function restoreIapPurchase(
  payload: { jws?: string; appAccountToken?: string | null },
  token: string | null,
): Promise<any> {
  const body = {
    signedTransaction: payload.jws,
    appAccountToken: payload.appAccountToken ?? undefined,
  };
  return api.post("/iap/restore", body, token);
}
