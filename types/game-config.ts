import Decimal from "decimal.js";

export type DecimalValue = Decimal.Value;

export type CurrencyKind = "main" | "premium";

export interface Currency {
  id: string;
  name: string;
  kind: CurrencyKind;
  symbol?: string;
  decimals: number;
}

export interface PitySystem {
  id: string;
  name: string;
  baseRate: DecimalValue;
  overallRate?: DecimalValue;
  softPityStart: number | null;
  softPityIncreasePerPull: DecimalValue | null;
  hardPity: number;
  featuredWinRate: DecimalValue;
  guaranteedAfterLoses: number;
}

export type BannerCategory = "new" | "rerun";

export type BannerType = "single_month" | "birthday" | "mixed" | "daily";

export type BannerRewardType = "free_pulls" | "select_up_five_star_box";

export interface BannerBenefitReward {
  type: BannerRewardType;
  amount: number;
}

export interface BannerBenefitStep {
  triggerPulls: number;
  rewards: BannerBenefitReward[];
}

export type BannerBenefitKind = "one_time" | "cumulative";

export interface BannerBenefit {
  kind: BannerBenefitKind;
  steps: BannerBenefitStep[];
}

export interface BannerFeaturedRule {
  totalUpItems: number;
  featuredShareRate: DecimalValue;
  selectableUpCount?: number;
  directedUpCount?: number;
  guaranteedDirectedAfterMisses?: number;
  rotateFeatured?: boolean;
  rotateOrder?: string[];
}

export interface Banner {
  id: string;
  name: string;
  upItems: string[];
  startAt: string;
  endAt: string;
  pitySystemId: string;
  pityGroupId?: string;
  costPerPull: DecimalValue;
  costCurrencyId: string;
  category?: BannerCategory;
  type?: BannerType;
  featuredRule?: BannerFeaturedRule;
  ruleDoc?: string[];
  benefits?: BannerBenefit[];
}

export type RechargePackKind = "direct" | "monthly";

export interface RechargePack {
  id: string;
  name: string;
  kind: RechargePackKind;
  priceCNY: DecimalValue;
  premiumCurrencyId: string;
  premiumAmount: DecimalValue;
  firstPurchaseBonusAmount?: DecimalValue;
  durationDays?: number;
  dailyMainCurrencyAmount?: DecimalValue;
}

export interface CurrencyExchangeRate {
  fromCurrencyId: string;
  toCurrencyId: string;
  rate: DecimalValue;
}

export interface GameUiTerms {
  targetCountLabel: string;
  targetUnitName: string;
  softPityLabel: string;
  hardPityLabel: string;
  pullLabel: string;
}

export interface GameConfig {
  id: string;
  name: string;
  defaultMainCurrencyId: string;
  defaultPremiumCurrencyId: string;
  ui?: GameUiTerms;
  currencies: Currency[];
  pitySystems: PitySystem[];
  banners: Banner[];
  rechargePacks: RechargePack[];
  exchangeRates: CurrencyExchangeRate[];
}
