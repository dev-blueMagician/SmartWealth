import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type EnvKey = "sandbox" | "production";

export type EnvDescriptor = {
  key: EnvKey;
  label: string;
  baseUrl: string;
  tokenPrefix: string;
};

export const ENVIRONMENTS: Record<EnvKey, EnvDescriptor> = {
  sandbox: {
    key: "sandbox",
    label: "Sandbox",
    baseUrl: "https://sandbox.smartwealth.example",
    tokenPrefix: "sk_sandbox_",
  },
  production: {
    key: "production",
    label: "Production",
    baseUrl: "https://api.smartwealth.example",
    tokenPrefix: "sk_live_",
  },
};

type EnvContextValue = {
  env: EnvDescriptor;
  setEnv: (key: EnvKey) => void;
};

const STORAGE_KEY = "smartwealth_dev_env";
const EnvContext = createContext<EnvContextValue | null>(null);

export function EnvProvider({ children }: { children: ReactNode }) {
  const [envKey, setEnvKey] = useState<EnvKey>(() => {
    if (typeof window === "undefined") return "sandbox";
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === "production" ? "production" : "sandbox";
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, envKey);
  }, [envKey]);

  const value = useMemo<EnvContextValue>(
    () => ({
      env: ENVIRONMENTS[envKey],
      setEnv: setEnvKey,
    }),
    [envKey],
  );

  return <EnvContext.Provider value={value}>{children}</EnvContext.Provider>;
}

export function useEnv(): EnvContextValue {
  const ctx = useContext(EnvContext);
  if (!ctx) throw new Error("useEnv must be used inside EnvProvider");
  return ctx;
}
