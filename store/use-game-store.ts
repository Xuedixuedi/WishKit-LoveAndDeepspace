import Decimal from "decimal.js";
import { create } from "zustand";

import { LOVE_AND_DEEPSPACE_CONFIG } from "@/data/love-and-deepspace";
import type { DecimalValue, GameConfig } from "@/types/game-config";

export interface UserSettings {
  ownedMainCurrency: string;
  ownedPremiumCurrency: string;
  pityCounter: number;
  isFeaturedGuaranteed: boolean;
}

export interface TargetSettings {
  bannerId: string;
  targetName: string;
  targetFiveStarCount: number;
}

interface GameStoreState {
  gameConfig: GameConfig;
  userSettings: UserSettings;
  targetSettings: TargetSettings;
  actions: {
    setOwnedMainCurrency: (value: DecimalValue) => void;
    setOwnedPremiumCurrency: (value: DecimalValue) => void;
    addOwnedMainCurrency: (delta: DecimalValue) => void;
    setPityCounter: (value: number) => void;
    setFeaturedGuaranteed: (value: boolean) => void;
    setTarget: (patch: Partial<TargetSettings>) => void;
    setBannerId: (bannerId: string) => void;
    reset: () => void;
  };
}

const toIntString = (value: DecimalValue) =>
  new Decimal(value).toDecimalPlaces(0, Decimal.ROUND_FLOOR).toString();

const defaultUserSettings: UserSettings = {
  ownedMainCurrency: "0",
  ownedPremiumCurrency: "0",
  pityCounter: 0,
  isFeaturedGuaranteed: false,
};

const defaultTargetSettings: TargetSettings = {
  bannerId: "ls_single_month_new",
  targetName: "示例UP-单人A",
  targetFiveStarCount: 3,
};

export const useGameStore = create<GameStoreState>()((set) => ({
  gameConfig: LOVE_AND_DEEPSPACE_CONFIG,
  userSettings: defaultUserSettings,
  targetSettings: defaultTargetSettings,
  actions: {
    setOwnedMainCurrency: (value) =>
      set((state) => ({
        userSettings: {
          ...state.userSettings,
          ownedMainCurrency: toIntString(value),
        },
      })),
    setOwnedPremiumCurrency: (value) =>
      set((state) => ({
        userSettings: {
          ...state.userSettings,
          ownedPremiumCurrency: toIntString(value),
        },
      })),
    addOwnedMainCurrency: (delta) =>
      set((state) => ({
        userSettings: {
          ...state.userSettings,
          ownedMainCurrency: new Decimal(state.userSettings.ownedMainCurrency)
            .add(new Decimal(delta))
            .toDecimalPlaces(0, Decimal.ROUND_FLOOR)
            .toString(),
        },
      })),
    setPityCounter: (value) =>
      set((state) => ({
        userSettings: {
          ...state.userSettings,
          pityCounter: Math.max(0, Math.floor(value)),
        },
      })),
    setFeaturedGuaranteed: (value) =>
      set((state) => ({
        userSettings: {
          ...state.userSettings,
          isFeaturedGuaranteed: value,
        },
      })),
    setTarget: (patch) =>
      set((state) => ({
        targetSettings: {
          ...state.targetSettings,
          ...patch,
        },
      })),
    setBannerId: (bannerId) =>
      set((state) => ({
        targetSettings: {
          ...state.targetSettings,
          bannerId,
          targetName:
            state.gameConfig.banners.find((b) => b.id === bannerId)
              ?.upItems[0] ?? state.targetSettings.targetName,
        },
      })),
    reset: () =>
      set(() => ({
        userSettings: defaultUserSettings,
        targetSettings: defaultTargetSettings,
      })),
  },
}));
