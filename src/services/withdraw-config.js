import networkAPI from '@/api/v1/network'

let cachedConfigs = null
let pendingFetch = null

const normalizeConfig = (item) => ({
  network: item.network,
  token_type: item.token_type,
  withdrawal_fee: Number(item.withdrawal_fee || 0),
  withdrawal_min: Number(item.withdrawal_min || 0),
  withdrawal_fee_tiers: (item.withdrawal_fee_tiers || []).map((tier) => ({
    min_amount: Number(tier.min_amount || 0),
    fee_ratio: Number(tier.fee_ratio || 0)
  }))
})

export const fetchWithdrawConfigs = async (forceRefresh = false) => {
  if (cachedConfigs && !forceRefresh) return cachedConfigs
  if (!pendingFetch) {
    pendingFetch = networkAPI
      .getWithdrawConfig()
      .then((data) => {
        cachedConfigs = Object.fromEntries(
          (data || []).map((item) => [item.network, normalizeConfig(item)])
        )
        return cachedConfigs
      })
      .finally(() => {
        pendingFetch = null
      })
  }
  return pendingFetch
}

const feeRatioForAmount = (config, amount) => {
  let ratio = 0
  for (const tier of config?.withdrawal_fee_tiers || []) {
    if (amount < tier.min_amount) break
    ratio = tier.fee_ratio
  }
  return ratio
}

// Fee = fixed fee + amount * ratio, where the ratio comes from the highest tier
// whose min_amount is not greater than the amount. Mirrors the relay-side rule.
export const calculateWithdrawalFee = (config, amount) => {
  if (!config) return 0
  const amt = Number(amount || 0)
  if (!Number.isFinite(amt) || amt <= 0) return config.withdrawal_fee
  return config.withdrawal_fee + amt * feeRatioForAmount(config, amt)
}

// Largest integer amount such that amount + fee(amount) <= balance, solved per tier.
export const calculateMaxWithdrawAmount = (config, balance) => {
  if (!config) return 0
  const bal = Number(balance || 0)
  const tiers = config.withdrawal_fee_tiers.length
    ? config.withdrawal_fee_tiers
    : [{ min_amount: 0, fee_ratio: 0 }]
  let best = 0
  for (let i = 0; i < tiers.length; i++) {
    const upper = i + 1 < tiers.length ? tiers[i + 1].min_amount - 1 : Infinity
    let candidate = Math.floor((bal - config.withdrawal_fee) / (1 + tiers[i].fee_ratio))
    candidate = Math.min(candidate, upper)
    if (candidate >= tiers[i].min_amount && candidate > best) best = candidate
  }
  return Math.max(0, best)
}
