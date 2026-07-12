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
  payload: { product_id: string; transaction_id?: string; jws?: string },
  token: string | null,
): Promise<any> {
  return api.post("/iap/verify", payload, token);
}
