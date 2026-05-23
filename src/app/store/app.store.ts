import { create } from 'zustand';
import { AppConfig, getAppConfig } from '@/lib/db/config';
import { setReporterTenantId } from '@/lib/errorReporter';

interface AppState {
  config: AppConfig | null;
  isLoading: boolean;
  isSetupComplete: boolean;

  loadConfig: () => Promise<void>;
  setConfig: (config: AppConfig) => void;
}

export const useAppStore = create<AppState>((set) => ({
  config: null,
  isLoading: true,
  isSetupComplete: false,

  loadConfig: async () => {
    set({ isLoading: true });
    try {
      const config = await getAppConfig();
      if (config?.tenant_id) setReporterTenantId(config.tenant_id);
      set({
        config,
        isSetupComplete: config?.is_setup_complete ?? false,
        isLoading: false,
      });
    } catch {
      set({ isLoading: false });
    }
  },

  setConfig: (config) => { setReporterTenantId(config.tenant_id); set({ config, isSetupComplete: config.is_setup_complete }); },
}));
