import { Platform } from "react-native";

// Web / non-iOS no-op twin of iap.native.ts. Keeps expo-iap out of the
// web bundle entirely so the preview never crashes.
export const IAP_ENABLED = false;

export const SKU_MONTHLY = "com.mtagency.aquadify.premium.monthly";
export const SKU_YEARLY = "com.mtagency.aquadify.premium.yearly";
export const PRODUCT_IDS = [SKU_MONTHLY, SKU_YEARLY];

export type IapProduct = {
  id: string;
  title: string;
  displayPrice: string;
  hasFreeTrial: boolean;
  raw: any;
};

export async function initIap(): Promise<boolean> {
  return false;
}
export async function endIap(): Promise<void> {}
export async function getSubscriptions(): Promise<IapProduct[]> {
  return [];
}
export function addPurchaseListeners(
  _onSuccess: (purchase: any) => void,
  _onError: (err: any) => void,
): () => void {
  return () => {};
}
export async function requestSubscription(
  _sku: string,
  _appAccountToken?: string | null,
): Promise<void> {}
export async function finishPurchase(_purchase: any): Promise<void> {}
export async function restoreAndCheck(): Promise<boolean> {
  return false;
}
export async function hasActive(): Promise<boolean> {
  return false;
}

// Keep Platform import referenced so tree-shakers don't warn.
void Platform.OS;
