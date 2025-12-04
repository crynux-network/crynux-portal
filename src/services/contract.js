import { ethers } from 'ethers'
import config from '@/config.json'

/**
 * Create a read-only JSON-RPC provider for the specified network
 * @param {string} networkKey - The network key from config (e.g., 'dymension', 'near')
 * @returns {ethers.JsonRpcProvider}
 */
export function createReadProvider(networkKey) {
  const url = config.networks[networkKey].rpcUrls[0]
  return new ethers.JsonRpcProvider(url)
}

/**
 * Create a signer-enabled provider using the browser wallet (MetaMask)
 * @returns {Promise<ethers.Signer>}
 */
export async function createBrowserSigner() {
  const provider = new ethers.BrowserProvider(window.ethereum)
  return provider.getSigner()
}

/**
 * Check if an error is a user rejection error (user cancelled the transaction)
 * @param {Error} err - The error to check
 * @returns {boolean}
 */
export function isUserRejectedError(err) {
  const e = err || {}
  const msg = String(e.message || '').toLowerCase()
  return (
    e.code === 4001 ||
    e.code === 'ACTION_REJECTED' ||
    (e.info?.error?.code === 4001) ||
    (e.error?.code === 4001) ||
    msg.includes('user rejected') ||
    msg.includes('user denied')
  )
}

/**
 * Get the contract address for a specific contract type on a network
 * @param {string} networkKey - The network key
 * @param {string} contractName - The contract name (e.g., 'delegatedStaking', 'nodeStaking')
 * @returns {string}
 */
export function getContractAddress(networkKey, contractName) {
  return config.networks[networkKey].contracts[contractName]
}

/**
 * Get the native currency decimals for a network
 * @param {string} networkKey - The network key
 * @returns {number}
 */
export function getNativeDecimals(networkKey) {
  return config.networks[networkKey].nativeCurrency.decimals
}

/**
 * Get the native currency symbol for a network
 * @param {string} networkKey - The network key
 * @returns {string}
 */
export function getNativeCurrencySymbol(networkKey) {
  return config.networks[networkKey].nativeCurrency.symbol
}

/**
 * Parse a token amount string to BigInt (wei)
 * @param {string|number} amount - The amount in token units
 * @param {number} decimals - The number of decimals (default 18)
 * @returns {bigint}
 */
export function parseTokenAmount(amount, decimals = 18) {
  return ethers.parseUnits(String(amount), decimals)
}

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
