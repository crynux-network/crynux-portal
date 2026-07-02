import { ethers } from 'ethers'
import {
  createReadProvider,
  createBrowserSigner,
  getContractAddress,
  getNativeDecimals,
  parseTokenAmount
} from './contract'
import { toBigInt } from './token'
import { useWalletStore } from '@/stores/wallet'
import delegatedStakingAbi from '@/abi/delegated-staking.json'

export class InvalidDelegatedStakingContractError extends Error {
  constructor(networkKey, contractAddress, reason) {
    super(`Invalid delegated staking contract for ${networkKey}: ${contractAddress}. ${reason}`)
    this.name = 'InvalidDelegatedStakingContractError'
  }
}

/**
 * Get the delegated staking contract instance for reading
 * @param {string} networkKey - The network key
 * @returns {ethers.Contract}
 */
function getReadContract(networkKey) {
  const address = getContractAddress(networkKey, 'delegatedStaking')
  const provider = createReadProvider(networkKey)
  return new ethers.Contract(address, delegatedStakingAbi, provider)
}

async function validateDelegatedStakingContract(networkKey, provider) {
  const address = getContractAddress(networkKey, 'delegatedStaking')
  if (!address || !ethers.isAddress(address)) {
    throw new InvalidDelegatedStakingContractError(networkKey, address || '<empty>', 'The configured address is not a valid address.')
  }

  const code = await provider.getCode(address)
  if (code === '0x') {
    throw new InvalidDelegatedStakingContractError(networkKey, address, 'No contract is deployed at this address.')
  }

  const contract = new ethers.Contract(address, delegatedStakingAbi, provider)
  try {
    await Promise.all([
      contract.getMinStakeAmount.staticCall(),
      contract.getDelegatorTotalStakeAmount.staticCall(ethers.ZeroAddress)
    ])
  } catch (e) {
    throw new InvalidDelegatedStakingContractError(networkKey, address, 'The contract does not expose the expected delegated staking methods.')
  }

  return address
}

/**
 * Get the delegated staking contract instance for writing (with signer)
 * Ensures MetaMask is on the correct network before creating signer
 * @param {string} networkKey - The network key
 * @returns {Promise<ethers.Contract>}
 */
async function getWriteContract(networkKey) {
  const wallet = useWalletStore()
  await wallet.ensureNetworkOnWallet(networkKey)
  const provider = createReadProvider(networkKey)
  const address = await validateDelegatedStakingContract(networkKey, provider)
  const signer = await createBrowserSigner()
  return new ethers.Contract(address, delegatedStakingAbi, signer)
}

/**
 * Get the minimum stake amount required
 * @param {string} networkKey - The network key
 * @returns {Promise<bigint>}
 */
export async function getMinStakeAmount(networkKey) {
  const contract = getReadContract(networkKey)
  const res = await contract.getMinStakeAmount()
  return toBigInt(res)
}

/**
 * Get the delegation staking amount for a delegator on a specific node
 * @param {string} networkKey - The network key
 * @param {string} delegatorAddress - The delegator's wallet address
 * @param {string} nodeAddress - The node address
 * @returns {Promise<bigint>}
 */
export async function getDelegationStakingAmount(networkKey, delegatorAddress, nodeAddress) {
  const contract = getReadContract(networkKey)
  const res = await contract.getDelegationStakingAmount(delegatorAddress, nodeAddress)
  return toBigInt(res)
}

/**
 * Get all staking info for a delegator (all nodes they've staked on)
 * @param {string} networkKey - The network key
 * @param {string} delegatorAddress - The delegator's wallet address
 * @returns {Promise<{nodes: string[], amounts: bigint[]}>}
 */
export async function getDelegatorStakingInfos(networkKey, delegatorAddress) {
  const contract = getReadContract(networkKey)
  const [nodes, amounts] = await contract.getDelegatorStakingInfos(delegatorAddress)
  return {
    nodes,
    amounts: amounts.map(a => toBigInt(a))
  }
}

/**
 * Get total stake amount for a delegator across all nodes
 * @param {string} networkKey - The network key
 * @param {string} delegatorAddress - The delegator's wallet address
 * @returns {Promise<bigint>}
 */
export async function getDelegatorTotalStakeAmount(networkKey, delegatorAddress) {
  const contract = getReadContract(networkKey)
  const res = await contract.getDelegatorTotalStakeAmount(delegatorAddress)
  return toBigInt(res)
}

/**
 * Get total stake amount for a node from all delegators
 * @param {string} networkKey - The network key
 * @param {string} nodeAddress - The node address
 * @returns {Promise<bigint>}
 */
export async function getNodeTotalStakeAmount(networkKey, nodeAddress) {
  const contract = getReadContract(networkKey)
  const res = await contract.getNodeTotalStakeAmount(nodeAddress)
  return toBigInt(res)
}

/**
 * Get the delegator share percentage for a node
 * @param {string} networkKey - The network key
 * @param {string} nodeAddress - The node address
 * @returns {Promise<number>} - The share percentage (0-100)
 */
export async function getNodeDelegatorShare(networkKey, nodeAddress) {
  const contract = getReadContract(networkKey)
  const res = await contract.getNodeDelegatorShare(nodeAddress)
  return Number(res)
}

/**
 * Stake tokens on a node
 * @param {string} networkKey - The network key
 * @param {string} nodeAddress - The node address to stake on
 * @param {number|string} totalAmount - The final total stake amount (contract parameter)
 * @param {number|string} additionalAmount - The additional tokens to send (transaction value)
 * @returns {Promise<ethers.TransactionReceipt>}
 */
export async function stake(networkKey, nodeAddress, totalAmount, additionalAmount) {
  const contract = await getWriteContract(networkKey)
  const decimals = getNativeDecimals(networkKey)
  const totalAmountWei = parseTokenAmount(totalAmount, decimals)
  const additionalAmountWei = parseTokenAmount(additionalAmount, decimals)
  const tx = await contract.stake(nodeAddress, totalAmountWei, { value: additionalAmountWei })
  return tx.wait()
}

/**
 * Unstake all tokens from a node
 * @param {string} networkKey - The network key
 * @param {string} nodeAddress - The node address to unstake from
 * @returns {Promise<ethers.TransactionReceipt>}
 */
export async function unstake(networkKey, nodeAddress) {
  const contract = await getWriteContract(networkKey)
  const tx = await contract.unstake(nodeAddress)
  return tx.wait()
}

export default {
  getMinStakeAmount,
  getDelegationStakingAmount,
  getDelegatorStakingInfos,
  getDelegatorTotalStakeAmount,
  getNodeTotalStakeAmount,
  getNodeDelegatorShare,
  stake,
  unstake
}
