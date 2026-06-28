import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

import { storage } from "@/src/utils/storage";

import { dict, Lang } from "./translations";

const LANG_KEY = "aquadify_lang";

type I18nValue = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nValue>({
  lang: "fr",
  setLang: () => {},
  t: (k) => k,
});

function resolve(lang: Lang, key: string): string {
  const parts = key.split(".");
  let cur: any = dict[lang];
  for (const p of parts) cur = cur?.[p];
  if (typeof cur !== "string") {
    let fb: any = dict.fr;
    for (const p of parts) fb = fb?.[p];
    cur = typeof fb === "string" ? fb : key;
  }
  return cur;
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("fr");

  useEffect(() => {
    (async () => {
      const saved = (await storage.getItem(LANG_KEY, "fr")) as Lang;
      if (saved && dict[saved]) setLangState(saved);
    })();
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    storage.setItem(LANG_KEY, l);
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      let s = resolve(lang, key);
      if (vars) {
        Object.keys(vars).forEach((k) => {
          s = s.replace(new RegExp(`\\{${k}\\}`, "g"), String(vars[k]));
        });
      }
      return s;
    },
    [lang],
  );

  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>;
}

export const useI18n = () => useContext(I18nContext);
