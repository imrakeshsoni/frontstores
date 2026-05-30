import { create } from 'zustand';
import { AppConfig, getAppConfig } from '@/lib/db/config';
import { setReporterTenantId } from '@/lib/errorReporter';
import { runStartupChecks } from '@/lib/startupChecks';

interface AppState {
  config: AppConfig | null;
  isLoading: boolean;
  isSetupComplete: boolean;
  isAuthenticated: boolean;
  // [medical] [all tenants] — last billed customer for AI khata reminder
  lastBilledCustomer: { id: string | null; name: string | null } | null;

  loadConfig: () => Promise<void>;
  // [core] [all tenants] — refreshes config without flashing the full-screen loader
  refreshConfig: () => Promise<void>;
  setConfig: (config: AppConfig) => void;
  setAuthenticated: (v: boolean) => void;
  setLastBilledCustomer: (c: { id: string | null; name: string | null } | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  config: null,
  isLoading: true,
  isSetupComplete: false,
  isAuthenticated: false,
  lastBilledCustomer: null,

  loadConfig: async () => {
    set({ isLoading: true });
    try {
      const config = await getAppConfig();
      if (config?.tenant_id) {
        setReporterTenantId(config.tenant_id);
        if (config.is_setup_complete) runStartupChecks(config.tenant_id, config.shop_type).catch(() => {});
      }
      set({ config, isSetupComplete: config?.is_setup_complete ?? false, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  refreshConfig: async () => {
    try {
      const config = await getAppConfig();
      if (config?.tenant_id) setReporterTenantId(config.tenant_id);
      set({ config, isSetupComplete: config?.is_setup_complete ?? false });
    } catch { /* silent */ }
  },

  setConfig: (config) => { setReporterTenantId(config.tenant_id); set({ config, isSetupComplete: config.is_setup_complete }); },
  setAuthenticated: (v) => set({ isAuthenticated: v }),
  setLastBilledCustomer: (c) => set({ lastBilledCustomer: c }),
}));
