/**
 * Convert a value to BigInt safely
 * @param {bigint|string|number} value - The value to convert
 * @returns {bigint}
 */
export function toBigInt(value) {
  if (typeof value === 'bigint') return value
  if (typeof value === 'string') return BigInt(value)
  if (typeof value === 'number') return BigInt(Math.floor(Math.max(0, value)))
  return 0n
}

/**
 * Format a BigInt value to a human-readable string
 * @param {bigint|string|number} value - The value in wei
 * @param {number} decimals - Number of decimal places to show (default 2)
 * @returns {string}
 */
export function formatBigInt18(value, decimals = 2) {
  const bn = toBigInt(value)
  const base = 10n ** 18n
  const integer = bn / base
  const remainder = bn % base
  const fracStr = remainder.toString().padStart(18, '0').slice(0, decimals)
  const intStr = integer.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  if (decimals === 0) return intStr
  return intStr + '.' + fracStr
}

/**
 * Format a BigInt value to a precise human-readable string with 4 decimal places
 * @param {bigint|string|number} value - The value in wei
 * @returns {string}
 */
export function formatBigInt18Precise(value) {
  return formatBigInt18(value, 4)
}

/**
 * Format a BigInt value to a compact human-readable string (K, M, B)
 * @param {bigint|string|number} value - The value in wei
 * @returns {string}
 */
export function formatBigInt18Compact(value) {
  const bn = toBigInt(value)
  const base = 10n ** 18n
  const integer = bn / base
  const B = 1_000_000_000n
  const M = 1_000_000n
  const K = 1_000n
  const toOneDecimal = (val, unit) => {
    const scaledTimes10 = (val * 10n) / unit
    const whole = scaledTimes10 / 10n
    const frac = scaledTimes10 % 10n
    return frac === 0n ? `${whole}` : `${whole}.${frac}`
  }
  if (integer >= B) return `${toOneDecimal(integer, B)}B`
  if (integer >= M) return `${toOneDecimal(integer, M)}M`
  if (integer >= K) return `${toOneDecimal(integer, K)}K`
  return integer.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}
