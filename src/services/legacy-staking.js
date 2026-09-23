import { ethers } from 'ethers'
import { createBrowserSigner, createReadProvider, isZeroAddress } from './contract'
import { toBigInt } from './token'
import { useWalletStore } from '@/stores/wallet'
import { getLegacyStakingAbiProfile } from './legacy-staking-abi-profiles'

export const LegacyStakingStatus = Object.freeze({
  UNSTAKED: 0,
  STAKED: 1,
  PENDING_UNSTAKE: 2
})

function getContracts(networkKey, legacyContracts, signerOrProvider) {
  if (!legacyContracts) {
    throw new Error(`Legacy staking contracts are not configured for ${networkKey}`)
  }
  const profile = getLegacyStakingAbiProfile(legacyContracts.abiProfile)
  for (const name of ['nodeStaking', 'delegatedStaking', 'beneficialAddress']) {
    if (!ethers.isAddress(legacyContracts[name])) {
      throw new Error(`Invalid legacy ${name} address for ${networkKey}`)
    }
  }
  return {
    nodeStaking: new ethers.Contract(legacyContracts.nodeStaking, profile.nodeStaking, signerOrProvider),
    delegatedStaking: new ethers.Contract(legacyContracts.delegatedStaking, profile.delegatedStaking, signerOrProvider),
    beneficialAddress: new ethers.Contract(legacyContracts.beneficialAddress, profile.beneficialAddress, signerOrProvider)
  }
}

function getReadContracts(networkKey, legacyContracts) {
  return getContracts(networkKey, legacyContracts, createReadProvider(networkKey))
}

async function getWriteContracts(networkKey, legacyContracts) {
  const wallet = useWalletStore()
  await wallet.requireNetworkOnWallet(networkKey)
  return getContracts(networkKey, legacyContracts, await createBrowserSigner())
}

export async function getLegacyNodeStakingInfo(networkKey, legacyContracts, walletAddress) {
  const contracts = getReadContracts(networkKey, legacyContracts)
  const [stakingInfo, forceUnstakeDelay, benefitAddress] = await Promise.all([
    contracts.nodeStaking.getStakingInfo(walletAddress),
    contracts.nodeStaking.getForceUnstakeDelay(),
    contracts.beneficialAddress.getBenefitAddress(walletAddress)
  ])
  return {
    nodeAddress: walletAddress,
    stakedBalance: toBigInt(stakingInfo.stakedBalance ?? stakingInfo[1] ?? 0n),
    status: Number(stakingInfo.status ?? stakingInfo[3] ?? 0),
    unstakeTimestamp: toBigInt(stakingInfo.unstakeTimestamp ?? stakingInfo[4] ?? 0n),
    forceUnstakeDelay: toBigInt(forceUnstakeDelay),
    benefitAddress: isZeroAddress(benefitAddress) ? '' : benefitAddress
  }
}

export async function getLegacyDelegations(networkKey, legacyContracts, walletAddress) {
  const { delegatedStaking } = getReadContracts(networkKey, legacyContracts)
  const [nodes, amounts] = await delegatedStaking.getDelegatorStakingInfos(walletAddress)
  return nodes.map((nodeAddress, index) => ({
    nodeAddress,
    amount: toBigInt(amounts[index] ?? 0n)
  })).filter(item => item.amount > 0n)
}

async function waitForTransaction(transaction) {
  const receipt = await transaction.wait()
  return {
    hash: transaction.hash,
    receipt
  }
}

export async function tryLegacyNodeUnstake(networkKey, legacyContracts) {
  const { nodeStaking } = await getWriteContracts(networkKey, legacyContracts)
  return waitForTransaction(await nodeStaking.tryUnstake())
}

export async function forceLegacyNodeUnstake(networkKey, legacyContracts) {
  const { nodeStaking } = await getWriteContracts(networkKey, legacyContracts)
  return waitForTransaction(await nodeStaking.forceUnstake())
}

export async function unstakeLegacyDelegation(networkKey, legacyContracts, nodeAddress) {
  const { delegatedStaking } = await getWriteContracts(networkKey, legacyContracts)
  return waitForTransaction(await delegatedStaking.unstake(nodeAddress))
}
