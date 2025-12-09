import { ethers } from 'ethers'
import config from '@/config.json'
import beneficialAbi from '@/abi/beneficial-address.json'

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
 * Get the balance of an address on a specific network
 * @param {string} networkKey - The network key
 * @param {string} address - The wallet address
 * @returns {Promise<bigint>}
 */
export async function getBalanceForNetwork(networkKey, address) {
  const provider = createReadProvider(networkKey)
  return provider.getBalance(address)
}

/**
 * Check if an address is the zero address
 * @param {string} addr - The address to check
 * @returns {boolean}
 */
export function isZeroAddress(addr) {
  if (!addr) return true
  try {
    return ethers.ZeroAddress.toLowerCase() === String(addr).toLowerCase()
  } catch {
    return false
  }
}

/**
 * Get the beneficial address for a wallet on a specific network
 * @param {string} networkKey - The network key
 * @param {string} walletAddress - The wallet address to check
 * @returns {Promise<string>} The beneficial address (or empty string if not set/error)
 */
export async function getBeneficialAddress(networkKey, walletAddress) {
  if (!walletAddress || !networkKey) {
    return ''
  }
  const contractAddress = config.networks[networkKey]?.contracts?.beneficialAddress
  if (!contractAddress) {
    return ''
  }
  try {
    const provider = createReadProvider(networkKey)
    const contract = new ethers.Contract(contractAddress, beneficialAbi, provider)
    const addr = await contract.getBenefitAddress(walletAddress)
    return addr
  } catch (e) {
    console.error('Failed to fetch beneficial address:', e)
    return ''
  }
}
