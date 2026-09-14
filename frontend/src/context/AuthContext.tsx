import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import React, { createContext, useContext, useEffect, useState } from "react";
import { Platform } from "react-native";

import { api } from "@/src/api/client";
import { signInWithApple } from "@/src/lib/apple";
import { storage } from "@/src/utils/storage";
import { isJwtExpired } from "@/src/utils/jwt";

const TOKEN_KEY = "aquadify_token";

export type AquaUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  onboarded: boolean;
  profile: any;
  daily_goal_ml: number;
  language: string;
  reminder_tone: string;
  picture?: string | null;
  auth_provider: string;
  reminders_enabled: boolean;
  reminder_interval: number;
  reminder_start: string;
  reminder_end: string;
  is_premium: boolean;
  coach_used: number;
  coach_limit: number;
  push_enabled: boolean;
  containers: { label: string; amount: number }[];
};

type AuthValue = {
  loading: boolean;
  user: AquaUser | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (
    name: string,
    email: string,
    password: string,
  ) => Promise<{ requiresVerification: boolean; email: string }>;
  verifyEmail: (email: string, code: string) => Promise<boolean>;
  resendVerification: (email: string) => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (email: string, code: string, password: string) => Promise<void>;
  googleLogin: () => Promise<boolean>;
  appleLogin: () => Promise<boolean>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  ensureValidSession: () => Promise<boolean>;
  setUser: (u: AquaUser) => void;
};

const AuthContext = createContext<AuthValue>({} as AuthValue);

WebBrowser.maybeCompleteAuthSession();

// SECURITY: Premium is owned by the authenticated Aquadify ACCOUNT, never by the
// device or its Apple ID. The backend (`is_premium` on the user object) is the
// ONLY source of truth. We must NOT infer Premium from StoreKit device-level
// entitlements (hasActiveSubscriptions), otherwise a second account signing in
// on the same iPhone would inherit the first account's subscription.
// => No local Premium is ever granted here. The user object is used as-is.

function parseSessionId(url: string): string | null {
  try {
    const hashPart = url.includes("#") ? url.split("#")[1] : "";
    const queryPart = url.includes("?") ? url.split("?")[1].split("#")[0] : "";
    for (const part of [hashPart, queryPart]) {
      if (!part) continue;
      const params = new URLSearchParams(part);
      const sid = params.get("session_id");
      if (sid) return sid;
    }
  } catch {
    // ignore
  }
  return null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<AquaUser | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const saved = (await storage.secureGet(TOKEN_KEY, "")) as string;
      if (saved) {
        try {
          const me = await api.get<AquaUser>("/auth/me", saved);
          setToken(saved);
          setUser(me);
        } catch {
          await storage.secureRemove(TOKEN_KEY);
        }
      }
      setLoading(false);
    })();
  }, []);

  const persist = async (data: { token: string; user: AquaUser }) => {
    await storage.secureSet(TOKEN_KEY, data.token);
    setToken(data.token);
    setUser(data.user);
  };

  const login = async (email: string, password: string) => {
    const data = await api.post<{ token: string; user: AquaUser }>("/auth/login", {
      email,
      password,
    });
    await persist(data);
  };

  const register = async (name: string, email: string, password: string) => {
    const data = await api.post<{ token?: string; user?: AquaUser; requires_verification?: boolean }>(
      "/auth/register",
      { name, email, password },
    );
    // New backend: no token, verification required -> caller routes to verify screen.
    if (data?.requires_verification || !data?.token) {
      return { requiresVerification: true, email };
    }
    // Legacy backend: returns token immediately -> log in as before.
    await persist(data as { token: string; user: AquaUser });
    return { requiresVerification: false, email };
  };

  const verifyEmail = async (email: string, code: string): Promise<boolean> => {
    const data = await api.post<{ token?: string; user?: AquaUser; ok?: boolean }>(
      "/auth/verify-email",
      { email, code },
    );
    if (data?.token && data?.user) {
      await persist({ token: data.token, user: data.user });
      return true; // auto-logged in
    }
    return false; // verified, but caller must send user to login
  };

  const resendVerification = async (email: string) => {
    await api.post("/auth/resend-verification", { email });
  };

  const forgotPassword = async (email: string) => {
    await api.post("/auth/forgot-password", { email });
  };

  const resetPassword = async (email: string, code: string, password: string) => {
    await api.post("/auth/reset-password", { email, code, password });
  };

  const googleLogin = async (): Promise<boolean> => {
    const redirectUrl =
      Platform.OS === "web"
        ? (typeof window !== "undefined" ? window.location.origin + "/" : "")
        : Linking.createURL("auth");
    const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;

    if (Platform.OS === "web") {
      if (typeof window !== "undefined") window.location.href = authUrl;
      return false;
    }

    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
    if (result.type !== "success" || !result.url) return false;
    const sid = parseSessionId(result.url);
    if (!sid) return false;
    const data = await api.post<{ token: string; user: AquaUser }>("/auth/google/session", {
      session_id: sid,
    });
    await persist(data);
    return true;
  };

  const appleLogin = async (): Promise<boolean> => {
    const cred = await signInWithApple();
    if (!cred) return false;
    const data = await api.post<{ token: string; user: AquaUser }>("/auth/apple", {
      identity_token: cred.identityToken,
      name: cred.fullName,
      email: cred.email,
    });
    await persist(data);
    return true;
  };

  const logout = async () => {
    try {
      if (token) await api.post("/auth/logout", {}, token);
    } catch {
      // ignore
    }
    await storage.secureRemove(TOKEN_KEY);
    setToken(null);
    setUser(null);
  };

  const refreshUser = async () => {
    if (!token) return;
    const me = await api.get<AquaUser>("/auth/me", token);
    setUser(me);
  };

  // Ensures the session token is present and still valid before sensitive calls
  // (e.g. /iap/verify, /iap/restore). Tokens expire after 7 days. Fails safely:
  // if there is no token, it is locally expired, or the backend rejects it
  // (401), the session is cleared and `false` is returned so the caller can
  // stop and ask the user to sign in again.
  const ensureValidSession = async (): Promise<boolean> => {
    if (!token) return false;

    if (isJwtExpired(token)) {
      await logout();
      return false;
    }

    try {
      const me = await api.get<AquaUser>("/auth/me", token);
      setUser(me);
      return true;
    } catch (e: any) {
      if (e?.status === 401) {
        await logout();
        return false;
      }
      // Transient/offline error but token is not locally expired: allow the
      // call to proceed (the backend still enforces auth on the request).
      return true;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        loading,
        user,
        token,
        login,
        register,
        verifyEmail,
        resendVerification,
        forgotPassword,
        resetPassword,
        googleLogin,
        appleLogin,
        logout,
        refreshUser,
        ensureValidSession,
        setUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
