import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import React, { createContext, useContext, useEffect, useState } from "react";
import { Platform } from "react-native";

import { api } from "@/src/api/client";
import { hasActive } from "@/src/lib/iap";
import { storage } from "@/src/utils/storage";

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
  register: (name: string, email: string, password: string) => Promise<void>;
  googleLogin: () => Promise<boolean>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setUser: (u: AquaUser) => void;
};

const AuthContext = createContext<AuthValue>({} as AuthValue);

WebBrowser.maybeCompleteAuthSession();

// Merge the device's StoreKit entitlement into the user. On iOS, an active
// subscription unlocks Premium even if the (remote) backend hasn't recorded it
// yet — StoreKit current entitlements are the on-device source of truth and
// work offline. Returns free if no active subscription (no stale caching).
async function applyLocalPremium(u: AquaUser): Promise<AquaUser> {
  if (u.is_premium) return u;
  try {
    if (await hasActive()) return { ...u, is_premium: true };
  } catch {
    // ignore — treat as free
  }
  return u;
}

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
          setUser(await applyLocalPremium(me));
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
    setUser(await applyLocalPremium(data.user));
  };

  const login = async (email: string, password: string) => {
    const data = await api.post<{ token: string; user: AquaUser }>("/auth/login", {
      email,
      password,
    });
    await persist(data);
  };

  const register = async (name: string, email: string, password: string) => {
    const data = await api.post<{ token: string; user: AquaUser }>("/auth/register", {
      name,
      email,
      password,
    });
    await persist(data);
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
    setUser(await applyLocalPremium(me));
  };

  return (
    <AuthContext.Provider
      value={{ loading, user, token, login, register, googleLogin, logout, refreshUser, setUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
