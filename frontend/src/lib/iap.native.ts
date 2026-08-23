import Constants from "expo-constants";
import { Platform } from "react-native";

// Apple StoreKit 2 in-app subscriptions via expo-iap.
export const IAP_ENABLED =
  Platform.OS === "ios" && Constants.appOwnership !== "expo";

export const SKU_MONTHLY =
  "com.mtagency.aquadify.premium.monthly";

export const SKU_YEARLY =
  "com.mtagency.aquadify.premium.yearly";

export const PRODUCT_IDS = [
  SKU_MONTHLY,
  SKU_YEARLY,
];

export type IapProduct = {
  id: string;
  title: string;
  displayPrice: string;
  hasFreeTrial: boolean;
  raw: any;
};

let _mod: any = null;

function iap() {
  if (!_mod) {
    _mod = require("expo-iap");
  }
  return _mod;
}

export async function initIap(): Promise<boolean> {
  if (!IAP_ENABLED) {
    console.log("[IAP] disabled");
    return false;
  }

  try {
    console.log("[IAP] initConnection...");
    await iap().initConnection();
    console.log("[IAP] connection OK");
    return true;
  } catch (e: any) {
    console.log(
      "[IAP] initConnection FAILED:",
      e?.code,
      e?.message,
      e,
    );
    return false;
  }
}

export async function endIap(): Promise<void> {
  if (!IAP_ENABLED) return;

  try {
    await iap().endConnection();
  } catch (e: any) {
    console.log(
      "[IAP] endConnection error:",
      e?.message,
    );
  }
}

export async function getSubscriptions(): Promise<IapProduct[]> {
  if (!IAP_ENABLED) return [];

  try {
    console.log(
      "[IAP] Fetching subscriptions:",
      PRODUCT_IDS,
    );

    const products = await iap().fetchProducts({
      skus: PRODUCT_IDS,
      type: "subs",
    });

    console.log(
      "[IAP] Raw products:",
      JSON.stringify(products),
    );

    if (!products || products.length === 0) {
      console.log(
        "[IAP] WARNING: Apple returned ZERO subscriptions",
      );
      return [];
    }

    const mapped = products.map((p: any) => {
      const mode =
        p.introductoryPricePaymentModeIOS ??
        p.subscriptionInfoIOS?.introductoryOffer
          ?.paymentMode ??
        "";

      const hasFreeTrial = String(mode)
        .toLowerCase()
        .includes("free");

      return {
        id: p.id ?? p.productId,
        title:
          p.title ??
          p.displayName ??
          p.id ??
          p.productId,
        displayPrice:
          p.displayPrice ??
          p.localizedPrice ??
          p.price ??
          "",
        hasFreeTrial,
        raw: p,
      };
    });

    console.log(
      "[IAP] Loaded product IDs:",
      mapped.map((p: IapProduct) => p.id),
    );

    return mapped;
  } catch (e: any) {
    console.log(
      "[IAP] fetchProducts FAILED:",
      e?.code,
      e?.message,
      e,
    );

    return [];
  }
}

export function addPurchaseListeners(
  onSuccess: (purchase: any) => void,
  onError: (err: any) => void,
): () => void {
  if (!IAP_ENABLED) return () => {};

  const s1 = iap().purchaseUpdatedListener(
    (purchase: any) => {
      console.log(
        "[IAP] purchaseUpdated:",
        JSON.stringify(purchase),
      );

      onSuccess(purchase);
    },
  );

  const s2 = iap().purchaseErrorListener(
    (error: any) => {
      console.log(
        "[IAP] purchaseError:",
        error?.code,
        error?.message,
        error,
      );

      onError(error);
    },
  );

  return () => {
    try {
      s1?.remove?.();
      s2?.remove?.();
    } catch {
      // ignore
    }
  };
}

export async function requestSubscription(
  sku: string,
): Promise<any> {
  if (!IAP_ENABLED) return null;

  console.log(
    "[IAP] requestSubscription SKU:",
    sku,
  );

  if (!PRODUCT_IDS.includes(sku)) {
    throw new Error(
      `Unknown Aquadify subscription SKU: ${sku}`,
    );
  }

  try {
    // On iOS StoreKit 2, requestPurchase resolves with the completed
    // transaction. We RETURN it so the caller can verify it directly instead
    // of relying only on purchaseUpdatedListener (which de-duplicates iOS
    // transactions and can be suppressed for replayed/unfinished ones).
    const result = await iap().requestPurchase({
      request: {
        apple: {
          sku,
        },
      },
      type: "subs",
    });

    console.log(
      "[IAP] requestPurchase resolved:",
      JSON.stringify(result),
    );

    return result;
  } catch (e: any) {
    console.log(
      "[IAP] requestPurchase FAILED:",
      e?.code,
      e?.message,
      e,
    );

    throw e;
  }
}

export async function finishPurchase(
  purchase: any,
): Promise<void> {
  if (!IAP_ENABLED) return;

  try {
    await iap().finishTransaction({
      purchase,
      isConsumable: false,
    });
  } catch (e: any) {
    console.log(
      "[IAP] finishTransaction FAILED:",
      e?.code,
      e?.message,
      e,
    );
  }
}

export async function restoreAndCheck(): Promise<boolean> {
  if (!IAP_ENABLED) return false;

  try {
    await iap().restorePurchases();

    const active =
      await iap().hasActiveSubscriptions(
        PRODUCT_IDS,
      );

    return !!active;
  } catch (e: any) {
    console.log(
      "[IAP] restore FAILED:",
      e?.code,
      e?.message,
      e,
    );

    return false;
  }
}

export async function hasActive(): Promise<boolean> {
  if (!IAP_ENABLED) return false;

  try {
    return !!(
      await iap().hasActiveSubscriptions(
        PRODUCT_IDS,
      )
    );
  } catch (e: any) {
    console.log(
      "[IAP] hasActive FAILED:",
      e?.code,
      e?.message,
      e,
    );

    return false;
  }
}