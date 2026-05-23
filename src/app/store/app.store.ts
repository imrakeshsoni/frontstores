import { create } from 'zustand';
import { AppConfig, getAppConfig } from '@/lib/db/config';

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
      set({
        config,
        isSetupComplete: config?.is_setup_complete ?? false,
        isLoading: false,
      });
    } catch {
      set({ isLoading: false });
    }
  },

  setConfig: (config) => set({ config, isSetupComplete: config.is_setup_complete }),
}));
