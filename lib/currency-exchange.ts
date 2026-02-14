import Decimal from 'decimal.js'

import type { CurrencyExchangeRate, GameConfig } from '@/types/game-config'

export const findDirectExchangeRate = (
  config: GameConfig,
  fromCurrencyId: string,
  toCurrencyId: string
): CurrencyExchangeRate | null => {
  for (const r of config.exchangeRates) {
    if (r.fromCurrencyId === fromCurrencyId && r.toCurrencyId === toCurrencyId) return r
  }
  return null
}

export const convertByDirectRate = (
  config: GameConfig,
  amount: Decimal.Value,
  fromCurrencyId: string,
  toCurrencyId: string
): Decimal | null => {
  if (fromCurrencyId === toCurrencyId) return new Decimal(amount)
  const rate = findDirectExchangeRate(config, fromCurrencyId, toCurrencyId)
  if (!rate) return null
  return new Decimal(amount).mul(new Decimal(rate.rate))
}

