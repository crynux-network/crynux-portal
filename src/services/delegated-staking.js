import { ethers } from 'ethers'
import {
  createReadProvider,
  createBrowserSigner,
  getContractAddress,
  getNativeDecimals,
  parseTokenAmount,
  toBigInt
} from './contract'
import delegatedStakingAbi from '@/abi/delegated-staking.json'

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

/**
 * Get the delegated staking contract instance for writing (with signer)
 * @param {string} networkKey - The network key
 * @returns {Promise<ethers.Contract>}
 */
async function getWriteContract(networkKey) {
  const address = getContractAddress(networkKey, 'delegatedStaking')
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
 * @param {number|string} amount - The amount to stake in token units (not wei)
 * @returns {Promise<ethers.TransactionReceipt>}
 */
export async function stake(networkKey, nodeAddress, amount) {
  const contract = await getWriteContract(networkKey)
  const decimals = getNativeDecimals(networkKey)
  const amountWei = parseTokenAmount(amount, decimals)
  const tx = await contract.stake(nodeAddress, amountWei, { value: amountWei })
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
