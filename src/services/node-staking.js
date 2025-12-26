import { ethers } from 'ethers'
import {
  createReadProvider,
  createBrowserSigner,
  getContractAddress
} from './contract'
import { toBigInt } from './token'
import { useWalletStore } from '@/stores/wallet'
import nodeStakingAbi from '@/abi/node-staking.json'

/**
 * Get the node staking contract instance for reading
 * @param {string} networkKey - The network key
 * @returns {ethers.Contract}
 */
function getReadContract(networkKey) {
  const address = getContractAddress(networkKey, 'nodeStaking')
  const provider = createReadProvider(networkKey)
  return new ethers.Contract(address, nodeStakingAbi, provider)
}

/**
 * Get the node staking contract instance for writing (with signer)
 * Ensures MetaMask is on the correct network before creating signer
 * @param {string} networkKey - The network key
 * @returns {Promise<ethers.Contract>}
 */
async function getWriteContract(networkKey) {
  const wallet = useWalletStore()
  await wallet.ensureNetworkOnWallet(networkKey)
  const address = getContractAddress(networkKey, 'nodeStaking')
  const signer = await createBrowserSigner()
  return new ethers.Contract(address, nodeStakingAbi, signer)
}

/**
 * Staking status enum
 * @readonly
 * @enum {number}
 */
export const StakingStatus = {
  UNSTAKED: 0,
  STAKED: 1,
  PENDING_UNSTAKE: 2
}

/**
 * @typedef {Object} StakingInfo
 * @property {string} nodeAddress - The node address
 * @property {bigint} stakedBalance - The staked CNX balance
 * @property {bigint} stakedCredits - The staked credits
 * @property {number} status - The staking status (0=Unstaked, 1=Staked, 2=PendingUnstake)
 * @property {bigint} unstakeTimestamp - Timestamp when tryUnstake was called
 */

/**
 * Get staking info for a node address
 * @param {string} networkKey - The network key
 * @param {string} nodeAddress - The node address
 * @returns {Promise<StakingInfo>}
 */
export async function getStakingInfo(networkKey, nodeAddress) {
  const contract = getReadContract(networkKey)
  const res = await contract.getStakingInfo(nodeAddress)
  return {
    nodeAddress: res.nodeAddress ?? res[0] ?? '',
    stakedBalance: toBigInt(res.stakedBalance ?? res[1] ?? 0n),
    stakedCredits: toBigInt(res.stakedCredits ?? res[2] ?? 0n),
    status: Number(res.status ?? res[3] ?? 0),
    unstakeTimestamp: toBigInt(res.unstakeTimestamp ?? res[4] ?? 0n)
  }
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
 * Initiate unstake request (relay will process, or force unstake after delay)
 * @param {string} networkKey - The network key
 * @returns {Promise<ethers.TransactionReceipt>}
 */
export async function tryUnstake(networkKey) {
  const contract = await getWriteContract(networkKey)
  const tx = await contract.tryUnstake()
  return tx.wait()
}

/**
 * Force unstake after the delay period has passed
 * @param {string} networkKey - The network key
 * @returns {Promise<ethers.TransactionReceipt>}
 */
export async function forceUnstake(networkKey) {
  const contract = await getWriteContract(networkKey)
  const tx = await contract.forceUnstake()
  return tx.wait()
}

export default {
  StakingStatus,
  getStakingInfo,
  getMinStakeAmount,
  tryUnstake,
  forceUnstake
}
