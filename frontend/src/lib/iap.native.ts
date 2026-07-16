import Constants from "expo-constants";
import { Platform } from "react-native";

// Apple StoreKit 2 in-app subscriptions via expo-iap.
// iOS-only. The native module is absent in Expo Go and on web, so every
// call is guarded. The .web.ts twin is a full no-op for the web bundle.
export const IAP_ENABLED = Platform.OS === "ios" && Constants.appOwnership !== "expo";

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

let _mod: any = null;
function iap() {
  if (!_mod) _mod = require("expo-iap");
  return _mod;
}

export async function initIap(): Promise<boolean> {
  if (!IAP_ENABLED) return false;
  try {
    await iap().initConnection();
    return true;
  } catch {
    return false;
  }
}

export async function endIap(): Promise<void> {
  if (!IAP_ENABLED) return;
  try {
    await iap().endConnection();
  } catch {
    // ignore
  }
}

export async function getSubscriptions(): Promise<IapProduct[]> {
  if (!IAP_ENABLED) return [];
  try {
    const products = await iap().fetchProducts({ skus: PRODUCT_IDS, type: "subs" });
    return (products ?? []).map((p: any) => {
      const mode =
        p.introductoryPricePaymentModeIOS ??
        p.subscriptionInfoIOS?.introductoryOffer?.paymentMode ??
        "";
      const hasFreeTrial = String(mode).toLowerCase().includes("free");
      return {
        id: p.id ?? p.productId,
        title: p.title ?? p.displayName ?? p.id,
        displayPrice: p.displayPrice ?? p.localizedPrice ?? p.price ?? "",
        hasFreeTrial,
        raw: p,
      };
    });
  } catch {
    return [];
  }
}

// Register purchase listeners. Returns an unsubscribe fn.
export function addPurchaseListeners(
  onSuccess: (purchase: any) => void,
  onError: (err: any) => void,
): () => void {
  if (!IAP_ENABLED) return () => {};
  const s1 = iap().purchaseUpdatedListener(onSuccess);
  const s2 = iap().purchaseErrorListener(onError);
  return () => {
    try {
      s1?.remove?.();
      s2?.remove?.();
    } catch {
      // ignore
    }
  };
}

export async function requestSubscription(sku: string): Promise<void> {
  if (!IAP_ENABLED) return;
  // Result is delivered via the purchaseUpdatedListener, not the return value.
  await iap().requestPurchase({ request: { apple: { sku } }, type: "subs" });
}

export async function finishPurchase(purchase: any): Promise<void> {
  if (!IAP_ENABLED) return;
  try {
    await iap().finishTransaction({ purchase, isConsumable: false });
  } catch {
    // ignore
  }
}

// Trigger a restore then report whether any Aquadify subscription is active.
export async function restoreAndCheck(): Promise<boolean> {
  if (!IAP_ENABLED) return false;
  try {
    await iap().restorePurchases();
    const active = await iap().hasActiveSubscriptions(PRODUCT_IDS);
    return !!active;
  } catch {
    return false;
  }
}

export async function hasActive(): Promise<boolean> {
  if (!IAP_ENABLED) return false;
  try {
    return !!(await iap().hasActiveSubscriptions(PRODUCT_IDS));
  } catch {
    return false;
  }
}
