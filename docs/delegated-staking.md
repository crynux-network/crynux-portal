# Delegated Staking

This document describes the delegated staking feature in Crynux Portal. **Read this before working on staking-related features.**

## Overview

Delegated staking allows users (delegators) to stake CNX tokens on nodes operated by others. Delegators earn a share of the node's rewards proportional to their stake.

```
┌─────────────────────────────────────────────────────────────────┐
│                         Delegator                                │
│                    (User with CNX tokens)                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Stakes CNX on
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                           Node                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Operator Stake: 10,000 CNX (Node operator's own stake)  │    │
│  │ Delegator Stake: 50,000 CNX (Sum of all delegators)     │    │
│  │ Delegator Share: 30% (Percentage of rewards to delegators)   │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  Current Network: Dymension  ← Node can switch networks         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Earns rewards
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Reward Distribution                           │
│  ┌──────────────────────┐  ┌──────────────────────┐             │
│  │  Operator: 70%       │  │  Delegators: 30%     │             │
│  │  of node rewards     │  │  split by stake      │             │
│  └──────────────────────┘  └──────────────────────┘             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Rewards deposited to
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Relay Account                              │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Off-chain balance managed by Crynux Relay               │    │
│  │ User can withdraw to blockchain wallet via Portal       │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

### Rewards and Withdrawal

Delegation rewards are **not sent directly to the delegator's blockchain wallet**. Instead:

1. **Rewards accumulate in Relay Account**: The Crynux Relay backend tracks each delegator's earned rewards off-chain.

2. **View in Portal Dashboard**: Users can see their relay account balance and reward history in the Portal's Dashboard → Relay Account page.

3. **Withdraw to Wallet**: Users can withdraw their relay account balance to their blockchain wallet through the Portal. The withdrawal process:
   - User initiates withdrawal request in Portal
   - User signs a message with their wallet (for authentication)
   - Relay processes the withdrawal and sends CNX to user's wallet (or beneficial address if set)
   - A withdrawal fee applies (configured in `config.json`)

```
Reward Flow:
────────────────────────────────────────────────────────────────────
Node completes task → Rewards calculated → Delegator share credited
                                                    │
                                                    ▼
                                          Relay Account (off-chain)
                                                    │
                                                    │ User requests withdrawal
                                                    ▼
                                          Blockchain Wallet (on-chain)
────────────────────────────────────────────────────────────────────
```

---

## Key Concepts

### Stake Network vs Node Network

**Critical concept**: A stake is recorded on a specific blockchain network, but the node it's staked on can switch networks.

| Term | Description |
|------|-------------|
| **Stake Network** | The blockchain where the stake transaction was recorded |
| **Node Network** | The blockchain where the node is currently operating |
| **Active Stake** | Stake network matches node's current network → Earns rewards |
| **Inactive Stake** | Stake network differs from node's current network → No rewards |

```
Example Scenario:
────────────────────────────────────────────────────────────────────
1. User stakes 1000 CNX on Node A while it's on Dymension
   → Stake recorded on Dymension blockchain
   → Stake Network = Dymension

2. Node A switches to Near network
   → Node Network = Near

3. Result:
   → User's stake is now INACTIVE (Dymension ≠ Near)
   → User receives no rewards until they restake on Near
────────────────────────────────────────────────────────────────────
```

### Why This Matters

1. **Staking operations use Stake Network**: When changing or removing a stake, the transaction must be on the blockchain where the stake was originally recorded.

2. **Rewards only for Active stakes**: Only stakes where Stake Network = Node Network earn rewards.

3. **User notification**: The UI should clearly show when a stake is inactive so users can take action.

---

## Contract Operations

### Smart Contract: `DelegatedStaking`

Located at `config.networks[networkKey].contracts.delegatedStaking` for each network.

**ABI**: `src/abi/delegated-staking.json`

### Reading Data (No Wallet Required)

```javascript
// src/services/delegated-staking.js

// Get minimum stake amount required
const minAmount = await getMinStakeAmount(networkKey)

// Get user's stake on a specific node
const amount = await getDelegationStakingAmount(networkKey, delegatorAddress, nodeAddress)

// Get all nodes a user has staked on
const { nodes, amounts } = await getDelegatorStakingInfos(networkKey, delegatorAddress)
```

### Stake Operation

The `stake()` function handles both adding new stake and modifying existing stake.

```javascript
// Contract call: stake(nodeAddress, totalAmount, { value: additionalAmount })
//
// Parameters:
// - totalAmount: The FINAL total stake amount (not the increment)
// - additionalAmount: Additional tokens to send (transaction value)
//
// Examples:
// 1. New stake of 1000 CNX:
//    stake(node, 1000, { value: 1000 })
//
// 2. Increase stake from 1000 to 1500 CNX:
//    stake(node, 1500, { value: 500 })  // Only send the difference
//
// 3. Decrease stake from 1500 to 1000 CNX:
//    stake(node, 1000, { value: 0 })    // Contract refunds the difference

export async function stake(networkKey, nodeAddress, totalAmount, additionalAmount) {
  const contract = await getWriteContract(networkKey)
  const totalAmountWei = parseTokenAmount(totalAmount, 18)
  const additionalAmountWei = parseTokenAmount(additionalAmount, 18)
  const tx = await contract.stake(nodeAddress, totalAmountWei, { value: additionalAmountWei })
  return tx.wait()
}
```

### Unstake Operation

The `unstake()` function removes ALL stake from a node. Partial unstaking is not supported directly—use `stake()` with a lower amount instead.

```javascript
// Contract call: unstake(nodeAddress)
//
// - Removes entire stake from the node
// - Funds sent to beneficial address (if set) or operational address

export async function unstake(networkKey, nodeAddress) {
  const contract = await getWriteContract(networkKey)
  const tx = await contract.unstake(nodeAddress)
  return tx.wait()
}
```

---

## Network Handling in UI

### Node Details Page (`my-delegation.vue`)

When viewing a node's details page:

1. **Uses Node's Network**: The component receives the node's network from props
2. **Checks Other Networks**: Also checks if user has stakes on the same node in other networks
3. **Shows Alert**: If user has inactive stakes on other networks, displays a notification

```javascript
// my-delegation.vue

// Fetch delegation using the node's network (not wallet's selected network)
const resp = await walletAPI.getDelegation(wallet.address, props.nodeAddress, props.network)

// Check for stakes on other networks
async function fetchOtherNetworkStakes() {
  const allNetworks = Object.keys(config.networks)
  const otherNetworks = allNetworks.filter(n => n !== props.network)

  for (const network of otherNetworks) {
    const resp = await walletAPI.getDelegation(wallet.address, props.nodeAddress, network)
    if (resp.staking_amount > 0) {
      // User has inactive stake on this network
      otherNetworkStakes.push({ network, amount: resp.staking_amount })
    }
  }
}
```

### Delegation List Page (`delegated-staking.vue`)

The delegation list shows all user's stakes with Active/Inactive status:

```javascript
// delegated-staking.vue

// Fetch node details to get current network
const nodeDetails = await v2DelegatedStakingAPI.getNodeDetails(nodeAddress)
const nodeNetwork = nodeDetails?.network

// Compare with stake's network
const isActive = nodeNetwork === delegation.network

// Display:
// - Active (green): Stake network = Node network
// - Inactive (red): Stake network ≠ Node network
```

### Stake/Unstake Operations

**Critical**: Operations must use the **Stake Network**, not the Node's current network.

```javascript
// delegation-modals.vue

// DelegationModals receives the stake's network as prop
props: {
  nodeAddress: String,
  network: String,      // ← This is the STAKE network
  stakingAmount: BigInt
}

async function submitStake() {
  // Switch MetaMask to the stake's network
  await wallet.ensureNetworkOnWallet(props.network)

  // Execute transaction on stake's network
  await delegatedStakingService.stake(props.network, props.nodeAddress, newAmount, additionalAmount)
}

async function submitUnstake() {
  // Switch MetaMask to the stake's network
  await wallet.ensureNetworkOnWallet(props.network)

  // Execute transaction on stake's network
  await delegatedStakingService.unstake(props.network, props.nodeAddress)
}
```

---

## Visual Indicators

### Status Icons

| Icon | Meaning |
|------|---------|
| 🟢 Play | Node is running |
| 🟡 Pause | Node is paused |
| ⚪ Stop | Node is stopped |
| 💲 Green | Stake is active (earning rewards) |
| 💲 Red | Stake is inactive (not earning) |

### Network Mismatch Display

When stake network differs from node network:

```
┌─────────────────────────────────────────────────────────────────┐
│  ⚠️ Network Mismatch (Inactive)                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  Stake: [Dymension]  →  Node: [Near]                        ││
│  └─────────────────────────────────────────────────────────────┘│
│  Your stake is on a different network than the node.            │
│  Restake on the node's current network to earn rewards.         │
└─────────────────────────────────────────────────────────────────┘
```

---

## File Reference

| File | Purpose |
|------|---------|
| `services/delegated-staking.js` | Contract interaction service |
| `abi/delegated-staking.json` | Smart contract ABI |
| `components/delegation-modals.vue` | Stake/Unstake modal dialogs |
| `components/staking/my-delegation.vue` | User's stake on a specific node |
| `components/dashboard/delegated-staking/delegated-staking.vue` | Delegation list with status |
| `api/v1/wallet.js` | Delegation earnings API |
| `api/v2/delegated-staking.js` | Node details API |

---

## Common Patterns

### Before Any Transaction

Always switch to the correct network first:

```javascript
// Switch MetaMask to stake's network (also updates wallet store)
await wallet.ensureNetworkOnWallet(stakeNetwork)

// Now execute the transaction
await delegatedStakingService.stake(stakeNetwork, nodeAddress, amount, additionalAmount)

// Refresh wallet balance
await wallet.refreshAccountAndBalance()
```

### Checking Stake Status

```javascript
// Get node's current network
const nodeDetails = await v2DelegatedStakingAPI.getNodeDetails(nodeAddress)
const nodeNetwork = nodeDetails.network

// Get user's stake network (from delegation list)
const stakeNetwork = delegation.network

// Determine status
const isActive = stakeNetwork === nodeNetwork
```

### Error Handling

```javascript
import { isUserRejectedError } from '@/services/contract'

try {
  await delegatedStakingService.stake(network, nodeAddress, amount, additionalAmount)
  message.success('Stake successful')
} catch (e) {
  if (isUserRejectedError(e)) {
    message.error('Transaction rejected')
  } else {
    message.error('Staking failed: ' + (e.reason || e.message))
  }
}
```
