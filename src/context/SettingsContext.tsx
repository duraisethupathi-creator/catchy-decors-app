import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { defaultSettings, getSettings, saveSettings, resetSettings } from '../services/settingsService';
import { getBrandLogo } from '../constants/company';
import type { AppSettings, CompanyProfile, QuotationTemplate } from '../types/settings';

interface SettingsCtx {
  settings: AppSettings;
  loading: boolean;
  /** Accent colour applied to the UI (user-customisable). */
  accent: string;
  reload: () => Promise<void>;
  setProfile: (p: CompanyProfile) => Promise<void>;
  setTemplate: (t: QuotationTemplate) => Promise<void>;
  replaceAll: (s: AppSettings) => Promise<void>;
  reset: () => Promise<void>;
}

const Ctx = createContext<SettingsCtx>({
  settings: defaultSettings(),
  loading: true,
  accent: '#FF7A00',
  reload: async () => {},
  setProfile: async () => {},
  setTemplate: async () => {},
  replaceAll: async () => {},
  reset: async () => {},
});

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, set] = useState<AppSettings>(defaultSettings());
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    set(await getSettings());
  }, []);

  useEffect(() => {
    reload().finally(() => setLoading(false));
  }, [reload]);

  const setProfile = useCallback(async (profile: CompanyProfile) => {
    const next = { ...(await getSettings()), profile };
    await saveSettings(next);
    set(next);
  }, []);

  const setTemplate = useCallback(async (template: QuotationTemplate) => {
    const next = { ...(await getSettings()), template };
    await saveSettings(next);
    set(next);
  }, []);

  const replaceAll = useCallback(async (s: AppSettings) => {
    await saveSettings(s);
    set(s);
  }, []);

  const reset = useCallback(async () => {
    set(await resetSettings());
  }, []);

  return (
    <Ctx.Provider
      value={{ settings, loading, accent: settings.template.accentColor, reload, setProfile, setTemplate, replaceAll, reset }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useSettings(): SettingsCtx {
  return useContext(Ctx);
}

/**
 * Resolved logo source for every in-app header:
 * the logo the user picked in Business Profile, or the bundled brand mark.
 */
export function useLogoSource(): any {
  const { settings } = useSettings();
  return settings.profile.logoUri ? { uri: settings.profile.logoUri } : getBrandLogo();
}
